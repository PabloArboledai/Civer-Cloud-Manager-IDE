use super::*;
use axum::{
    extract::{Json, State}, http::StatusCode, response::{IntoResponse, Response},
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
};
use base64::Engine as _;
use bytes::Bytes;
use serde_json::{json, Value};
use tracing::{debug, error, info, warn};

use crate::proxy::mappers::openai::{
    transform_openai_request, transform_openai_response, OpenAIMessage, OpenAIRequest,
};
use crate::proxy::debug_logger;
use crate::proxy::server::AppState;
use crate::proxy::upstream::client::mask_email;

use crate::proxy::handlers::common::{
    apply_retry_strategy, determine_retry_strategy, should_rotate_account, RetryStrategy,
};
use crate::modules::account;
use crate::proxy::common::client_adapter::CLIENT_ADAPTERS;
use crate::proxy::session_manager::SessionManager;
use axum::http::HeaderMap;
use std::collections::{VecDeque, HashMap};
use tokio::time::Duration;
use uuid::Uuid;
use futures::stream::StreamExt;
use futures::SinkExt;

use tokio::sync::RwLock as TokioRwLock;
use std::sync::OnceLock;

pub async fn handle_completions(
    axum::extract::OriginalUri(uri): axum::extract::OriginalUri,
    State(state): State<AppState>,
    Json(mut body): Json<Value>,
) -> Response {
    debug!(
        "Received /v1/completions or /v1/responses payload: {:?}",
        body
    );
    let original_body = body.clone();
    let debug_cfg = state.debug_logging.read().await.clone();

    // [MULTI-TURN] 支持 previous_response_id 链式历史恢复
    // 当客户端通过 HTTP POST /v1/responses 传入 previous_response_id 时，
    // 从服务器端 session store 取出上一轮的历史，合并到本轮的 input 中
    let previous_response_id = body
        .get("previous_response_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let response_id_for_save = format!("resp-{}", uuid::Uuid::new_v4());
    let http_tool_call_cache: std::collections::HashMap<String, serde_json::Value> =
        std::collections::HashMap::new();
    if let Some(ref prev_id) = previous_response_id {
        if let Some(session) = crate::proxy::http_session_store::get_session(prev_id).await {
            // 把历史 input items 合并进来
            let existing_input = body
                .get("input")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            let merged = crate::proxy::http_session_store::merge_history_with_new_input(
                session.input_items,
                &[],
                &existing_input,
                &http_tool_call_cache,
            );
            let merged_len = merged.len();
            if let Some(obj) = body.as_object_mut() {
                obj.insert("input".to_string(), json!(merged));
                // 从历史 session 继承 instructions（如果本轮没带）
                if !obj.contains_key("instructions") && !session.instructions.is_empty() {
                    obj.insert("instructions".to_string(), json!(session.instructions));
                }
                // 继承 model（如果本轮没带）
                if !obj.contains_key("model") && !session.model.is_empty() {
                    obj.insert("model".to_string(), json!(session.model));
                }
            }
            tracing::debug!(
                "[MultiTurn] Restored session from prev_id={}, {} items in history",
                prev_id,
                merged_len
            );
        }
    }

    let is_codex_style = body.get("input").is_some() || body.get("instructions").is_some();

    // 1. Convert Payload to Messages (Shared Chat Format)
    if is_codex_style {
        let instructions = body
            .get("instructions")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let input_items = body.get("input").and_then(|v| v.as_array());
        let (interaction_ledger, mut step_markers) = codex_ledger_from_body(&body);

        let mut messages = Vec::new();

        // System Instructions
        if !instructions.is_empty() {
            messages.push(json!({ "role": "system", "content": instructions }));
        }

        let mut call_id_to_name = std::collections::HashMap::new();
        let mut skipped_incomplete_custom_call_ids = std::collections::HashSet::new();

        // Pass 1: Build Call ID to Name Map
        if let Some(items) = input_items {
            for item in items {
                let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
                if item_type == "custom_tool_call"
                    && item.get("status").and_then(|v| v.as_str()) == Some("incomplete")
                {
                    if let Some(call_id) = item
                        .get("call_id")
                        .and_then(|v| v.as_str())
                        .or_else(|| item.get("id").and_then(|v| v.as_str()))
                    {
                        skipped_incomplete_custom_call_ids.insert(call_id.to_string());
                    }
                    continue;
                }
                match item_type {
                    "function_call" | "custom_tool_call" | "local_shell_call"
                    | "web_search_call" => {
                        let call_id = item
                            .get("call_id")
                            .and_then(|v| v.as_str())
                            .or_else(|| item.get("id").and_then(|v| v.as_str()))
                            .unwrap_or("unknown");

                        let name = if item_type == "local_shell_call" {
                            "shell"
                        } else if item_type == "web_search_call" {
                            "google_search"
                        } else {
                            item.get("name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown")
                        };

                        call_id_to_name.insert(call_id.to_string(), name.to_string());
                        tracing::debug!("Mapped call_id {} to name {}", call_id, name);
                    }
                    _ => {}
                }
            }
        }

        let mut seen_apply_patch_failures = std::collections::HashSet::new();
        let mut apply_patch_failure_distinct_count = 0usize;

        // Pass 2: Map durable conversation items to Gemini messages. Visible
        // assistant commentary stays in Codex's local transcript and must not
        // be replayed as model history.
        if let Some(items) = input_items {
            for item in items {
                let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
                let step_marker = step_markers.pop_front();
                if item_type == "custom_tool_call"
                    && item.get("status").and_then(|v| v.as_str()) == Some("incomplete")
                {
                    continue;
                }
                match item_type {
                    "message" => {
                        let role = item.get("role").and_then(|v| v.as_str()).unwrap_or("user");
                        let content = item.get("content").and_then(|v| v.as_array());
                        let mut text_parts = Vec::new();
                        let mut image_parts: Vec<Value> = Vec::new();

                        if let Some(parts) = content {
                            for part in parts {
                                // 处理文本块
                                if let Some(text) = part.get("text").and_then(|v| v.as_str()) {
                                    text_parts.push(text.to_string());
                                }
                                // [NEW] 处理图像块 (Codex input_image 格式)
                                else if part.get("type").and_then(|v| v.as_str())
                                    == Some("input_image")
                                {
                                    if let Some(image_url) =
                                        part.get("image_url").and_then(|v| v.as_str())
                                    {
                                        image_parts.push(json!({
                                            "type": "image_url",
                                            "image_url": { "url": image_url }
                                        }));
                                        debug!("[Codex] Found input_image: {}", image_url);
                                    }
                                }
                                // [NEW] 兼容标准 OpenAI image_url 格式
                                else if part.get("type").and_then(|v| v.as_str())
                                    == Some("image_url")
                                {
                                    if let Some(url_obj) = part.get("image_url") {
                                        image_parts.push(json!({
                                            "type": "image_url",
                                            "image_url": url_obj.clone()
                                        }));
                                    }
                                }
                            }
                        }

                        let joined_text = text_parts.join("\n");
                        if is_codex_transcript_only_assistant_message(item, &joined_text) {
                            continue;
                        }

                        // 构造消息内容：如果有图像则使用数组格式
                        if image_parts.is_empty() {
                            let content = prefix_with_step_marker(step_marker, joined_text);
                            let message = json!({
                                "role": role,
                                "content": content
                            });
                            messages.push(message);
                        } else {
                            let mut content_blocks: Vec<Value> = Vec::new();
                            let marker_text = prefix_with_step_marker(step_marker, joined_text);
                            if !marker_text.is_empty() {
                                content_blocks.push(json!({
                                    "type": "text",
                                    "text": marker_text
                                }));
                            }
                            content_blocks.extend(image_parts);
                            let message = json!({
                                "role": role,
                                "content": content_blocks
                            });
                            messages.push(message);
                        }
                    }
                    "function_call" | "custom_tool_call" | "local_shell_call"
                    | "web_search_call" => {
                        let mut name = item
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown");
                        let mut args_str = item
                            .get("arguments")
                            .and_then(|v| v.as_str())
                            .unwrap_or("{}")
                            .to_string();
                        let call_id = item
                            .get("call_id")
                            .and_then(|v| v.as_str())
                            .or_else(|| item.get("id").and_then(|v| v.as_str()))
                            .unwrap_or("unknown");

                        // Handle native shell calls
                        if item_type == "custom_tool_call" {
                            if let Some(input) = item.get("input").and_then(|v| v.as_str()) {
                                args_str = serde_json::to_string(&json!({ "input": input }))
                                    .unwrap_or_else(|_| "{}".to_string());
                            }
                        } else if item_type == "local_shell_call" {
                            name = "shell";
                            if let Some(action) = item.get("action") {
                                if let Some(exec) = action.get("exec") {
                                    // Map to ShellCommandToolCallParams (string command) or ShellToolCallParams (array command)
                                    // Most LLMs prefer a single string for shell
                                    let mut args_obj = serde_json::Map::new();
                                    if let Some(cmd) = exec.get("command") {
                                        // CRITICAL FIX: The 'shell' tool schema defines 'command' as an ARRAY of strings.
                                        // We MUST pass it as an array, not a joined string, otherwise Gemini rejects with 400 INVALID_ARGUMENT.
                                        let cmd_val = if cmd.is_string() {
                                            json!([cmd]) // Wrap in array
                                        } else {
                                            cmd.clone() // Assume already array
                                        };
                                        args_obj.insert("command".to_string(), cmd_val);
                                    }
                                    if let Some(wd) =
                                        exec.get("working_directory").or(exec.get("workdir"))
                                    {
                                        args_obj.insert("workdir".to_string(), wd.clone());
                                    }
                                    args_str = serde_json::to_string(&args_obj)
                                        .unwrap_or("{}".to_string());
                                }
                            }
                        } else if item_type == "web_search_call" {
                            name = "google_search";
                            if let Some(action) = item.get("action") {
                                let mut args_obj = serde_json::Map::new();
                                if let Some(q) = action.get("query") {
                                    args_obj.insert("query".to_string(), q.clone());
                                }
                                args_str =
                                    serde_json::to_string(&args_obj).unwrap_or("{}".to_string());
                            }
                        }

                        let message = json!({
                            "role": "assistant",
                            "content": "",
                            "tool_calls": [
                                {
                                    "id": call_id,
                                    "type": "function",
                                    "function": {
                                        "name": name,
                                        "arguments": args_str
                                    }
                                }
                            ]
                        });
                        messages.push(message);
                    }
                    "function_call_output" | "custom_tool_call_output" => {
                        let call_id = item
                            .get("call_id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown");
                        if item_type == "custom_tool_call_output"
                            && skipped_incomplete_custom_call_ids.contains(call_id)
                        {
                            tracing::warn!(
                                "Skipping output for incomplete custom tool call {}",
                                call_id
                            );
                            continue;
                        }
                        let output = item.get("output");
                        let mut output_str = if let Some(o) = output {
                            if o.is_string() {
                                o.as_str().unwrap().to_string()
                            } else if let Some(content) = o.get("content").and_then(|v| v.as_str())
                            {
                                content.to_string()
                            } else {
                                o.to_string()
                            }
                        } else {
                            "".to_string()
                        };

                        let name = if let Some(name) = call_id_to_name.get(call_id).cloned() {
                            name
                        } else if item_type == "custom_tool_call_output" {
                            tracing::warn!(
                                "Skipping orphan custom_tool_call_output for unknown call_id {}",
                                call_id
                            );
                            continue;
                        } else {
                            tracing::warn!(
                                "Unknown function_call_output tool name for call_id {}, defaulting to 'shell'",
                                call_id
                            );
                            "shell".to_string()
                        };

                        if name == "apply_patch" {
                            output_str = compact_apply_patch_failure_output(
                                output_str,
                                &mut seen_apply_patch_failures,
                                &mut apply_patch_failure_distinct_count,
                            );
                        }
                        output_str = prefix_with_step_marker(step_marker, output_str);

                        messages.push(json!({
                            "role": "tool",
                            "tool_call_id": call_id,
                            "name": name,
                            "content": output_str
                        }));
                    }
                    _ => {}
                }
            }
        }
        if let Some(obj) = body.as_object_mut() {
            obj.insert("messages".to_string(), json!(messages));
            if let Some(ledger) = interaction_ledger {
                obj.insert("_interaction_ledger".to_string(), json!(ledger));
            }
        }
    } else if let Some(prompt_val) = body.get("prompt") {
        // Legacy OpenAI Style: prompt -> Chat
        let prompt_str = match prompt_val {
            Value::String(s) => s.clone(),
            Value::Array(arr) => arr
                .iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join("\n"),
            _ => prompt_val.to_string(),
        };
        let messages = json!([ { "role": "user", "content": prompt_str } ]);
        if let Some(obj) = body.as_object_mut() {
            obj.remove("prompt");
            obj.insert("messages".to_string(), messages);
        }
    }

    // 2. Reuse handle_chat_completions logic (wrapping with custom handler or direct call)
    // Actually, due to SSE handling differences (Codex uses different event format), we replicate the loop here or abstract it.
    // For now, let's replicate the core loop but with Codex specific SSE mapping.

    // [Fix Phase 2] Backport normalization logic from handle_chat_completions
    // Handle "instructions" + "input" (Codex style) -> system + user messages
    // This is critical because `transform_openai_request` expects `messages` to be populated.

    // [FIX] 检查是否已经有 messages (被第一次标准化处理过)
    let has_codex_fields = body.get("instructions").is_some() || body.get("input").is_some();
    let already_normalized = body
        .get("messages")
        .and_then(|m| m.as_array())
        .map(|arr| !arr.is_empty())
        .unwrap_or(false);

    // 只有在未标准化时才进行简单转换
    if has_codex_fields && !already_normalized {
        tracing::debug!("[Codex] Performing simple normalization (messages not yet populated)");

        let mut messages = Vec::new();

        // instructions -> system message
        if let Some(inst) = body.get("instructions").and_then(|v| v.as_str()) {
            if !inst.is_empty() {
                messages.push(json!({
                    "role": "system",
                    "content": inst
                }));
            }
        }

        // input -> user message (支持对象数组形式的对话历史)
        if let Some(input) = body.get("input") {
            if let Some(s) = input.as_str() {
                messages.push(json!({
                    "role": "user",
                    "content": s
                }));
            } else if let Some(arr) = input.as_array() {
                // 判断是消息对象数组还是简单的内容块/字符串数组
                let is_message_array = arr
                    .first()
                    .and_then(|v| v.as_object())
                    .map(|obj| obj.contains_key("role") || obj.contains_key("type"))
                    .unwrap_or(false);

                if is_message_array {
                    // 深度识别：像处理 messages 一样处理 input 数组，并自动映射 Responses API 的工具流
                    for item in arr {
                        if let Some(obj) = item.as_object() {
                            if let Some(item_type) = obj.get("type").and_then(|v| v.as_str()) {
                                match item_type {
                                    "message" => {
                                        let role = obj
                                            .get("role")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("user");
                                        let content =
                                            obj.get("content").cloned().unwrap_or(json!(""));
                                        messages.push(json!({ "role": role, "content": content }));
                                    }
                                    "function_call" | "custom_tool_call" => {
                                        let call_id = obj
                                            .get("call_id")
                                            .or_else(|| obj.get("id"))
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("");
                                        let name =
                                            obj.get("name").and_then(|v| v.as_str()).unwrap_or("");
                                        let mut arguments = obj
                                            .get("arguments")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("")
                                            .to_string();
                                        if item_type == "custom_tool_call" {
                                            if let Some(input) =
                                                obj.get("input").and_then(|v| v.as_str())
                                            {
                                                arguments = serde_json::to_string(
                                                    &json!({ "input": input }),
                                                )
                                                .unwrap_or_else(|_| "{}".to_string());
                                            }
                                        }
                                        messages.push(json!({
                                            "role": "assistant",
                                            "content": "",
                                            "tool_calls": [{
                                                "id": if call_id.is_empty() { "call_unknown" } else { call_id },
                                                "type": "function",
                                                "function": { "name": name, "arguments": arguments },
                                            }],
                                        }));
                                    }
                                    "function_call_output" | "custom_tool_call_output" => {
                                        let call_id = obj
                                            .get("call_id")
                                            .or_else(|| obj.get("tool_call_id"))
                                            .or_else(|| obj.get("id"))
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("");
                                        let output_value =
                                            obj.get("output").cloned().unwrap_or(json!(""));
                                        let output_str = if let Some(s) = output_value.as_str() {
                                            s.to_string()
                                        } else {
                                            output_value.to_string()
                                        };
                                        messages.push(json!({
                                            "role": "tool",
                                            "tool_call_id": call_id,
                                            "content": output_str,
                                        }));
                                    }
                                    _ => {
                                        messages.push(item.clone());
                                    }
                                }
                                continue;
                            }
                        }
                        messages.push(item.clone());
                    }
                } else {
                    // 降级处理：传统的字符串或混合内容拼接
                    let content = arr
                        .iter()
                        .map(|v| {
                            if let Some(s) = v.as_str() {
                                s.to_string()
                            } else if v.is_object() {
                                v.to_string()
                            } else {
                                "".to_string()
                            }
                        })
                        .collect::<Vec<_>>()
                        .join("\n");

                    if !content.is_empty() {
                        messages.push(json!({
                            "role": "user",
                            "content": content
                        }));
                    }
                }
            } else {
                let content = input.to_string();
                if !content.is_empty() {
                    messages.push(json!({
                        "role": "user",
                        "content": content
                    }));
                }
            };
        }

        if let Some(obj) = body.as_object_mut() {
            tracing::debug!(
                "[Codex] Injecting normalized messages: {} messages",
                messages.len()
            );
            obj.insert("messages".to_string(), json!(messages));
        }
    } else if already_normalized {
        tracing::debug!(
            "[Codex] Skipping normalization (messages already populated by first pass)"
        );
    }

    // [FIX] 在 openai_req 反序列化之前，从 body 中捕获原始 input 和 instructions
    // 用于后续 session 保存时，保留完整的工具调用历史（而非从 openai_req.messages 重建丢失信息）
    let session_save_input: Vec<serde_json::Value> = body
        .get("input")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let session_save_instructions: String = body
        .get("instructions")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let normalized_interaction_ledger = body.get("_interaction_ledger").cloned();

    if let Some(obj) = body.as_object_mut() {
        obj.remove("instructions");
    }

    let mut openai_req: OpenAIRequest = match serde_json::from_value(body.clone()) {
        Ok(req) => req,
        Err(e) => {
            return (StatusCode::BAD_REQUEST, format!("Invalid request: {}", e)).into_response();
        }
    };

    // Safety: Inject empty message if needed
    if openai_req.messages.is_empty() {
        openai_req
            .messages
            .push(crate::proxy::mappers::openai::OpenAIMessage {
                role: "user".to_string(),
                content: Some(crate::proxy::mappers::openai::OpenAIContent::String(
                    " ".to_string(),
                )),
                reasoning_content: None,
                tool_calls: None,
                tool_call_id: None,
                name: None,
                refusal: None,
            });
    }

    // [NEW v4.2.0] Context Management & Reasoning Replay
    let session_id_str = SessionManager::extract_openai_session_id(&openai_req);

    let client_tool_names =
        crate::proxy::mappers::openai::request::extract_client_tool_names(&openai_req.tools);

    crate::proxy::mappers::context_manager::ContextManager::restore_openai_reasoning_content(
        &mut openai_req.messages,
        &session_id_str,
    );

    let experimental_cfg = state.experimental.read().await;
    let compression_level = if experimental_cfg.compression_level == "disabled" {
        if experimental_cfg.enable_usage_scaling {
            "high".to_string()
        } else {
            "disabled".to_string()
        }
    } else {
        experimental_cfg.compression_level.clone()
    };

    let mapped_model = crate::proxy::common::model_mapping::resolve_model_route(
        &openai_req.model,
        &*state.custom_mapping.read().await,
    );
    let trace_id = format!("req_{}", chrono::Utc::now().timestamp_subsec_millis());
    if debug_logger::is_enabled(&debug_cfg) {
        if let Some(ledger) = normalized_interaction_ledger {
            let payload = json!({
                "kind": "normalized_interaction_ledger",
                "protocol": "openai",
                "trace_id": trace_id.clone(),
                "request_path": uri.path(),
                "original_model": openai_req.model.clone(),
                "interaction_ledger": ledger,
            });
            debug_logger::write_exchange_payload(
                &debug_cfg,
                Some(&trace_id),
                "normalized_interaction_ledger",
                &payload,
            )
            .await;
        }
    }
    let token_manager = state.token_manager.clone();

    let mut compression_applied = false;
    let mut is_purified = false;

    if compression_level == "high" {
        let context_limit = if mapped_model.contains("flash") {
            1_000_000
        } else {
            2_000_000
        };

        let raw_estimated =
            crate::proxy::mappers::context_manager::ContextManager::estimate_openai_token_usage(
                &openai_req,
            );
        let calibrator = crate::proxy::mappers::estimation_calibrator::get_calibrator();
        let mut estimated_usage = calibrator.calibrate(raw_estimated);
        let mut usage_ratio = estimated_usage as f32 / context_limit as f32;

        let threshold_l1 = experimental_cfg.context_compression_threshold_l1;
        let threshold_l2 = experimental_cfg.context_compression_threshold_l2;
        let threshold_l3 = experimental_cfg.context_compression_threshold_l3;

        tracing::info!(
            "[{}] [ContextManager] [OpenAI] Context pressure: {:.1}% (raw: {}, calibrated: {} / {}), Calibration factor: {:.2}",
            trace_id, usage_ratio * 100.0, raw_estimated, estimated_usage, context_limit, calibrator.get_factor()
        );

        // ===== Layer 1: Tool Message Trimming =====
        if usage_ratio > threshold_l1 && !compression_applied {
            if crate::proxy::mappers::context_manager::ContextManager::trim_openai_tool_messages(
                &mut openai_req.messages,
                5,
            ) {
                tracing::info!(
                    "[{}] [Layer-1] [OpenAI] Tool trimming triggered (usage: {:.1}%, threshold: {:.1}%)",
                    trace_id, usage_ratio * 100.0, threshold_l1 * 100.0
                );
                compression_applied = true;

                let new_raw = crate::proxy::mappers::context_manager::ContextManager::estimate_openai_token_usage(&openai_req);
                let new_usage = calibrator.calibrate(new_raw);
                let new_ratio = new_usage as f32 / context_limit as f32;

                tracing::info!(
                    "[{}] [Layer-1] [OpenAI] Compression result: {:.1}% → {:.1}% (saved {} tokens)",
                    trace_id,
                    usage_ratio * 100.0,
                    new_ratio * 100.0,
                    estimated_usage - new_usage
                );

                if new_ratio < 0.7 {
                    estimated_usage = new_usage;
                    usage_ratio = new_ratio;
                } else {
                    usage_ratio = new_ratio;
                    compression_applied = false;
                }
            }
        }

        // ===== Layer 2: Thinking Content Compression =====
        if usage_ratio > threshold_l2 && !compression_applied {
            tracing::info!(
                "[{}] [Layer-2] [OpenAI] Thinking compression triggered (usage: {:.1}%, threshold: {:.1}%)",
                trace_id, usage_ratio * 100.0, threshold_l2 * 100.0
            );

            if crate::proxy::mappers::context_manager::ContextManager::compress_openai_thinking_preserve_signature(
                &mut openai_req.messages,
                4,
            ) {
                is_purified = true;
                compression_applied = true;

                let new_raw = crate::proxy::mappers::context_manager::ContextManager::estimate_openai_token_usage(&openai_req);
                let new_usage = calibrator.calibrate(new_raw);
                let new_ratio = new_usage as f32 / context_limit as f32;

                tracing::info!(
                    "[{}] [Layer-2] [OpenAI] Compression result: {:.1}% → {:.1}% (saved {} tokens)",
                    trace_id, usage_ratio * 100.0, new_ratio * 100.0, estimated_usage - new_usage
                );

                usage_ratio = new_ratio;
            }
        }

        // ===== Layer 3: Fork Conversation + XML Summary =====
        if usage_ratio > threshold_l3 && !compression_applied {
            tracing::info!(
                "[{}] [Layer-3] [OpenAI] Context pressure ({:.1}%) exceeded threshold ({:.1}%), attempting Fork+Summary",
                trace_id, usage_ratio * 100.0, threshold_l3 * 100.0
            );

            let token_manager_clone = token_manager.clone();

            match try_compress_openai_with_summary(
                &openai_req,
                &trace_id,
                &token_manager_clone,
                &session_id_str,
            )
            .await
            {
                Ok(forked_req) => {
                    tracing::info!(
                        "[{}] [Layer-3] [OpenAI] Fork successful: {} → {} messages",
                        trace_id,
                        openai_req.messages.len(),
                        forked_req.messages.len()
                    );

                    openai_req = forked_req;
                    is_purified = false;

                    let new_raw = crate::proxy::mappers::context_manager::ContextManager::estimate_openai_token_usage(&openai_req);
                    let new_usage = calibrator.calibrate(new_raw);
                    let new_ratio = new_usage as f32 / context_limit as f32;

                    tracing::info!(
                        "[{}] [Layer-3] [OpenAI] Compression result: {:.1}% → {:.1}% (saved {} tokens)",
                        trace_id, usage_ratio * 100.0, new_ratio * 100.0, estimated_usage - new_usage
                    );
                }
                Err(e) => {
                    tracing::error!(
                        "[{}] [Layer-3] [OpenAI] Fork+Summary failed: {}, falling back to error response",
                        trace_id, e
                    );
                    return (
                        StatusCode::BAD_REQUEST,
                        format!("Context too long and automatic compression failed: {}", e),
                    )
                        .into_response();
                }
            }
        }
    } else if compression_level != "disabled" {
        if crate::proxy::mappers::context_manager::ContextManager::trim_openai_tool_messages(
            &mut openai_req.messages,
            5,
        ) {
            tracing::info!("[Codex-Context] Trimmed old tool messages to keep last 5 rounds");
        }

        if compression_level == "medium" {
            if crate::proxy::mappers::context_manager::ContextManager::purify_openai_history(
                &mut openai_req.messages,
                crate::proxy::mappers::context_manager::PurificationStrategy::Soft,
            ) {
                tracing::info!("[Codex-Context] Purified older assistant reasoning_content and natural language history");
            }
        }
    }

    let assistant_turn_index = openai_req
        .messages
        .iter()
        .filter(|m| m.role == "assistant")
        .count();

    let upstream = state.upstream.clone();
    let pool_size = token_manager.len();
    // [FIX] Ensure max_attempts is at least 2 to allow for internal retries
    let max_attempts = MAX_RETRY_ATTEMPTS.min(pool_size.saturating_add(1)).max(2);

    let mut last_error = String::new();
    let mut last_email: Option<String> = None;

    if debug_logger::is_enabled(&debug_cfg) {
        let payload = json!({
            "kind": "original_request",
            "protocol": "openai",
            "trace_id": trace_id,
            "request_path": uri.path(),
            "request": original_body,
        });
        debug_logger::write_exchange_payload(
            &debug_cfg,
            Some(&trace_id),
            "original_request",
            &payload,
        )
        .await;
    }

    let mut force_rotate = false;

    for attempt in 0..max_attempts {
        // 3. 模型配置解析
        // 将 OpenAI 工具转为 Value 数组以便探测联网
        let tools_val: Option<Vec<Value>> = openai_req
            .tools
            .as_ref()
            .map(|list| list.iter().cloned().collect());
        let config = crate::proxy::mappers::common_utils::resolve_request_config(
            &openai_req.model,
            &mapped_model,
            &tools_val,
            None, // size
            None, // quality
            None, // image_size
            None, // body
        );

        // 3. 提取 SessionId (复用)
        // [New] 使用 TokenManager 内部逻辑提取 session_id，支持粘性调度
        let session_id_str = SessionManager::extract_openai_session_id(&openai_req);
        let session_id = Some(session_id_str.as_str());

        let (access_token, project_id, email, account_id, _wait_ms) = match token_manager
            .get_token(
                &config.request_type,
                force_rotate,
                session_id,
                &mapped_model,
            )
            .await
        {
            Ok(t) => t,
            Err(e) => {
                return (
                    StatusCode::SERVICE_UNAVAILABLE,
                    [("X-Mapped-Model", mapped_model)],
                    format!("Token error: {}", e),
                )
                    .into_response()
            }
        };

        let mapped_model = token_manager
            .resolve_dynamic_model_for_account(&account_id, &mapped_model)
            .await;

        last_email = Some(email.clone());

        info!("✓ Using account: {} (type: {})", email, config.request_type);

        let proxy_token = token_manager.get_token_by_id(&account_id);
        let (gemini_body, session_id, message_count, _prefix_hash) = transform_openai_request(
            &openai_req,
            &project_id,
            &mapped_model,
            proxy_token.as_ref(),
        );
        let gemini_body_for_debug = gemini_body.clone();
        if debug_logger::is_enabled(&debug_cfg) {
            let payload = json!({
                "kind": "v1internal_request",
                "protocol": "openai",
                "trace_id": trace_id,
                "request_path": uri.path(),
                "original_model": openai_req.model,
                "mapped_model": mapped_model,
                "request_type": config.request_type,
                "attempt": attempt,
                "v1internal_request": gemini_body_for_debug.clone(),
            });
            debug_logger::write_exchange_payload(
                &debug_cfg,
                Some(&trace_id),
                "v1internal_request",
                &payload,
            )
            .await;
        }

        // [DEBUG v4.2.0] Detailed size analysis of Gemini request body
        if let Some(contents) = gemini_body.get("contents").and_then(|c| c.as_array()) {
            let mut sizes = Vec::new();
            for (idx, msg) in contents.iter().enumerate() {
                let role = msg
                    .get("role")
                    .and_then(|r| r.as_str())
                    .unwrap_or("unknown");
                let msg_str = serde_json::to_string(msg).unwrap_or_default();
                sizes.push(format!("msg_{}[{}]: {} chars", idx, role, msg_str.len()));
            }

            let system_instruction_len = gemini_body
                .get("request")
                .and_then(|r| r.get("systemInstruction"))
                .map(|s| serde_json::to_string(s).unwrap_or_default().len())
                .unwrap_or(0);

            let tools_len = gemini_body
                .get("request")
                .and_then(|r| r.get("tools"))
                .map(|t| serde_json::to_string(t).unwrap_or_default().len())
                .unwrap_or(0);

            tracing::info!(
                "[Codex-Token-Analysis] Total parts: {}. SystemInstruction: {} chars, Tools: {} chars. Content sizes: {:?}",
                contents.len(),
                system_instruction_len,
                tools_len,
                sizes
            );
        }

        // [AUTO-CONVERSION] For Legacy/Codex as well
        let client_wants_stream = openai_req.stream;
        let force_stream_internally = !client_wants_stream;
        let list_response = client_wants_stream || force_stream_internally;
        let method = if list_response {
            "streamGenerateContent"
        } else {
            "generateContent"
        };
        let query_string = if list_response { Some("alt=sse") } else { None };

        let call_result = match upstream
            .call_v1_internal(
                method,
                &access_token,
                gemini_body,
                query_string,
                Some(account_id.as_str()),
            )
            .await
        {
            Ok(r) => r,
            Err(e) => {
                last_error = e.clone();
                debug!(
                    "Codex Request failed on attempt {}/{}: {}",
                    attempt + 1,
                    max_attempts,
                    e
                );
                continue;
            }
        };

        let response = call_result.response;
        let upstream_url = response.url().to_string();
        let status = response.status();
        if status.is_success() {
            // [智能限流] 请求成功，重置该账号的连续失败计数
            token_manager.mark_account_success(&email);

            if list_response {
                use axum::body::Body;
                use axum::response::Response;
                use futures::StreamExt;

                let upstream_meta = json!({
                    "protocol": "openai",
                    "trace_id": trace_id,
                    "request_path": uri.path(),
                    "original_model": openai_req.model,
                    "mapped_model": mapped_model,
                    "request_type": config.request_type,
                    "attempt": attempt,
                    "status": status.as_u16(),
                    "upstream_url": upstream_url,
                });
                let gemini_stream = debug_logger::wrap_stream_with_debug(
                    Box::pin(response.bytes_stream()),
                    debug_cfg.clone(),
                    trace_id.clone(),
                    "upstream_response",
                    upstream_meta,
                );

                // DECISION: Which stream to create?
                // If client wants stream: give them what they asked (Legacy/Codex SSE).
                // If forced stream: use Chat SSE + Collector, because our collector works on Chat format
                // and we already have logic to convert Chat JSON -> Legacy JSON.

                if client_wants_stream {
                    let mut openai_stream = if is_codex_style {
                        use crate::proxy::mappers::openai::streaming::create_codex_sse_stream;
                        create_codex_sse_stream(
                            gemini_stream,
                            openai_req.model.clone(),
                            session_id,
                            message_count,
                            assistant_turn_index,
                        )
                    } else {
                        use crate::proxy::mappers::openai::streaming::create_legacy_sse_stream;
                        create_legacy_sse_stream(
                            gemini_stream,
                            openai_req.model.clone(),
                            session_id,
                            message_count,
                        )
                    };

                    // [P1 FIX] Enhanced Peek logic (Reused from above/standard)
                    let mut first_data_chunk = None;
                    let mut retry_this_account = false;

                    loop {
                        match tokio::time::timeout(
                            std::time::Duration::from_secs(60),
                            openai_stream.next(),
                        )
                        .await
                        {
                            Ok(Some(Ok(bytes))) => {
                                if bytes.is_empty() {
                                    continue;
                                }
                                let text = String::from_utf8_lossy(&bytes);
                                if text.trim().starts_with(":")
                                    || text.trim().starts_with("data: :")
                                {
                                    continue;
                                }
                                if stream_chunk_has_error_event(&bytes) {
                                    last_error = "Error event during peek".to_string();
                                    retry_this_account = true;
                                    break;
                                }
                                first_data_chunk = Some(bytes);
                                break;
                            }
                            Ok(Some(Err(e))) => {
                                last_error = format!("Stream error during peek: {}", e);
                                retry_this_account = true;
                                break;
                            }
                            Ok(None) => {
                                last_error = "Empty response stream".to_string();
                                retry_this_account = true;
                                break;
                            }
                            Err(_) => {
                                last_error = "Timeout waiting for first data".to_string();
                                retry_this_account = true;
                                break;
                            }
                        }
                    }

                    if retry_this_account {
                        continue;
                    }

                    let combined_stream = futures::stream::once(async move {
                        Ok::<Bytes, String>(first_data_chunk.unwrap())
                    })
                    .chain(openai_stream);
                    let converted_meta = json!({
                        "protocol": "openai",
                        "trace_id": trace_id,
                        "stage": "converted_codex_response",
                        "request_path": uri.path(),
                        "original_model": openai_req.model,
                        "mapped_model": mapped_model,
                        "request_type": config.request_type,
                        "attempt": attempt,
                        "status": status.as_u16(),
                        "upstream_url": upstream_url,
                    });
                    let combined_stream = debug_logger::wrap_stream_with_debug(
                        Box::pin(combined_stream),
                        debug_cfg.clone(),
                        trace_id.clone(),
                        "converted_codex_response",
                        converted_meta,
                    );

                    // [MULTI-TURN][FIX] 保存本次完整 input_items 到 session store
                    // 使用从 body 中提取的原始 input（含文本/工具调用/工具结果全量历史），
                    // 而非从 openai_req.messages 重建（会丢失 tool_calls/tool 角色等信息）
                    {
                        let save_input = session_save_input.clone();
                        let save_instructions = session_save_instructions.clone();
                        let save_model = openai_req.model.clone();
                        let entry = crate::proxy::http_session_store::HttpSessionEntry {
                            input_items: save_input,
                            instructions: save_instructions,
                            model: save_model,
                            last_accessed: std::time::Instant::now(),
                        };
                        let rid = response_id_for_save.clone();
                        tokio::spawn(async move {
                            crate::proxy::http_session_store::save_session(rid, entry).await;
                        });
                    }
                    return Response::builder()
                        .header("Content-Type", "text/event-stream")
                        .header("Cache-Control", "no-cache")
                        .header("Connection", "keep-alive")
                        .header("X-Account-Email", &email)
                        .header("X-Mapped-Model", &mapped_model)
                        .body(Body::from_stream(combined_stream))
                        .unwrap()
                        .into_response();
                } else {
                    // Forced Stream Internal -> Convert to Legacy JSON
                    // Use CHAT SSE Stream (so Collector can parse it)
                    use crate::proxy::mappers::openai::streaming::create_openai_sse_stream;
                    // Note: We use create_openai_sse_stream regardless of is_codex_style here,
                    // because we just want the content aggregation which chat stream does well.
                    let mut openai_stream = create_openai_sse_stream(
                        gemini_stream,
                        openai_req.model.clone(),
                        session_id,
                        message_count,
                        Some(client_tool_names.clone()),
                    );

                    // Peek Logic (Repeated for safety/correctness on this stream type)
                    let mut first_data_chunk = None;
                    let mut retry_this_account = false;
                    loop {
                        match tokio::time::timeout(
                            std::time::Duration::from_secs(60),
                            openai_stream.next(),
                        )
                        .await
                        {
                            Ok(Some(Ok(bytes))) => {
                                if bytes.is_empty() {
                                    continue;
                                }
                                let text = String::from_utf8_lossy(&bytes);
                                if text.trim().starts_with(":")
                                    || text.trim().starts_with("data: :")
                                {
                                    continue;
                                }
                                if stream_chunk_has_error_event(&bytes) {
                                    last_error = "Error event in internal stream".to_string();
                                    retry_this_account = true;
                                    break;
                                }
                                first_data_chunk = Some(bytes);
                                break;
                            }
                            Ok(Some(Err(e))) => {
                                last_error = format!("Internal stream error: {}", e);
                                retry_this_account = true;
                                break;
                            }
                            Ok(None) => {
                                last_error = "Empty internal stream".to_string();
                                retry_this_account = true;
                                break;
                            }
                            Err(_) => {
                                last_error = "Timeout peek internal".to_string();
                                retry_this_account = true;
                                break;
                            }
                        }
                    }
                    if retry_this_account {
                        continue;
                    }

                    let combined_stream = futures::stream::once(async move {
                        Ok::<Bytes, String>(first_data_chunk.unwrap())
                    })
                    .chain(openai_stream);
                    let converted_meta = json!({
                        "protocol": "openai",
                        "trace_id": trace_id,
                        "stage": "converted_codex_response",
                        "request_path": uri.path(),
                        "original_model": openai_req.model,
                        "mapped_model": mapped_model,
                        "request_type": config.request_type,
                        "attempt": attempt,
                        "status": status.as_u16(),
                        "upstream_url": upstream_url,
                    });
                    let combined_stream = debug_logger::wrap_stream_with_debug(
                        Box::pin(combined_stream),
                        debug_cfg.clone(),
                        trace_id.clone(),
                        "converted_codex_response",
                        converted_meta,
                    );

                    // Collect
                    use crate::proxy::mappers::openai::collector::collect_stream_to_json;
                    match collect_stream_to_json(combined_stream).await {
                        Ok(chat_resp) => {
                            let is_responses_api = uri.path() == "/v1/responses";

                            if is_responses_api {
                                let mut output = Vec::new();
                                for c in chat_resp.choices.iter() {
                                    let text = match &c.message.content {
                                        Some(
                                            crate::proxy::mappers::openai::OpenAIContent::String(s),
                                        ) => s.clone(),
                                        _ => "".to_string(),
                                    };

                                    let has_content = !text.is_empty();
                                    let has_tools = c.message.tool_calls.is_some()
                                        && !c.message.tool_calls.as_ref().unwrap().is_empty();

                                    if has_content || has_tools {
                                        let mut msg_obj = serde_json::Map::new();
                                        msg_obj.insert("type".to_string(), json!("message"));
                                        msg_obj.insert("role".to_string(), json!("assistant"));

                                        if has_content {
                                            msg_obj.insert("content".to_string(), json!(text));
                                        }
                                        if let Some(tool_calls) = &c.message.tool_calls {
                                            msg_obj.insert(
                                                "tool_calls".to_string(),
                                                json!(tool_calls),
                                            );
                                        }
                                        output.push(serde_json::Value::Object(msg_obj));
                                    }
                                }

                                // Calculate usage if available
                                let usage_value = if let Some(ref usage) = chat_resp.usage {
                                    usage.to_responses_usage_value()
                                } else {
                                    json!({
                                        "input_tokens": 0,
                                        "input_tokens_details": {
                                            "cached_tokens": 0
                                        },
                                        "output_tokens": 0,
                                        "output_tokens_details": {
                                            "reasoning_tokens": 0
                                        },
                                        "total_tokens": 0
                                    })
                                };

                                let resp = json!({
                                    "type": "response",
                                    "id": format!("resp_{}", uuid::Uuid::new_v4().simple()),
                                    "status": "completed",
                                    "output": output,
                                    "usage": usage_value
                                });
                                if debug_logger::is_enabled(&debug_cfg) {
                                    let payload = json!({
                                        "kind": "exchange_summary",
                                        "protocol": "openai",
                                        "trace_id": trace_id,
                                        "request_path": uri.path(),
                                        "original_codex_request": original_body.clone(),
                                        "gemini_request": gemini_body_for_debug.clone(),
                                        "converted_codex_response": resp.clone(),
                                        "gemini_raw_response_ref": "see upstream_response file with the same trace_id",
                                    });
                                    debug_logger::write_exchange_payload(
                                        &debug_cfg,
                                        Some(&trace_id),
                                        "exchange_summary",
                                        &payload,
                                    )
                                    .await;
                                }

                                return (
                                    StatusCode::OK,
                                    [
                                        ("X-Account-Email", email.as_str()),
                                        ("X-Mapped-Model", mapped_model.as_str()),
                                    ],
                                    Json(resp),
                                )
                                    .into_response();
                            }

                            // NOW: Convert Chat Response -> Legacy Response (Same logic as below)
                            let choices = chat_resp
                                .choices
                                .iter()
                                .map(|c| {
                                    let mut text = match &c.message.content {
                                        Some(
                                            crate::proxy::mappers::openai::OpenAIContent::String(s),
                                        ) => s.clone(),
                                        _ => "".to_string(),
                                    };
                                    if let Some(ref reasoning) = c.message.reasoning_content {
                                        if !reasoning.is_empty() {
                                            text = format!("{}\n\n{}", reasoning, text);
                                        }
                                    }
                                    json!({
                                        "text": text,
                                        "index": c.index,
                                        "logprobs": null,
                                        "finish_reason": c.finish_reason
                                    })
                                })
                                .collect::<Vec<_>>();

                            let legacy_resp = json!({
                                "id": chat_resp.id,
                                "object": "text_completion",
                                "created": chat_resp.created,
                                "model": chat_resp.model,
                                "choices": choices,
                                "usage": chat_resp.usage
                            });
                            if debug_logger::is_enabled(&debug_cfg) {
                                let payload = json!({
                                    "kind": "exchange_summary",
                                    "protocol": "openai",
                                    "trace_id": trace_id,
                                    "request_path": uri.path(),
                                    "original_codex_request": original_body.clone(),
                                    "gemini_request": gemini_body_for_debug.clone(),
                                    "converted_codex_response": legacy_resp.clone(),
                                    "gemini_raw_response_ref": "see upstream_response file with the same trace_id",
                                });
                                debug_logger::write_exchange_payload(
                                    &debug_cfg,
                                    Some(&trace_id),
                                    "exchange_summary",
                                    &payload,
                                )
                                .await;
                            }

                            return (
                                StatusCode::OK,
                                [
                                    ("X-Account-Email", email.as_str()),
                                    ("X-Mapped-Model", mapped_model.as_str()),
                                ],
                                Json(legacy_resp),
                            )
                                .into_response();
                        }
                        Err(e) => {
                            return (
                                StatusCode::INTERNAL_SERVER_ERROR,
                                format!("Stream collection error: {}", e),
                            )
                                .into_response();
                        }
                    }
                }
            }

            let gemini_resp: Value = match response.json().await {
                Ok(json) => json,
                Err(e) => {
                    return (
                        StatusCode::BAD_GATEWAY,
                        [("X-Mapped-Model", mapped_model.as_str())],
                        format!("Parse error: {}", e),
                    )
                        .into_response();
                }
            };

            let chat_resp = transform_openai_response(
                &gemini_resp,
                Some("session-123"),
                1,
                Some(&client_tool_names),
            );

            let is_responses_api = uri.path() == "/v1/responses";

            if is_responses_api {
                let mut output = Vec::new();
                for c in chat_resp.choices.iter() {
                    let text = match &c.message.content {
                        Some(crate::proxy::mappers::openai::OpenAIContent::String(s)) => s.clone(),
                        _ => "".to_string(),
                    };

                    let has_content = !text.is_empty();
                    let has_tools = c.message.tool_calls.is_some()
                        && !c.message.tool_calls.as_ref().unwrap().is_empty();

                    if has_content || has_tools {
                        let mut msg_obj = serde_json::Map::new();
                        msg_obj.insert("type".to_string(), json!("message"));
                        msg_obj.insert("role".to_string(), json!("assistant"));

                        if has_content {
                            msg_obj.insert("content".to_string(), json!(text));
                        }
                        if let Some(tool_calls) = &c.message.tool_calls {
                            msg_obj.insert("tool_calls".to_string(), json!(tool_calls));
                        }
                        output.push(serde_json::Value::Object(msg_obj));
                    }
                }

                // Calculate usage if available
                let usage_value = if let Some(ref usage) = chat_resp.usage {
                    usage.to_responses_usage_value()
                } else {
                    json!({
                        "input_tokens": 0,
                        "input_tokens_details": {
                            "cached_tokens": 0
                        },
                        "output_tokens": 0,
                        "output_tokens_details": {
                            "reasoning_tokens": 0
                        },
                        "total_tokens": 0
                    })
                };

                let resp = json!({
                    "type": "response",
                    "id": format!("resp_{}", uuid::Uuid::new_v4().simple()),
                    "status": "completed",
                    "output": output,
                    "usage": usage_value
                });
                if debug_logger::is_enabled(&debug_cfg) {
                    let payload = json!({
                        "kind": "exchange_summary",
                        "protocol": "openai",
                        "trace_id": trace_id,
                        "request_path": uri.path(),
                        "original_codex_request": original_body.clone(),
                        "gemini_request": gemini_body_for_debug.clone(),
                        "gemini_raw_response": gemini_resp.clone(),
                        "converted_codex_response": resp.clone(),
                    });
                    debug_logger::write_exchange_payload(
                        &debug_cfg,
                        Some(&trace_id),
                        "exchange_summary",
                        &payload,
                    )
                    .await;
                }

                return (
                    StatusCode::OK,
                    [
                        ("X-Account-Email", email.as_str()),
                        ("X-Mapped-Model", mapped_model.as_str()),
                    ],
                    Json(resp),
                )
                    .into_response();
            }

            // Map Chat Response -> Legacy Completions Response
            let choices = chat_resp.choices.iter().map(|c| {
                json!({
                    "text": match &c.message.content {
                        Some(crate::proxy::mappers::openai::OpenAIContent::String(s)) => s.clone(),
                        _ => "".to_string()
                    },
                    "index": c.index,
                    "logprobs": null,
                    "finish_reason": c.finish_reason
                })
            }).collect::<Vec<_>>();

            let legacy_resp = json!({
                "id": chat_resp.id,
                "object": "text_completion",
                "created": chat_resp.created,
                "model": chat_resp.model,
                "choices": choices,
                "usage": chat_resp.usage
            });
            if debug_logger::is_enabled(&debug_cfg) {
                let payload = json!({
                    "kind": "exchange_summary",
                    "protocol": "openai",
                    "trace_id": trace_id,
                    "request_path": uri.path(),
                    "original_codex_request": original_body.clone(),
                    "gemini_request": gemini_body_for_debug.clone(),
                    "gemini_raw_response": gemini_resp.clone(),
                    "converted_codex_response": legacy_resp.clone(),
                });
                debug_logger::write_exchange_payload(
                    &debug_cfg,
                    Some(&trace_id),
                    "exchange_summary",
                    &payload,
                )
                .await;
            }

            return (
                StatusCode::OK,
                [
                    ("X-Account-Email", email.as_str()),
                    ("X-Mapped-Model", mapped_model.as_str()),
                ],
                Json(legacy_resp),
            )
                .into_response();
        }

        // Handle errors and retry
        let status_code = status.as_u16();
        let retry_after = response
            .headers()
            .get("Retry-After")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string());
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| format!("HTTP {}", status_code));
        last_error = format!("HTTP {}: {}", status_code, error_text);

        tracing::error!(
            "[Codex-Upstream] Error Response {}: {}",
            status_code,
            error_text
        );

        // 3. 标记限流状态(用于 UI 显示)
        if status_code == 429 || status_code == 529 || status_code == 503 || status_code == 500 {
            token_manager
                .mark_rate_limited_async(
                    &email,
                    status_code,
                    retry_after.as_deref(),
                    &error_text,
                    Some(&mapped_model),
                )
                .await;
        }

        // 确定重试策略
        // 确定重试策略 (对齐官方 1.5s Grace Window)
        let strategy = determine_retry_strategy(status_code, &error_text, false);

        // 执行退备
        if apply_retry_strategy(
            strategy.clone(),
            attempt,
            max_attempts,
            status_code,
            &trace_id,
        )
        .await
        {
            // 继续重试 (loop 会增加 attempt, 导致 force_rotate=true)
            continue;
        } else {
            // 不可重试
            return (
                status,
                [
                    ("X-Account-Email", email.as_str()),
                    ("X-Mapped-Model", mapped_model.as_str()),
                ],
                error_text,
            )
                .into_response();
        }
    }

    // 所有尝试均失败
    if let Some(email) = last_email {
        (
            StatusCode::TOO_MANY_REQUESTS,
            [("X-Account-Email", email), ("X-Mapped-Model", mapped_model)],
            format!("All accounts exhausted. Last error: {}", last_error),
        )
            .into_response()
    } else {
        (
            StatusCode::TOO_MANY_REQUESTS,
            [("X-Mapped-Model", mapped_model)],
            format!("All accounts exhausted. Last error: {}", last_error),
        )
            .into_response()
    }
}

