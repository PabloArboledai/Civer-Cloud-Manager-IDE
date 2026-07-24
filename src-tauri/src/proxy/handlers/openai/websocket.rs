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

#[derive(Debug, Clone)]

struct WebsocketSessionState {
    last_request: Option<Value>,
    last_response_output: Value,
    last_response_id: String,
    last_response_pending_tool_call_ids: Vec<String>,
    tool_call_cache: std::collections::HashMap<String, Value>,
}

pub async fn handle_responses_websocket(
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_websocket_session(socket, headers, state))
}

pub async fn handle_websocket_session(mut socket: WebSocket, headers: HeaderMap, state: AppState) {
    tracing::info!("Codex responses websocket: client connected");
    let mut session_state = WebsocketSessionState {
        last_request: None,
        last_response_output: json!([]),
        last_response_id: String::new(),
        last_response_pending_tool_call_ids: Vec::new(),
        tool_call_cache: std::collections::HashMap::new(),
    };

    while let Some(msg_result) = socket.recv().await {
        let msg = match msg_result {
            Ok(m) => m,
            Err(e) => {
                tracing::warn!("responses websocket: read message failed: {:?}", e);
                break;
            }
        };

        let text = match msg {
            Message::Text(t) => t,
            Message::Binary(b) => match String::from_utf8(b) {
                Ok(s) => s,
                Err(_) => continue,
            },
            Message::Close(_) => {
                tracing::info!("responses websocket: client disconnected");
                break;
            }
            _ => continue,
        };

        let payload: Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(e) => {
                let error_ev = json!({
                    "type": "error",
                    "error": {
                        "message": format!("Invalid JSON: {}", e),
                        "type": "invalid_request_error"
                    }
                });
                let _ = socket.send(Message::Text(error_ev.to_string())).await;
                continue;
            }
        };
        let ws_trace_id = format!("ws_{}", chrono::Utc::now().timestamp_subsec_millis());
        let debug_cfg = state.debug_logging.read().await.clone();
        if debug_logger::is_enabled(&debug_cfg) {
            let payload_log = json!({
                "kind": "codex_websocket_raw_request",
                "protocol": "codex_websocket",
                "trace_id": ws_trace_id,
                "raw_text": text.clone(),
                "payload": payload.clone(),
            });
            debug_logger::write_exchange_payload(
                &debug_cfg,
                Some(&ws_trace_id),
                "codex_websocket_raw_request",
                &payload_log,
            )
            .await;
        }

        if should_handle_prewarm_locally(&payload, &session_state) {
            let (created, completed) = handle_prewarm_locally(&payload, &mut session_state);
            let _ = socket.send(Message::Text(created.to_string())).await;
            let _ = socket.send(Message::Text(completed.to_string())).await;
            if debug_logger::is_enabled(&debug_cfg) {
                let payload_log = json!({
                    "kind": "codex_websocket_local_response",
                    "protocol": "codex_websocket",
                    "trace_id": ws_trace_id,
                    "events": [created, completed],
                });
                debug_logger::write_exchange_payload(
                    &debug_cfg,
                    Some(&ws_trace_id),
                    "codex_websocket_local_response",
                    &payload_log,
                )
                .await;
            }
            continue;
        }

        let normalized = match normalize_responses_websocket_request(&payload, &mut session_state) {
            Ok(n) => n,
            Err(e) => {
                let error_ev = json!({
                    "type": "error",
                    "error": {
                        "message": e,
                        "type": "invalid_request_error"
                    }
                });
                let _ = socket.send(Message::Text(error_ev.to_string())).await;
                continue;
            }
        };

        let openai_body = convert_codex_to_openai_request(normalized);
        let response_result =
            handle_chat_completions(State(state.clone()), headers.clone(), Json(openai_body)).await;

        let response = match response_result {
            Ok(res) => res.into_response(),
            Err((status, err_msg)) => {
                let error_ev = json!({
                    "type": "error",
                    "error": {
                        "message": err_msg,
                        "type": "server_error",
                        "code": status.as_u16().to_string()
                    }
                });
                let _ = socket.send(Message::Text(error_ev.to_string())).await;
                continue;
            }
        };

        if !response.status().is_success() {
            let error_ev = json!({
                "type": "error",
                "error": {
                    "message": format!("Upstream returned status {}", response.status()),
                    "type": "server_error"
                }
            });
            let _ = socket.send(Message::Text(error_ev.to_string())).await;
            continue;
        }

        let body = response.into_body();
        let mut stream = body.into_data_stream();

        let mut translation_state = TranslationState {
            response_id: format!("resp-{}", &Uuid::new_v4().to_string()[..24]),
            item_id: format!("item-{}", &Uuid::new_v4().to_string()[..16]),
            message_output_index: None,
            next_output_index: 0,
            tool_output_indices: std::collections::HashMap::new(),
            message_item_added: false,
            content_part_added: false,
            accumulated_text: String::new(),
            tool_calls: std::collections::HashMap::new(),
            tool_calls_added: std::collections::HashSet::new(),
        };

        let created_ev = json!({
            "type": "response.created",
            "response": {
                "id": &translation_state.response_id,
                "object": "response",
                "status": "in_progress",
                "output": []
            }
        });
        let mut outgoing_ws_events = Vec::new();
        send_ws_event(&mut socket, &mut outgoing_ws_events, &created_ev).await;

        let mut buffer = bytes::BytesMut::new();
        while let Some(chunk_res) = stream.next().await {
            let chunk = match chunk_res {
                Ok(c) => c,
                Err(e) => {
                    tracing::warn!("Stream chunk error: {:?}", e);
                    break;
                }
            };
            buffer.extend_from_slice(&chunk);
            while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
                let line_raw = buffer.split_to(pos + 1);
                if let Ok(line_str) = std::str::from_utf8(&line_raw) {
                    let line = line_str.trim();
                    if line.is_empty() || !line.starts_with("data: ") {
                        continue;
                    }
                    let json_part = line.trim_start_matches("data: ").trim();
                    if json_part == "[DONE]" {
                        break;
                    }
                    if let Ok(chunk_json) = serde_json::from_str::<Value>(json_part) {
                        translate_openai_chunk_to_ws(
                            &chunk_json,
                            &mut translation_state,
                            &mut socket,
                            &mut outgoing_ws_events,
                        )
                        .await;
                    }
                }
            }
        }

        if !buffer.is_empty() {
            if let Ok(line_str) = std::str::from_utf8(&buffer) {
                let line = line_str.trim();
                if line.starts_with("data: ") {
                    let json_part = line.trim_start_matches("data: ").trim();
                    if json_part != "[DONE]" {
                        if let Ok(chunk_json) = serde_json::from_str::<Value>(json_part) {
                            translate_openai_chunk_to_ws(
                                &chunk_json,
                                &mut translation_state,
                                &mut socket,
                                &mut outgoing_ws_events,
                            )
                            .await;
                        }
                    }
                }
            }
        }

        let completed_output = finalize_ws_events(
            &mut translation_state,
            &mut socket,
            &mut session_state,
            &mut outgoing_ws_events,
        )
        .await;
        if debug_logger::is_enabled(&debug_cfg) {
            let payload_log = json!({
                "kind": "codex_websocket_converted_response",
                "protocol": "codex_websocket",
                "trace_id": ws_trace_id,
                "events": outgoing_ws_events,
                "completed_output": completed_output.clone(),
            });
            debug_logger::write_exchange_payload(
                &debug_cfg,
                Some(&ws_trace_id),
                "codex_websocket_converted_response",
                &payload_log,
            )
            .await;
        }

        session_state.last_response_output = completed_output;
        session_state.last_response_id = translation_state.response_id.clone();
        session_state.last_response_pending_tool_call_ids = translation_state
            .tool_calls
            .values()
            .map(|(_, call_id, _, _)| call_id.clone())
            .collect();
    }
}

