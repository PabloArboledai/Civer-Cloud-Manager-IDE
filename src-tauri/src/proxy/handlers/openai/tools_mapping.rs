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

use tokio::sync::RwLock as TokioRwLock;
use std::sync::OnceLock;

pub fn tools_register_apply_patch(body: &Value) -> bool {
    let Some(tools) = body.get("tools").and_then(Value::as_array) else {
        return false;
    };
    tools.iter().any(|t| {
        t.get("name").and_then(Value::as_str) == Some("apply_patch")
            && (t.get("type").and_then(Value::as_str) == Some("custom")
                || t.get("type").and_then(Value::as_str) == Some("function"))
    })
}

pub fn tools_register_web_fetch(body: &Value) -> bool {
    fn entry_is_web_tool(t: &Value) -> bool {
        matches!(
            t.get("name").and_then(Value::as_str),
            Some("web_fetch") | Some("web_search")
        )
    }
    body.get("tools")
        .and_then(Value::as_array)
        .map(|tools| {
            tools.iter().any(|t| {
                if t.get("type").and_then(Value::as_str) == Some("namespace") {
                    t.get("tools")
                        .and_then(Value::as_array)
                        .is_some_and(|inner| inner.iter().any(entry_is_web_tool))
                } else {
                    entry_is_web_tool(t)
                }
            })
        })
        .unwrap_or(false)
}

pub fn apply_patch_chat_guidance_message() -> Value {
    let content =
        format!("{CHINESE_LANGUAGE_DIRECTIVE}\n\n{APPLY_PATCH_CHAT_PATH_SYSTEM_GUIDANCE_ZH}");
    serde_json::json!({
        "role": "system",
        "content": content,
    })
}

pub fn web_tools_guidance_message() -> Value {
    serde_json::json!({
        "role": "system",
        "content": WEB_TOOLS_SYSTEM_GUIDANCE_ZH,
    })
}

// --- END Codex GUIDANCE PROMPTS ---

/// 处理 Legacy Completions API (/v1/completions)
/// 将 Prompt 转换为 Chat Message 格式，复用 handle_chat_completions

pub fn split_namespace_tool_name(qualified_name: &str) -> (String, Option<String>) {
    let name = qualified_name.trim();
    if name.starts_with("mcp__") {
        return (name.to_string(), None);
    }
    if let Some(pos) = name.find("__") {
        if pos > 0 {
            let namespace = name[..pos].to_string();
            let actual_name = name[pos + 2..].to_string();
            return (actual_name, Some(namespace));
        }
    }
    (name.to_string(), None)
}