pub async fn call_openai_gemini_sync(
    model: &str,
    request: &OpenAIRequest,
    token_manager: &std::sync::Arc<crate::proxy::TokenManager>,
    trace_id: &str,
) -> Result<String, String> {
    let (access_token, project_id, _, account_id, _wait_ms) = token_manager
        .get_token("gemini", false, None, model)
        .await
        .map_err(|e| format!("Failed to get account: {}", e))?;

    let token_obj = token_manager.get_token_by_id(&account_id);
    let session_id = format!("bg_sid_{}", chrono::Utc::now().timestamp_subsec_millis());
    let (gemini_body, _, _, _) =
        transform_openai_request(request, &project_id, &session_id, token_obj.as_ref());

    let upstream_url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
        model
    );

    debug!("[{}] [OpenAI-BG] Calling Gemini API: {}", trace_id, model);

    let response = reqwest::Client::new()
        .post(&upstream_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .json(&gemini_body)
        .send()
        .await
        .map_err(|e| format!("API call failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "API returned {}: {}",
            response.status(),
            response.text().await.unwrap_or_default()
        ));
    }

    let gemini_response: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    gemini_response
        .get("candidates")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("content"))
        .and_then(|c| c.get("parts"))
        .and_then(|p| p.get(0))
        .and_then(|p| p.get("text"))
        .and_then(|t| t.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to extract text from response".to_string())
}