pub fn should_handle_prewarm_locally(payload: &Value, state: &WebsocketSessionState) -> bool {
    if state.last_request.is_some() {
        return false;
    }
    let event_type = payload.get("type").and_then(|v| v.as_str()).unwrap_or("");
    if event_type != "response.create" {
        return false;
    }
    if let Some(generate) = payload.get("generate").and_then(|v| v.as_bool()) {
        if !generate {
            return true;
        }
    }
    false
}

pub fn handle_prewarm_locally(payload: &Value, state: &mut WebsocketSessionState) -> (Value, Value) {
    let response_id = format!("resp_prewarm_{}", Uuid::new_v4());
    let created_at = chrono::Utc::now().timestamp();
    let model = payload
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    let created_ev = json!({
        "type": "response.created",
        "sequence_number": 0,
        "response": {
            "id": &response_id,
            "object": "response",
            "created_at": created_at,
            "status": "in_progress",
            "background": false,
            "error": null,
            "output": [],
            "model": model,
        }
    });

    let completed_ev = json!({
        "type": "response.completed",
        "sequence_number": 1,
        "response": {
            "id": &response_id,
            "object": "response",
            "created_at": created_at,
            "status": "completed",
            "background": false,
            "error": null,
            "output": [],
            "usage": {
                "input_tokens": 0,
                "input_tokens_details": {
                    "cached_tokens": 0
                },
                "output_tokens": 0,
                "output_tokens_details": {
                    "reasoning_tokens": 0
                },
                "total_tokens": 0
            },
            "model": model,
        }
    });

    let mut normalized = payload.clone();
    if let Some(obj) = normalized.as_object_mut() {
        obj.remove("type");
        obj.remove("generate");
    }
    state.last_request = Some(normalized);
    state.last_response_output = json!([]);
    state.last_response_id = response_id;
    state.last_response_pending_tool_call_ids = Vec::new();

    (created_ev, completed_ev)
}

