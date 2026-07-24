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

pub async fn handle_chat_completions(
    State(state): State<AppState>,
    headers: HeaderMap, // [CHANGED] Extract headers
    Json(mut body): Json<Value>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // [NEW] Check for Image Model Redirection
    let model_name = body
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    // [FIX] Only redirect non-native image aliases (dall-e / midjourney) to the
    // images-generations shim. Native Gemini image models (gemini-3-pro-image*) must
    // flow through the normal pipeline (transform_openai_request -> resolve_request_config),
    // which correctly sets requestType=image_gen, imageConfig (size/aspect ratio), sessionId,
    // structured requestId and per-account dynamic model resolution — matching the official
    // Antigravity client. The old shim dropped `size` and built a divergent upstream body,
    // which caused image generation to silently fail for gemini-3-pro-image.
    if (model_name.contains("image")
        || model_name.contains("dall-e")
        || model_name.contains("midjourney"))
        && !model_name.contains("gemini")
    {
        tracing::info!(
            "[ChatRedirection] Redirecting model {} to image generations",
            model_name
        );
        return intercept_chat_to_image(state, body, &model_name).await;
    }

    // [FIX] 保存原始请求体的完整副本，用于日志记录
    // 这确保了即使结构体定义遗漏字段，日志也能完整记录所有参数
    let original_body = body.clone();

    // [NEW] 自动检测并转换 Responses 格式
    // 如果请求包含 instructions 或 input 但没有 messages，则认为是 Responses 格式
    let is_responses_format = !body.get("messages").is_some()
        && (body.get("instructions").is_some() || body.get("input").is_some());

    if is_responses_format {
        debug!("Detected Responses API format, converting to Chat Completions format");

        // 转换 instructions 为 system message
        if let Some(instructions) = body.get("instructions").and_then(|v| v.as_str()) {
            if !instructions.is_empty() {
                let system_msg = json!({
                    "role": "system",
                    "content": instructions
                });

                // 初始化 messages 数组
                if !body.get("messages").is_some() {
                    body["messages"] = json!([]);
                }

                // 将 system message 插入到开头
                if let Some(messages) = body.get_mut("messages").and_then(|v| v.as_array_mut()) {
                    messages.insert(0, system_msg);
                }
            }
        }

        // 转换 input 为 user message（如果存在）
        if let Some(input) = body.get("input") {
            let user_msg = if input.is_string() {
                json!({
                    "role": "user",
                    "content": input.as_str().unwrap_or("")
                })
            } else {
                // input 是数组格式，暂时简化处理
                json!({
                    "role": "user",
                    "content": input.to_string()
                })
            };

            if let Some(messages) = body.get_mut("messages").and_then(|v| v.as_array_mut()) {
                messages.push(user_msg);
            }
        }

        if let Some(obj) = body.as_object_mut() {
            obj.remove("instructions");
        }
    }

    let normalized_interaction_ledger = body.get("_interaction_ledger").cloned();
    let mut openai_req: OpenAIRequest = serde_json::from_value(body)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid request: {}", e)))?;

    // Safety: Ensure messages is not empty
    if openai_req.messages.is_empty() {
        debug!("Received request with empty messages, injecting fallback...");
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

    let trace_id = format!("req_{}", chrono::Utc::now().timestamp_subsec_millis());
    info!(
        "[{}] OpenAI Chat Request: {} | {} messages | stream: {}",
        trace_id,
        openai_req.model,
        openai_req.messages.len(),
        openai_req.stream
    );
    let debug_cfg = state.debug_logging.read().await.clone();

    let mut force_rotate = false;

    if debug_logger::is_enabled(&debug_cfg) {
        if let Some(ledger) = normalized_interaction_ledger {
            let payload = json!({
                "kind": "normalized_interaction_ledger",
                "protocol": "openai",
                "trace_id": trace_id.clone(),
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

        // [FIX] 使用原始 body 副本记录日志，确保不丢失任何字段
        let original_payload = json!({
            "kind": "original_request",
            "protocol": "openai",
            "trace_id": trace_id,
            "original_model": openai_req.model,
            "request": original_body,  // 使用原始请求体，不是结构体序列化
        });
        debug_logger::write_exchange_payload(
            &debug_cfg,
            Some(&trace_id),
            "original_request",
            &original_payload,
        )
        .await;
    }

    // [NEW] Detect Client Adapter
    let client_adapter = CLIENT_ADAPTERS
        .iter()
        .find(|a| a.matches(&headers))
        .cloned();
    if client_adapter.is_some() {
        debug!("[{}] Client Adapter detected", trace_id);
    }

    // [Variant] Resolve canonical model + variant → real model + real params.
    // Replace the client's model/thinking/max_tokens with verified real values so the
    // forwarded request matches the expected upstream format. OpenCode encodes the variant as
    // thinking.budget_tokens; we infer the tier from its magnitude.
    let client_budget = openai_req
        .thinking
        .as_ref()
        .and_then(|t| t.budget_tokens);
    if let Some(spec) =
        crate::proxy::common::variant_mapping::resolve(&openai_req.model, client_budget)
    {
        tracing::info!(
            "[{}] [Variant] canonical='{}' budget_hint={:?} -> real_model='{}' budget={} maxOut={}",
            trace_id, openai_req.model, client_budget, spec.id, spec.thinking_budget, spec.max_output_tokens
        );
        openai_req.model = spec.id.to_string();
        if spec.thinking_budget == 0 {
            // Non-thinking checkpoint model (e.g. gemini-3.1-flash-lite): disable thinking
            // AND strip tools/tool_choice — per upstream spec §3 checkpoint requests carry
            // no tools.
            openai_req.thinking = None;
            openai_req.tools = None;
            openai_req.tool_choice = None;
        } else {
            openai_req.thinking = Some(crate::proxy::mappers::openai::models::ThinkingConfig {
                thinking_type: Some("enabled".to_string()),
                budget_tokens: Some(spec.effective_thinking_budget(client_budget)),
                effort: None,
            });
        }
        openai_req.max_tokens = Some(spec.max_output_tokens);
    }

    let client_tool_names =
        crate::proxy::mappers::openai::request::extract_client_tool_names(&openai_req.tools);

    // 1. 获取 UpstreamClient (Clone handle)
    let upstream = state.upstream.clone();
    let token_manager = state.token_manager;
    let pool_size = token_manager.len();
    // [FIX] Ensure max_attempts is at least 2 to allow for internal retries
    let max_attempts = MAX_RETRY_ATTEMPTS.min(pool_size.saturating_add(1)).max(2);

    let mut last_error = String::new();
    let mut last_email: Option<String> = None;

    // 2. 模型路由解析 (移到循环外以支持在所有路径返回 X-Mapped-Model)
    let mapped_model = crate::proxy::common::model_mapping::resolve_model_route(
        &openai_req.model,
        &*state.custom_mapping.read().await,
    );

    for attempt in 0..max_attempts {
        // 将 OpenAI 工具转为 Value 数组以便探测联网
        let tools_val: Option<Vec<Value>> = openai_req
            .tools
            .as_ref()
            .map(|list| list.iter().cloned().collect());
        let config = crate::proxy::mappers::common_utils::resolve_request_config(
            &openai_req.model,
            &mapped_model,
            &tools_val,
            None, // size (not used in handler, transform_openai_request handles it)
            None, // quality
            None, // image_size
            None, // body
        );

        // 3. 提取 SessionId (粘性指纹)
        let session_id = SessionManager::extract_openai_session_id(&openai_req);

        // 4. 获取 Token (使用准确的 request_type)
        // 关键：在重试尝试时根据 force_rotate 决定是否轮换账号
        let (access_token, project_id, email, account_id, _wait_ms) = match token_manager
            .get_token(
                &config.request_type,
                force_rotate,
                Some(&session_id),
                &mapped_model,
            )
            .await
        {
            Ok(t) => t,
            Err(e) => {
                // [FIX] Attach headers to error response for logging visibility
                let headers = [("X-Mapped-Model", mapped_model.as_str())];
                return Ok((
                    StatusCode::SERVICE_UNAVAILABLE,
                    headers,
                    format!("Token error: {}", e),
                )
                    .into_response());
            }
        };

        // [NEW v4.1.29] 获取完整 Token 对象用于动态规格查询
        let proxy_token = token_manager.get_token_by_id(&account_id);
        let mapped_model = token_manager
            .resolve_dynamic_model_for_account(&account_id, &mapped_model)
            .await;

        last_email = Some(email.clone());
        info!("✓ Using account: {} (type: {})", email, config.request_type);

        // 4. 转换请求 (返回内容包含 session_id, message_count, prefix_hash)
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
                "original_model": openai_req.model,
                "mapped_model": mapped_model,
                "request_type": config.request_type,
                "attempt": attempt,
                "v1internal_request": gemini_body.clone(),
            });
            debug_logger::write_exchange_payload(
                &debug_cfg,
                Some(&trace_id),
                "v1internal_request",
                &payload,
            )
            .await;
        }

        // [New] 打印转换后的报文 (Gemini Body) 供调试
        if let Ok(body_json) = serde_json::to_string_pretty(&gemini_body) {
            debug!("[OpenAI-Request] Transformed Gemini Body:\n{}", body_json);
        }

        // 5. 发送请求
        let client_wants_stream = openai_req.stream;
        let force_stream_internally = !client_wants_stream;
        let actual_stream = client_wants_stream || force_stream_internally;

        if force_stream_internally {
            debug!(
                "[{}] 🔄 Auto-converting non-stream request to stream for better quota",
                trace_id
            );
        }

        let method = if actual_stream {
            "streamGenerateContent"
        } else {
            "generateContent"
        };
        let query_string = if actual_stream { Some("alt=sse") } else { None };

        // [FIX #1522] Inject Anthropic Beta Headers for Claude models (OpenAI path)
        let mut extra_headers = std::collections::HashMap::new();
        if mapped_model.to_lowercase().contains("claude") {
            extra_headers.insert(
                "anthropic-beta".to_string(),
                "claude-code-20250219".to_string(),
            );
            tracing::debug!(
                "[{}] Injected Anthropic beta headers for Claude model (via OpenAI)",
                trace_id
            );
        }

        let call_result = match upstream
            .call_v1_internal_with_headers(
                method,
                &access_token,
                gemini_body,
                query_string,
                extra_headers.clone(),
                Some(account_id.as_str()),
            )
            .await
        {
            Ok(r) => r,
            Err(e) => {
                last_error = e.clone();
                debug!(
                    "OpenAI Request failed on attempt {}/{}: {}",
                    attempt + 1,
                    max_attempts,
                    e
                );
                continue;
            }
        };

        // [NEW] 记录端点降级日志到 debug 文件
        if !call_result.fallback_attempts.is_empty() && debug_logger::is_enabled(&debug_cfg) {
            let fallback_entries: Vec<Value> = call_result
                .fallback_attempts
                .iter()
                .map(|a| {
                    json!({
                        "endpoint_url": a.endpoint_url,
                        "status": a.status,
                        "error": a.error,
                    })
                })
                .collect();
            let payload = json!({
                "kind": "endpoint_fallback",
                "protocol": "openai",
                "trace_id": trace_id,
                "original_model": openai_req.model,
                "mapped_model": mapped_model,
                "attempt": attempt,
                "account": mask_email(&email),
                "fallback_attempts": fallback_entries,
            });
            debug_logger::write_debug_payload(
                &debug_cfg,
                Some(&trace_id),
                "endpoint_fallback",
                &payload,
            )
            .await;
        }

        let response = call_result.response;
        // [NEW] 提取实际请求的上游端点 URL，用于日志记录和排查
        let upstream_url = response.url().to_string();
        let status = response.status();
        if status.is_success() {
            // 5. 处理流式 vs 非流式
            if actual_stream {
                use axum::body::Body;
                use axum::response::Response;
                use futures::StreamExt;

                let meta = json!({
                    "protocol": "openai",
                    "trace_id": trace_id,
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
                    meta,
                );

                // [P1 FIX] Enhanced Peek logic to handle heartbeats and slow start
                // Pre-read until we find meaningful content, skip heartbeats
                use crate::proxy::mappers::openai::streaming::create_openai_sse_stream;
                let mut openai_stream = create_openai_sse_stream(
                    gemini_stream,
                    openai_req.model.clone(),
                    session_id,
                    message_count,
                    Some(client_tool_names.clone()),
                );

                let mut first_data_chunk = None;
                let mut retry_this_account = false;

                // Loop to skip heartbeats during peek
                loop {
                    match tokio::time::timeout(
                        std::time::Duration::from_secs(300),
                        openai_stream.next(),
                    )
                    .await
                    {
                        Ok(Some(Ok(bytes))) => {
                            if bytes.is_empty() {
                                continue;
                            }

                            let text = String::from_utf8_lossy(&bytes);
                            // Skip SSE comments/pings (heartbeats)
                            if text.trim().starts_with(":") || text.trim().starts_with("data: :") {
                                tracing::debug!("[OpenAI] Skipping peek heartbeat");
                                continue;
                            }

                            // Check for error events
                            if stream_chunk_has_error_event(&bytes) {
                                tracing::warn!("[OpenAI] Error detected during peek, retrying...");
                                last_error = "Error event during peek".to_string();
                                retry_this_account = true;
                                break;
                            }

                            // We found real data!
                            first_data_chunk = Some(bytes);
                            break;
                        }
                        Ok(Some(Err(e))) => {
                            tracing::warn!("[OpenAI] Stream error during peek: {}, retrying...", e);
                            last_error = format!("Stream error during peek: {}", e);
                            retry_this_account = true;
                            break;
                        }
                        Ok(None) => {
                            tracing::warn!(
                                "[OpenAI] Stream ended during peek (Empty Response), retrying..."
                            );
                            last_error = "Empty response stream during peek".to_string();
                            retry_this_account = true;
                            break;
                        }
                        Err(_) => {
                            tracing::warn!("[OpenAI] First chunk timeout after 300s, retrying...");
                            last_error = "First chunk timeout".to_string();
                            retry_this_account = true;
                            break;
                        }
                    }
                }

                if retry_this_account {
                    continue; // Rotate to next account
                }

                // Combine first chunk with remaining stream
                let combined_stream =
                    futures::stream::once(
                        async move { Ok::<Bytes, String>(first_data_chunk.unwrap()) },
                    )
                    .chain(openai_stream);

                // [NEW] 针对 OpenAI 流增加 300 秒空闲超时保护
                let combined_stream = async_stream::stream! {
                    let mut s = Box::pin(combined_stream);

                    loop {
                        match tokio::time::timeout(std::time::Duration::from_secs(300), s.next()).await {
                            Ok(Some(item)) => yield item,
                            Ok(None) => break,
                            Err(_) => {
                                tracing::error!("[OpenAI-SSE] Idle timeout after 300s, terminating stream");
                                yield Ok::<Bytes, String>(Bytes::from("data: [DONE]\n\n"));
                                break;
                            }
                        }
                    }
                };
                let converted_meta = json!({
                    "protocol": "openai",
                    "trace_id": trace_id,
                    "stage": "converted_codex_response",
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

                if client_wants_stream {
                    // [MULTI-TURN] 保存本次对话的 messages 到 session store（/v1/chat/completions）
                    {
                        let save_msgs = openai_req
                            .messages
                            .iter()
                            .map(|m| {
                                let content_str = match &m.content {
                                    Some(crate::proxy::mappers::openai::OpenAIContent::String(
                                        s,
                                    )) => s.clone(),
                                    _ => String::new(),
                                };
                                json!({"role": m.role, "content": content_str})
                            })
                            .collect::<Vec<_>>();
                        let chat_response_id =
                            format!("chatcmpl-{}", uuid::Uuid::new_v4().simple());
                        let entry = crate::proxy::http_session_store::HttpSessionEntry {
                            input_items: save_msgs,
                            instructions: String::new(),
                            model: openai_req.model.clone(),
                            last_accessed: std::time::Instant::now(),
                        };
                        let rid = chat_response_id.clone();
                        tokio::spawn(async move {
                            crate::proxy::http_session_store::save_session(rid, entry).await;
                        });
                    }
                    // 客户端请求流式，返回 SSE
                    let body = Body::from_stream(combined_stream);
                    return Ok(Response::builder()
                        .header("Content-Type", "text/event-stream")
                        .header("Cache-Control", "no-cache")
                        .header("Connection", "keep-alive")
                        .header("X-Accel-Buffering", "no")
                        .header("X-Account-Email", &email)
                        .header("X-Mapped-Model", &mapped_model)
                        .body(body)
                        .unwrap()
                        .into_response());
                } else {
                    // 客户端请求非流式，但内部强制转为流式
                    // 收集流数据并聚合为 JSON
                    use crate::proxy::mappers::openai::collector::collect_stream_to_json;

                    match collect_stream_to_json(combined_stream).await {
                        Ok(full_response) => {
                            info!("[{}] ✓ Stream collected and converted to JSON", trace_id);
                            if debug_logger::is_enabled(&debug_cfg) {
                                let converted_response = serde_json::to_value(&full_response)
                                    .unwrap_or_else(
                                        |e| json!({ "serialization_error": e.to_string() }),
                                    );
                                let payload = json!({
                                    "kind": "exchange_summary",
                                    "protocol": "openai",
                                    "trace_id": trace_id,
                                    "original_codex_request": original_body,
                                    "gemini_request": gemini_body_for_debug,
                                    "converted_codex_response": converted_response,
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
                            return Ok((
                                StatusCode::OK,
                                [
                                    ("X-Account-Email", email.as_str()),
                                    ("X-Mapped-Model", mapped_model.as_str()),
                                ],
                                Json(full_response),
                            )
                                .into_response());
                        }
                        Err(e) => {
                            error!("[{}] Stream collection error: {}", trace_id, e);
                            return Ok((
                                StatusCode::INTERNAL_SERVER_ERROR,
                                format!("Stream collection error: {}", e),
                            )
                                .into_response());
                        }
                    }
                }
            }

            let gemini_resp: Value = response
                .json()
                .await
                .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Parse error: {}", e)))?;

            // [CACHE] 从 Gemini 响应中提取缓存信息，关闭反馈循环
            // 兼容两种格式: cachedContentTokenCount (旧), total_cached_tokens (新)
            if let Some(usage) = gemini_resp.get("usageMetadata") {
                let cached = usage
                    .get("total_cached_tokens")
                    .or_else(|| usage.get("cachedContentTokenCount"))
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                if cached > 0 {
                    let cm = crate::proxy::cache_manager::global_cache_manager();
                    cm.record_implicit_hit(&_prefix_hash);
                    // [CACHE] 分层统计日志
                    let stats = cm.get_layer_stats();
                    tracing::info!(
                        "[Cache-Opt] Implicit cache HIT: prefix_hash={} cached_tokens={} | L1(SI): {}/{}, L2(Tools): {}/{}, L3(Prefix): {}/{}",
                        &_prefix_hash[.._prefix_hash.len().min(16)],
                        cached,
                        stats.si_hits, stats.si_total,
                        stats.tools_hits, stats.tools_total,
                        stats.prefix_hits, stats.prefix_total,
                    );
                }
            }

            let openai_response = transform_openai_response(
                &gemini_resp,
                Some(&session_id),
                message_count,
                Some(&client_tool_names),
            );
            if debug_logger::is_enabled(&debug_cfg) {
                let converted_response = serde_json::to_value(&openai_response)
                    .unwrap_or_else(|e| json!({ "serialization_error": e.to_string() }));
                let payload = json!({
                    "kind": "exchange_summary",
                    "protocol": "openai",
                    "trace_id": trace_id,
                    "original_codex_request": original_body,
                    "gemini_request": gemini_body_for_debug,
                    "gemini_raw_response": gemini_resp,
                    "converted_codex_response": converted_response,
                });
                debug_logger::write_exchange_payload(
                    &debug_cfg,
                    Some(&trace_id),
                    "exchange_summary",
                    &payload,
                )
                .await;
            }
            return Ok((
                StatusCode::OK,
                [
                    ("X-Account-Email", email.as_str()),
                    ("X-Mapped-Model", mapped_model.as_str()),
                ],
                Json(openai_response),
            )
                .into_response());
        }

        // 处理特定错误并重试
        let status_code = status.as_u16();
        let _retry_after = response
            .headers()
            .get("Retry-After")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string());
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| format!("HTTP {}", status_code));
        last_error = format!("HTTP {}: {}", status_code, error_text);

        // [New] 打印错误报文日志
        tracing::error!(
            "[OpenAI-Upstream] Error Response {}: {}",
            status_code,
            error_text
        );
        if debug_logger::is_enabled(&debug_cfg) {
            let payload = json!({
                "kind": "upstream_response_error",
                "protocol": "openai",
                "trace_id": trace_id,
                "original_model": openai_req.model,
                "mapped_model": mapped_model,
                "request_type": config.request_type,
                "attempt": attempt,
                "status": status_code,
                "upstream_url": upstream_url,
                "account": mask_email(&email),
                "error_text": error_text,
            });
            debug_logger::write_debug_payload(
                &debug_cfg,
                Some(&trace_id),
                "upstream_response_error",
                &payload,
            )
            .await;
        }

        // 确定重试策略
        let strategy = determine_retry_strategy(status_code, &error_text, false);

        // 3. 标记限流状态(用于 UI 显示)
        if status_code == 429 || status_code == 529 || status_code == 503 || status_code == 500 {
            // [FIX] Use async version with model parameter for fine-grained rate limiting
            token_manager
                .mark_rate_limited_async(
                    &email,
                    status_code,
                    _retry_after.as_deref(),
                    &error_text,
                    Some(&mapped_model),
                )
                .await;
        }

        // 执行退避
        if apply_retry_strategy(
            strategy.clone(),
            attempt,
            max_attempts,
            status_code,
            &trace_id,
        )
        .await
        {
            // [NEW] Apply Client Adapter "let_it_crash" strategy
            if let Some(adapter) = &client_adapter {
                if adapter.let_it_crash() && attempt > 0 {
                    // For let_it_crash clients (like opencode), allow maybe 1 retry but then fail fast
                    // to prevent long hangs on UI.
                    tracing::warn!(
                        "[OpenAI] let_it_crash active: Aborting retries after attempt {}",
                        attempt
                    );
                    // Breaking loop to return error immediately
                    // Reuse existing error return logic via loop exit behavior?
                    // Or construct error here?
                    // Let's just break for now, which will trigger the "All accounts exhausted" or last error logic.
                    break;
                }
            }

            // 判断是否需要轮换账号
            if !should_rotate_account(status_code, Some(&strategy)) {
                debug!(
                    "[{}] Keeping same account for status {} (Grace Retry or Server Issue)",
                    trace_id, status_code
                );
                force_rotate = false;
            } else {
                force_rotate = true;
            }

            // 2. [REMOVED] 不再特殊处理 QUOTA_EXHAUSTED，允许账号轮换
            // if error_text.contains("QUOTA_EXHAUSTED") { ... }
            /*
            if error_text.contains("QUOTA_EXHAUSTED") {
                error!(
                    "OpenAI Quota exhausted (429) on account {} attempt {}/{}, stopping to protect pool.",
                    email,
                    attempt + 1,
                    max_attempts
                );
                return Ok((status, [("X-Account-Email", email.as_str()), ("X-Mapped-Model", mapped_model.as_str())], error_text).into_response());
            }
            */

            // 3. 其他限流或服务器过载情况，轮换账号
            tracing::warn!(
                "OpenAI Upstream {} on {} attempt {}/{}, rotating account",
                status_code,
                email,
                attempt + 1,
                max_attempts
            );
            continue;
        }

        // [NEW] 处理 400 错误 (Thinking 签名失效)
        if status_code == 400
            && (error_text.contains("Invalid `signature`")
                || error_text.contains("thinking.signature")
                || error_text.contains("Invalid signature")
                || error_text.contains("Corrupted thought signature"))
        {
            tracing::warn!(
                "[OpenAI] Signature error detected on account {}, retrying without thinking",
                email
            );

            // 追加修复提示词到最后一条用户消息
            if let Some(last_msg) = openai_req.messages.last_mut() {
                if last_msg.role == "user" {
                    let repair_prompt = "\n\n[System Recovery] Your previous output contained an invalid signature. Please regenerate the response without the corrupted signature block.";

                    if let Some(content) = &mut last_msg.content {
                        use crate::proxy::mappers::openai::{OpenAIContent, OpenAIContentBlock};
                        match content {
                            OpenAIContent::String(s) => {
                                s.push_str(repair_prompt);
                            }
                            OpenAIContent::Array(arr) => {
                                arr.push(OpenAIContentBlock::Text {
                                    text: repair_prompt.to_string(),
                                });
                            }
                        }
                        tracing::debug!("[OpenAI] Appended repair prompt to last user message");
                    }
                }
            }

            continue; // 重试
        }

        // 只有 403 (权限/地区限制) 和 401 (认证失效) 触发账号轮换
        if status_code == 403 || status_code == 401 {
            if apply_retry_strategy(
                RetryStrategy::FixedDelay(Duration::from_millis(200)),
                attempt,
                max_attempts,
                status_code,
                &trace_id,
            )
            .await
            {
                continue;
            }
        }

        // 只有 403 (权限/地区限制) 和 401 (认证失效) 触发账号轮换
        if status_code == 403 || status_code == 401 {
            // [NEW] 403 时设置 is_forbidden 状态，避免 Claude Code 会话退出
            if status_code == 403 {
                if let Some(acc_id) = token_manager.get_account_id_by_email(&email) {
                    // Check for VALIDATION_REQUIRED error - temporarily block account
                    if error_text.contains("VALIDATION_REQUIRED")
                        || error_text.contains("verify your account")
                        || error_text.contains("validation_url")
                    {
                        tracing::warn!(
                            "[OpenAI] VALIDATION_REQUIRED detected on account {}, temporarily blocking",
                            email
                        );
                        // Block for 10 minutes (default, configurable via config file)
                        let block_minutes = 10i64;
                        let block_until = chrono::Utc::now().timestamp() + (block_minutes * 60);

                        if let Err(e) = token_manager
                            .set_validation_block_public(&acc_id, block_until, &error_text)
                            .await
                        {
                            tracing::error!("Failed to set validation block: {}", e);
                        }
                    }

                    // 设置 is_forbidden 状态
                    if let Err(e) = token_manager.set_forbidden(&acc_id, &error_text).await {
                        tracing::error!("Failed to set forbidden status: {}", e);
                    }
                }
            }

            if apply_retry_strategy(
                RetryStrategy::FixedDelay(Duration::from_millis(200)),
                attempt,
                max_attempts,
                status_code,
                &trace_id,
            )
            .await
            {
                continue;
            }
        }

        // 404 等由于模型配置或路径错误的 HTTP 异常，直接报错，不进行无效轮换
        error!(
            "OpenAI Upstream non-retryable error {} on account {}: {}",
            status_code, email, error_text
        );
        return Ok((
            status,
            [
                ("X-Account-Email", email.as_str()),
                ("X-Mapped-Model", mapped_model.as_str()),
            ],
            // [FIX] Return JSON error for better client compatibility
            Json(json!({
                "error": {
                    "message": error_text,
                    "type": "upstream_error",
                    "code": status_code
                }
            })),
        )
            .into_response());
    }

    // 所有尝试均失败
    if let Some(email) = last_email {
        Ok((
            StatusCode::TOO_MANY_REQUESTS,
            [("X-Account-Email", email), ("X-Mapped-Model", mapped_model)],
            format!("All accounts exhausted. Last error: {}", last_error),
        )
            .into_response())
    } else {
        Ok((
            StatusCode::TOO_MANY_REQUESTS,
            [("X-Mapped-Model", mapped_model)],
            format!("All accounts exhausted. Last error: {}", last_error),
        )
            .into_response())
    }
}

// --- Codex GUIDANCE PROMPTS ---

