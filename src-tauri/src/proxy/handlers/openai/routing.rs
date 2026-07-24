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
use futures::{stream::StreamExt, SinkExt};
use uuid::Uuid;
use tokio::sync::RwLock as TokioRwLock;
use std::sync::OnceLock;

pub async fn handle_chat_redirection(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    handle_chat_completions(State(state), headers, Json(body)).await
}

pub async fn intercept_chat_to_image(
    state: AppState,
    body: Value,
    model_name: &str,
) -> Result<Response, (StatusCode, String)> {
    // 1. Extract prompt from messages
    let mut prompt = String::new();
    if let Some(messages) = body.get("messages").and_then(|v| v.as_array()) {
        for msg in messages {
            if msg.get("role").and_then(|v| v.as_str()) == Some("user") {
                if let Some(content) = msg.get("content") {
                    if let Some(s) = content.as_str() {
                        prompt = s.to_string();
                    } else if let Some(arr) = content.as_array() {
                        for part in arr {
                            if part.get("type").and_then(|v| v.as_str()) == Some("text") {
                                prompt.push_str(
                                    part.get("text").and_then(|v| v.as_str()).unwrap_or(""),
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    if prompt.is_empty() {
        prompt = "A beautiful painting".to_string(); // fallback
    }

    let is_stream = body
        .get("stream")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // 2. Call internal image generator
    let img_req = json!({
        "prompt": prompt,
        "model": model_name,
        "n": 1,
        "response_format": "url"
    });

    match handle_images_generations_internal(state, img_req).await {
        Ok((email, img_res)) => {
            // Extract URL
            let mut img_markdown = String::new();
            if let Some(data) = img_res.get("data").and_then(|v| v.as_array()) {
                for item in data {
                    if let Some(url) = item.get("url").and_then(|v| v.as_str()) {
                        img_markdown.push_str(&format!("![Generated Image]({})\n\n", url));
                    }
                }
            }

            if img_markdown.is_empty() {
                img_markdown = "Failed to extract image URL from generation result.".to_string();
            }

            // 3. Construct Chat Completion Response
            if is_stream {
                use axum::body::Body;

                let chunk = json!({
                    "id": format!("chatcmpl-img-{}", uuid::Uuid::new_v4()),
                    "object": "chat.completion.chunk",
                    "created": chrono::Utc::now().timestamp(),
                    "model": model_name,
                    "choices": [{
                        "index": 0,
                        "delta": {
                            "role": "assistant",
                            "content": img_markdown
                        },
                        "finish_reason": null
                    }]
                });

                let done_chunk = json!({
                    "id": format!("chatcmpl-img-{}", uuid::Uuid::new_v4()),
                    "object": "chat.completion.chunk",
                    "created": chrono::Utc::now().timestamp(),
                    "model": model_name,
                    "choices": [{
                        "index": 0,
                        "delta": {},
                        "finish_reason": "stop"
                    }]
                });

                let sse_data = format!(
                    "data: {}\n\ndata: {}\n\ndata: [DONE]\n\n",
                    chunk.to_string(),
                    done_chunk.to_string()
                );

                let body = Body::from(sse_data);
                Ok(Response::builder()
                    .header("Content-Type", "text/event-stream")
                    .header("Cache-Control", "no-cache")
                    .header("X-Account-Email", email)
                    .body(body)
                    .unwrap())
            } else {
                let resp = json!({
                    "id": format!("chatcmpl-img-{}", uuid::Uuid::new_v4()),
                    "object": "chat.completion",
                    "created": chrono::Utc::now().timestamp(),
                    "model": model_name,
                    "choices": [{
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": img_markdown
                        },
                        "finish_reason": "stop"
                    }],
                    "usage": { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0 }
                });

                Ok((
                    StatusCode::OK,
                    [("X-Account-Email", email.as_str())],
                    Json(resp),
                )
                    .into_response())
            }
        }
        Err((status, msg, _email)) => Err((status, msg)),
    }
}