pub fn normalize_responses_websocket_request(
    payload: &Value,
    state: &mut WebsocketSessionState,
) -> Result<Value, String> {
    let event_type = payload.get("type").and_then(|v| v.as_str()).unwrap_or("");
    match event_type {
        "response.create" => {
            if state.last_request.is_none() {
                let mut normalized = payload.clone();
                if let Some(obj) = normalized.as_object_mut() {
                    obj.remove("type");
                    obj.insert("stream".to_string(), Value::Bool(true));
                    if !obj.contains_key("input") {
                        obj.insert("input".to_string(), json!([]));
                    }
                }
                let model_name = normalized
                    .get("model")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if model_name.is_empty() {
                    return Err("missing model in response.create request".to_string());
                }
                state.last_request = Some(normalized.clone());
                Ok(normalized)
            } else {
                normalize_response_subsequent_request(payload, state)
            }
        }
        "response.append" => normalize_response_subsequent_request(payload, state),
        _ => Err(format!(
            "unsupported websocket request type: {}",
            event_type
        )),
    }
}

pub fn normalize_response_subsequent_request(
    payload: &Value,
    state: &mut WebsocketSessionState,
) -> Result<Value, String> {
    if state.last_request.is_none() {
        return Err("websocket request received before response.create".to_string());
    }

    // [FIX] 拦截 compaction 和完整历史替换事件
    if should_replace_websocket_transcript(payload) {
        let mut normalized = payload.clone();
        if let Some(obj) = normalized.as_object_mut() {
            obj.remove("type");
            obj.remove("previous_response_id");
            obj.insert("stream".to_string(), Value::Bool(true));
        }
        state.last_request = Some(normalized.clone());
        return Ok(normalized);
    }

    // [FIX] 始终走完整的 merge 逻辑，废弃 transcript replacement 分支
    // 旧逻辑在检测到 function_call/assistant 时直接替换整个历史，导致多轮对话历史丢失
    // 正确做法：last_request.input + last_response_output + new payload.input 全部合并
    let mut merged_input = Vec::new();

    // 1. 上一轮请求的 input（已含此前所有历史）
    if let Some(last_req) = &state.last_request {
        if let Some(arr) = last_req.get("input").and_then(|v| v.as_array()) {
            merged_input.extend(arr.clone());
        }
    }

    // 2. 上一轮 response 的 output items（assistant 回复、工具调用等）
    if let Some(arr) = state.last_response_output.as_array() {
        merged_input.extend(arr.clone());
    }

    // 3. 本轮新的 input items（用户消息、工具调用结果等）
    if let Some(arr) = payload.get("input").and_then(|v| v.as_array()) {
        for item in arr {
            let t = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if t == "compaction" || t == "compaction_summary" {
                continue;
            }
            if t == "function_call_output" || t == "custom_tool_call_output" {
                if let Some(call_id) = item.get("call_id").and_then(|v| v.as_str()) {
                    state
                        .last_response_pending_tool_call_ids
                        .retain(|x| x != call_id);
                }
            }
            merged_input.push(item.clone());
        }
    }

    repair_tool_calls(&mut merged_input, &state.tool_call_cache);

    let deduped = dedupe_function_calls_by_call_id(dedupe_input_items_by_id(merged_input));

    let mut normalized = payload.clone();
    if let Some(obj) = normalized.as_object_mut() {
        obj.remove("type");
        obj.remove("previous_response_id");
        obj.insert("input".to_string(), json!(deduped));
        if !obj.contains_key("model") {
            if let Some(last_req) = &state.last_request {
                if let Some(model) = last_req.get("model") {
                    obj.insert("model".to_string(), model.clone());
                }
            }
        }
        if !obj.contains_key("instructions") {
            if let Some(last_req) = &state.last_request {
                if let Some(instructions) = last_req.get("instructions") {
                    obj.insert("instructions".to_string(), instructions.clone());
                }
            }
        }
        if !obj.contains_key("tools") {
            if let Some(last_req) = &state.last_request {
                if let Some(tools) = last_req.get("tools") {
                    obj.insert("tools".to_string(), tools.clone());
                }
            }
        }
        if !obj.contains_key("tool_choice") {
            if let Some(last_req) = &state.last_request {
                if let Some(tool_choice) = last_req.get("tool_choice") {
                    obj.insert("tool_choice".to_string(), tool_choice.clone());
                }
            }
        }
        obj.insert("stream".to_string(), Value::Bool(true));
    }
    state.last_request = Some(normalized.clone());
    Ok(normalized)
}