pub async fn try_compress_openai_with_summary(
    original_request: &OpenAIRequest,
    trace_id: &str,
    token_manager: &std::sync::Arc<crate::proxy::TokenManager>,
    session_id_str: &str,
) -> Result<OpenAIRequest, String> {
    info!(
        "[{}] [Layer-3] [OpenAI] Starting context compression with XML summary",
        trace_id
    );

    let last_signature =
        crate::proxy::mappers::context_manager::ContextManager::extract_last_openai_valid_signature(
            session_id_str,
        );

    if let Some(ref sig) = last_signature {
        debug!(
            "[{}] [Layer-3] [OpenAI] Extracted signature (len: {})",
            trace_id,
            sig.len()
        );
    }

    let mut summary_messages = original_request.messages.clone();

    let signature_instruction = if let Some(ref sig) = last_signature {
        format!("\n\n**CRITICAL**: The last thinking signature is:\n```\n{}\n```\nYou MUST include this EXACTLY in the <latest_thinking_signature> section.", sig)
    } else {
        "\n\n**Note**: No thinking signature found in history. Leave <latest_thinking_signature> empty.".to_string()
    };

    summary_messages.push(OpenAIMessage {
        role: "user".to_string(),
        content: Some(
            crate::proxy::mappers::openai::models::OpenAIContent::String(format!(
                "{}{}",
                CONTEXT_SUMMARY_PROMPT, signature_instruction
            )),
        ),
        refusal: None,
        reasoning_content: None,
        tool_calls: None,
        tool_call_id: None,
        name: None,
    });

    let mut summary_request = original_request.clone();
    summary_request.messages = summary_messages;
    summary_request.model = INTERNAL_BACKGROUND_TASK.to_string();
    summary_request.stream = false;
    summary_request.max_tokens = Some(8000);
    summary_request.temperature = Some(0.3);

    debug!(
        "[{}] [Layer-3] [OpenAI] Calling {} for summary generation",
        trace_id, INTERNAL_BACKGROUND_TASK
    );

    let xml_summary = call_openai_gemini_sync(
        INTERNAL_BACKGROUND_TASK,
        &summary_request,
        token_manager,
        trace_id,
    )
    .await?;

    info!(
        "[{}] [Layer-3] [OpenAI] Generated XML summary (len: {} chars)",
        trace_id,
        xml_summary.len()
    );

    let mut forked_messages = vec![
        OpenAIMessage {
            role: "user".to_string(),
            content: Some(crate::proxy::mappers::openai::models::OpenAIContent::String(format!(
                "Context has been compressed. Here is the structured summary of our conversation history:\n\n{}",
                xml_summary
            ))),
            refusal: None,
            reasoning_content: None,
            tool_calls: None,
            tool_call_id: None,
            name: None,
        },
        OpenAIMessage {
            role: "assistant".to_string(),
            content: Some(crate::proxy::mappers::openai::models::OpenAIContent::String(
                "I have reviewed the compressed context summary. I understand the current state and will continue from here.".to_string()
            )),
            refusal: None,
            reasoning_content: None,
            tool_calls: None,
            tool_call_id: None,
            name: None,
        },
    ];

    if let Some(last_msg) = original_request.messages.last() {
        if last_msg.role == "user" {
            if !matches!(&last_msg.content, Some(crate::proxy::mappers::openai::models::OpenAIContent::String(s)) if s.contains(CONTEXT_SUMMARY_PROMPT))
            {
                forked_messages.push(last_msg.clone());
            }
        }
    }

    let mut forked_request = original_request.clone();
    forked_request.messages = forked_messages;
    Ok(forked_request)
}