#[allow(dead_code)]
fn should_replace_websocket_transcript(payload: &Value) -> bool {
    let previous_response_id = payload
        .get("previous_response_id")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if !previous_response_id.is_empty() {
        return false;
    }
    if let Some(input_array) = payload.get("input").and_then(|v| v.as_array()) {
        for item in input_array {
            let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if item_type == "function_call" || item_type == "custom_tool_call" {
                return true;
            }
            if item_type == "message" {
                let role = item.get("role").and_then(|v| v.as_str()).unwrap_or("");
                if role == "assistant" {
                    return true;
                }
            }
        }
    }
    false
}

#[allow(dead_code)]
fn normalize_response_transcript_replacement(payload: &Value, last_request: &Value) -> Value {
    let mut normalized = payload.clone();
    if let Some(obj) = normalized.as_object_mut() {
        obj.remove("type");
        obj.remove("previous_response_id");
        obj.insert("stream".to_string(), Value::Bool(true));
        if !obj.contains_key("model") {
            if let Some(model) = last_request.get("model") {
                obj.insert("model".to_string(), model.clone());
            }
        }
        if !obj.contains_key("instructions") {
            if let Some(instructions) = last_request.get("instructions") {
                obj.insert("instructions".to_string(), instructions.clone());
            }
        }
    }
    normalized
}

pub fn dedupe_input_items_by_id(items: Vec<Value>) -> Vec<Value> {
    use std::collections::{HashMap, HashSet};
    let mut referenced_call_ids = HashSet::new();
    for item in &items {
        let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if item_type == "function_call_output" || item_type == "custom_tool_call_output" {
            if let Some(call_id) = item.get("call_id").and_then(|v| v.as_str()) {
                if !call_id.is_empty() {
                    referenced_call_ids.insert(call_id.to_string());
                }
            }
        }
    }

    let mut keep_map: HashMap<String, (usize, bool)> = HashMap::new();
    for (idx, item) in items.iter().enumerate() {
        let item_id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
        if item_id.is_empty() {
            continue;
        }
        let call_id = item.get("call_id").and_then(|v| v.as_str()).unwrap_or("");
        let is_referenced = !call_id.is_empty() && referenced_call_ids.contains(call_id);
        if let Some(&(existing_idx, existing_referenced)) = keep_map.get(item_id) {
            if is_referenced || !existing_referenced {
                keep_map.insert(item_id.to_string(), (idx, is_referenced));
            }
        } else {
            keep_map.insert(item_id.to_string(), (idx, is_referenced));
        }
    }

    let mut keep_indices = HashSet::new();
    for (_, (idx, _)) in keep_map {
        keep_indices.insert(idx);
    }

    let mut filtered = Vec::new();
    for (idx, item) in items.into_iter().enumerate() {
        let item_id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
        if !item_id.is_empty() {
            if !keep_indices.contains(&idx) {
                continue;
            }
        }
        filtered.push(item);
    }
    filtered
}

pub fn dedupe_function_calls_by_call_id(items: Vec<Value>) -> Vec<Value> {
    use std::collections::HashSet;
    let mut seen_call_ids = HashSet::new();
    let mut filtered = Vec::new();
    for item in items {
        let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if item_type == "function_call" || item_type == "custom_tool_call" {
            if let Some(call_id) = item.get("call_id").and_then(|v| v.as_str()) {
                if !call_id.is_empty() {
                    if seen_call_ids.contains(call_id) {
                        continue;
                    }
                    seen_call_ids.insert(call_id.to_string());
                }
            }
        }
        filtered.push(item);
    }
    filtered
}

pub fn repair_tool_calls(
    input_items: &mut Vec<Value>,
    tool_call_cache: &std::collections::HashMap<String, Value>,
) {
    let mut call_present = std::collections::HashSet::new();
    for item in input_items.iter() {
        let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if item_type == "function_call" || item_type == "custom_tool_call" {
            if let Some(call_id) = item.get("call_id").and_then(|v| v.as_str()) {
                call_present.insert(call_id.to_string());
            }
        }
    }

    let mut new_items = Vec::new();
    let mut inserted = std::collections::HashSet::new();
    for item in input_items.drain(..) {
        let item_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if item_type == "function_call_output" || item_type == "custom_tool_call_output" {
            if let Some(call_id) = item.get("call_id").and_then(|v| v.as_str()) {
                if !call_id.is_empty()
                    && !call_present.contains(call_id)
                    && !inserted.contains(call_id)
                {
                    if let Some(cached_call) = tool_call_cache.get(call_id) {
                        new_items.push(cached_call.clone());
                        inserted.insert(call_id.to_string());
                    }
                }
            }
        }
        new_items.push(item);
    }
    *input_items = new_items;
}

pub fn convert_codex_to_openai_request(mut body: Value) -> Value {
    let instructions = body
        .get("instructions")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    let input_items = body.get("input").and_then(|v| v.as_array());
    let (interaction_ledger, mut step_markers) = codex_ledger_from_body(&body);

    let mut messages = Vec::new();
    if !instructions.is_empty() {
        messages.push(json!({ "role": "system", "content": instructions }));
    }

    let mut call_id_to_name = std::collections::HashMap::new();
    let mut skipped_incomplete_custom_call_ids = std::collections::HashSet::new();

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
                "function_call" | "custom_tool_call" | "local_shell_call" | "web_search_call" => {
                    let call_id = item
                        .get("call_id")
                        .and_then(|v| v.as_str())
                        .or_else(|| item.get("id").and_then(|v| v.as_str()))
                        .unwrap_or("unknown");
                    let mut name = item
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string();
                    if item_type == "local_shell_call" || name == "local_shell_call" {
                        name = "shell".to_string();
                    } else if item_type == "web_search_call" || name == "web_search_call" {
                        name = "google_search".to_string();
                    }
                    call_id_to_name.insert(call_id.to_string(), name);
                }
                _ => {}
            }
        }
    }

    if let Some(items) = input_items {
        let mut seen_apply_patch_failures = std::collections::HashSet::new();
        let mut apply_patch_failure_distinct_count = 0usize;
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
                    let mut image_parts = Vec::new();

                    if let Some(parts) = content {
                        for part in parts {
                            if let Some(text) = part.get("text").and_then(|v| v.as_str()) {
                                text_parts.push(text.to_string());
                            } else if part.get("type").and_then(|v| v.as_str())
                                == Some("input_image")
                            {
                                if let Some(image_url) =
                                    part.get("image_url").and_then(|v| v.as_str())
                                {
                                    image_parts.push(json!({ "type": "image_url", "image_url": { "url": image_url } }));
                                }
                            } else if part.get("type").and_then(|v| v.as_str()) == Some("image_url")
                            {
                                if let Some(url_obj) = part.get("image_url") {
                                    image_parts.push(json!({ "type": "image_url", "image_url": url_obj.clone() }));
                                }
                            }
                        }
                    }

                    if image_parts.is_empty() {
                        let content = prefix_with_step_marker(step_marker, text_parts.join("\n"));
                        messages.push(json!({ "role": role, "content": content }));
                    } else {
                        let mut content_blocks = Vec::new();
                        let marker_text =
                            prefix_with_step_marker(step_marker, text_parts.join("\n"));
                        if !marker_text.is_empty() {
                            content_blocks.push(json!({ "type": "text", "text": marker_text }));
                        }
                        content_blocks.extend(image_parts);
                        messages.push(json!({ "role": role, "content": content_blocks }));
                    }
                }
                "function_call" | "custom_tool_call" | "local_shell_call" | "web_search_call" => {
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

                    if item_type == "custom_tool_call" {
                        if let Some(input) = item.get("input").and_then(|v| v.as_str()) {
                            args_str = serde_json::to_string(&json!({ "input": input }))
                                .unwrap_or_else(|_| "{}".to_string());
                        }
                    } else if item_type == "local_shell_call" || name == "local_shell_call" {
                        name = "shell";
                        if let Some(action) = item.get("action") {
                            if let Some(exec) = action.get("exec") {
                                let mut args_obj = serde_json::Map::new();
                                if let Some(cmd) = exec.get("command") {
                                    let cmd_val = if cmd.is_string() {
                                        json!([cmd])
                                    } else {
                                        cmd.clone()
                                    };
                                    args_obj.insert("command".to_string(), cmd_val);
                                }
                                if let Some(wd) =
                                    exec.get("working_directory").or(exec.get("workdir"))
                                {
                                    args_obj.insert("workdir".to_string(), wd.clone());
                                }
                                args_str = serde_json::to_string(&args_obj)
                                    .unwrap_or_else(|_| "{}".to_string());
                            }
                        }
                    } else if item_type == "web_search_call" || name == "web_search_call" {
                        name = "google_search";
                        if let Some(action) = item.get("action") {
                            let mut args_obj = serde_json::Map::new();
                            if let Some(q) = action.get("query") {
                                args_obj.insert("query".to_string(), q.clone());
                            }
                            args_str = serde_json::to_string(&args_obj)
                                .unwrap_or_else(|_| "{}".to_string());
                        }
                    }

                    messages.push(json!({
                        "role": "assistant",
                        "content": "",
                        "tool_calls": [{
                            "id": call_id,
                            "type": "function",
                            "function": { "name": name, "arguments": args_str }
                        }]
                    }));
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
                        } else if let Some(content) = o.get("content").and_then(|v| v.as_str()) {
                            content.to_string()
                        } else {
                            o.to_string()
                        }
                    } else {
                        "".to_string()
                    };

                    let name = match call_id_to_name.get(call_id).cloned().or_else(|| {
                        get_cached_tool_call(call_id).and_then(|v| {
                            v.get("name")
                                .and_then(|n| n.as_str())
                                .map(|s| s.to_string())
                        })
                    }) {
                        Some(name) => name,
                        None if item_type == "custom_tool_call_output" => {
                            tracing::warn!(
                                "Skipping orphan custom_tool_call_output for unknown call_id {}",
                                call_id
                            );
                            continue;
                        }
                        None => "shell".to_string(),
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
        obj.remove("instructions");
    }
    body
}

pub struct TranslationState {
    response_id: String,
    item_id: String,
    message_output_index: Option<u32>,
    next_output_index: u32,
    tool_output_indices: std::collections::HashMap<u32, u32>,
    message_item_added: bool,
    content_part_added: bool,
    accumulated_text: String,
    tool_calls: std::collections::HashMap<u32, (String, String, String, String)>,
    tool_calls_added: std::collections::HashSet<u32>,
}

pub async fn send_ws_event(socket: &mut WebSocket, ws_events: &mut Vec<Value>, event: &Value) {
    ws_events.push(event.clone());
    let _ = socket.send(Message::Text(event.to_string())).await;
}

pub async fn translate_openai_chunk_to_ws(
    chunk: &Value,
    state: &mut TranslationState,
    socket: &mut WebSocket,
    ws_events: &mut Vec<Value>,
) {
    if let Some(choices) = chunk.get("choices").and_then(|c| c.as_array()) {
        for choice in choices {
            if let Some(delta) = choice.get("delta") {
                if let Some(reasoning) = delta.get("reasoning_content").and_then(|v| v.as_str()) {
                    if !reasoning.is_empty() {
                        let message_output_index = match state.message_output_index {
                            Some(idx) => idx,
                            None => {
                                let idx = state.next_output_index;
                                state.next_output_index += 1;
                                state.message_output_index = Some(idx);
                                idx
                            }
                        };
                        let reasoning_ev = json!({
                            "type": "response.reasoning_summary_text.delta",
                            "sequence_number": 0,
                            "item_id": &state.item_id,
                            "output_index": message_output_index,
                            "summary_index": 0,
                            "delta": reasoning
                        });
                        send_ws_event(socket, ws_events, &reasoning_ev).await;

                        if !state.message_item_added {
                            let item_added = json!({
                                "type": "response.output_item.added",
                                "output_index": message_output_index,
                                "item": {
                                    "id": &state.item_id,
                                    "type": "message",
                                    "role": "assistant",
                                    "phase": "commentary",
                                    "status": "in_progress",
                                    "content": []
                                }
                            });
                            send_ws_event(socket, ws_events, &item_added).await;

                            let part_added = json!({
                                "type": "response.content_part.added",
                                "item_id": &state.item_id,
                                "output_index": message_output_index,
                                "content_index": 0,
                                "part": {
                                    "type": "output_text",
                                    "text": ""
                                }
                            });
                            send_ws_event(socket, ws_events, &part_added).await;
                            state.message_item_added = true;
                            state.content_part_added = true;
                        }

                        let delta_ev = json!({
                            "type": "response.output_text.delta",
                            "item_id": &state.item_id,
                            "output_index": message_output_index,
                            "content_index": 0,
                            "delta": reasoning
                        });
                        send_ws_event(socket, ws_events, &delta_ev).await;
                        state.accumulated_text.push_str(reasoning);
                    }
                }

                if let Some(content) = delta.get("content").and_then(|v| v.as_str()) {
                    if !content.is_empty() {
                        let message_output_index = match state.message_output_index {
                            Some(idx) => idx,
                            None => {
                                let idx = state.next_output_index;
                                state.next_output_index += 1;
                                state.message_output_index = Some(idx);
                                idx
                            }
                        };
                        if !state.message_item_added {
                            let item_added = json!({
                                "type": "response.output_item.added",
                                "output_index": message_output_index,
                                "item": {
                                    "id": &state.item_id,
                                    "type": "message",
                                    "role": "assistant",
                                    "phase": "commentary",
                                    "status": "in_progress",
                                    "content": []
                                }
                            });
                            send_ws_event(socket, ws_events, &item_added).await;

                            let part_added = json!({
                                "type": "response.content_part.added",
                                "item_id": &state.item_id,
                                "output_index": message_output_index,
                                "content_index": 0,
                                "part": {
                                    "type": "output_text",
                                    "text": ""
                                }
                            });
                            send_ws_event(socket, ws_events, &part_added).await;
                            state.message_item_added = true;
                            state.content_part_added = true;
                        }

                        let delta_ev = json!({
                            "type": "response.output_text.delta",
                            "item_id": &state.item_id,
                            "output_index": message_output_index,
                            "content_index": 0,
                            "delta": content
                        });
                        send_ws_event(socket, ws_events, &delta_ev).await;
                        state.accumulated_text.push_str(content);
                    }
                }

                if let Some(tool_calls) = delta.get("tool_calls").and_then(|v| v.as_array()) {
                    for tc in tool_calls {
                        let tc_idx = tc.get("index").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                        let tc_id = tc.get("id").and_then(|v| v.as_str()).unwrap_or("");
                        let tc_name = tc
                            .get("function")
                            .and_then(|f| f.get("name"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        let tc_args = tc
                            .get("function")
                            .and_then(|f| f.get("arguments"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");

                        if !tc_id.is_empty() || !tc_name.is_empty() {
                            let tool_item_id =
                                format!("item-{}", &Uuid::new_v4().to_string()[..16]);
                            let call_id = if tc_id.is_empty() {
                                format!("call_{}", &Uuid::new_v4().to_string()[..16])
                            } else {
                                tc_id.to_string()
                            };
                            state.tool_calls.insert(
                                tc_idx,
                                (
                                    tool_item_id,
                                    call_id.clone(),
                                    tc_name.to_string(),
                                    String::new(),
                                ),
                            );
                            if !tc_name.is_empty() {
                                // 临时插入一个包含 name 的 Value，最终会被 finalize_ws_events 里的完整 Value 覆盖
                                insert_cached_tool_call(call_id, json!({ "name": tc_name }));
                            }
                        }

                        if let Some((tool_item_id, call_id, name, args)) =
                            state.tool_calls.get_mut(&tc_idx)
                        {
                            args.push_str(tc_args);
                            let tool_output_index = match state.tool_output_indices.get(&tc_idx) {
                                Some(idx) => *idx,
                                None => {
                                    let idx = state.next_output_index;
                                    state.next_output_index += 1;
                                    state.tool_output_indices.insert(tc_idx, idx);
                                    idx
                                }
                            };

                            if !state.tool_calls_added.contains(&tc_idx) {
                                let (actual_name, namespace) = split_namespace_tool_name(name);
                                let mut item_obj = serde_json::json!({
                                    "id": tool_item_id,
                                    "type": "function_call",
                                    "status": "in_progress",
                                    "name": actual_name,
                                    "call_id": call_id,
                                    "arguments": ""
                                });
                                if let Some(ns) = namespace {
                                    item_obj["namespace"] = json!(ns);
                                }
                                let tool_added = json!({
                                    "type": "response.output_item.added",
                                    "output_index": tool_output_index,
                                    "item": item_obj
                                });
                                send_ws_event(socket, ws_events, &tool_added).await;
                                state.tool_calls_added.insert(tc_idx);
                            }

                            if !tc_args.is_empty() {
                                let args_delta = json!({
                                    "type": "response.function_call_arguments.delta",
                                    "item_id": tool_item_id,
                                    "output_index": tool_output_index,
                                    "delta": tc_args
                                });
                                send_ws_event(socket, ws_events, &args_delta).await;
                            }
                        }
                    }
                }
            }
        }
    }
}

pub async fn finalize_ws_events(
    state: &mut TranslationState,
    socket: &mut WebSocket,
    session_state: &mut WebsocketSessionState,
    ws_events: &mut Vec<Value>,
) -> Value {
    let mut output_items = Vec::new();
    let mut tool_keys: Vec<u32> = state.tool_calls.keys().cloned().collect();
    tool_keys.sort();

    for tc_idx in tool_keys {
        if let Some((tool_item_id, call_id, name, args)) = state.tool_calls.get(&tc_idx) {
            let tool_output_index = match state.tool_output_indices.get(&tc_idx) {
                Some(idx) => *idx,
                None => {
                    let idx = state.next_output_index;
                    state.next_output_index += 1;
                    state.tool_output_indices.insert(tc_idx, idx);
                    idx
                }
            };
            let args_done = json!({
                "type": "response.function_call_arguments.done",
                "item_id": tool_item_id,
                "output_index": tool_output_index,
                "arguments": args
            });
            send_ws_event(socket, ws_events, &args_done).await;

            let (actual_name, namespace) = split_namespace_tool_name(name);
            let mut item_obj = serde_json::json!({
                "id": tool_item_id,
                "type": "function_call",
                "status": "completed",
                "name": actual_name,
                "call_id": call_id,
                "arguments": args
            });
            if let Some(ns) = namespace {
                item_obj["namespace"] = json!(ns);
            }

            let tool_done = json!({
                "type": "response.output_item.done",
                "output_index": tool_output_index,
                "item": item_obj
            });
            send_ws_event(socket, ws_events, &tool_done).await;

            let tc_val = item_obj.clone();

            session_state
                .tool_call_cache
                .insert(call_id.clone(), tc_val.clone());
            insert_cached_tool_call(call_id.clone(), tc_val.clone());
            output_items.push(tc_val);
        }
    }

    if state.message_item_added {
        let message_output_index = state.message_output_index.unwrap_or(0);
        let text_done = json!({
            "type": "response.output_text.done",
            "item_id": &state.item_id,
            "output_index": message_output_index,
            "content_index": 0,
            "text": &state.accumulated_text
        });
        send_ws_event(socket, ws_events, &text_done).await;

        let part_done = json!({
            "type": "response.content_part.done",
            "item_id": &state.item_id,
            "output_index": message_output_index,
            "content_index": 0,
            "part": {
                "type": "output_text",
                "text": &state.accumulated_text
            }
        });
        send_ws_event(socket, ws_events, &part_done).await;

        let message_done = json!({
            "type": "response.output_item.done",
            "output_index": message_output_index,
            "item": {
                "id": &state.item_id,
                "type": "message",
                "role": "assistant",
                "phase": "final_answer",
                "status": "completed",
                "content": [{
                    "type": "output_text",
                    "text": &state.accumulated_text
                }]
            }
        });
        send_ws_event(socket, ws_events, &message_done).await;

        output_items.push(json!({
            "id": &state.item_id,
            "type": "message",
            "role": "assistant",
            "phase": "final_answer",
            "status": "completed",
            "content": [{
                "type": "output_text",
                "text": &state.accumulated_text
            }]
        }));
    }

    let completed_ev = json!({
        "type": "response.completed",
        "response": {
            "id": &state.response_id,
            "object": "response",
            "status": "completed",
            "output": output_items
        }
    });
    send_ws_event(socket, ws_events, &completed_ev).await;

    json!(output_items)
}

