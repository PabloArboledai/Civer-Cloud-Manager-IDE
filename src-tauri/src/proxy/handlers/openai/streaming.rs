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

pub fn stream_chunk_has_error_event(bytes: &[u8]) -> bool {
    String::from_utf8_lossy(bytes).lines().any(|line| {
        let Some(data) = line.trim_start().strip_prefix("data:") else {
            return false;
        };
        let Ok(payload) = serde_json::from_str::<Value>(data.trim()) else {
            return false;
        };

        matches!(
            payload.get("type").and_then(Value::as_str),
            Some("error" | "response.failed")
        ) || payload.get("error").is_some_and(|error| !error.is_null())
    })
}

/// Visible Codex commentary is part of the local transcript, not Gemini
/// conversation history. Codex omits output item IDs when it replays a task, so
/// `phase=commentary` is the durable discriminator. The text-prefix fallback
/// heals tasks written by builds that accidentally finalized a thought blob as
/// a normal answer.

pub fn is_codex_transcript_only_assistant_message(item: &Value, text: &str) -> bool {
    if item.get("type").and_then(Value::as_str) != Some("message")
        || item.get("role").and_then(Value::as_str) != Some("assistant")
    {
        return false;
    }

    item.get("phase").and_then(Value::as_str) == Some("commentary")
        || item
            .get("id")
            .and_then(Value::as_str)
            .is_some_and(|id| id.starts_with(CODEX_VISIBLE_THOUGHT_MESSAGE_PREFIX))
        || text.trim_start().starts_with("**Thinking**")
}

#[cfg(test)]
mod stream_peek_tests {
    use super::is_codex_transcript_only_assistant_message;
    use super::stream_chunk_has_error_event;
    use serde_json::json;

    #[test]
    fn responses_created_with_null_error_is_not_an_error_event() {
        let chunk = br#"event: response.created
data: {"type":"response.created","response":{"status":"in_progress","error":null}}

"#;
        assert!(!stream_chunk_has_error_event(chunk));
    }

    #[test]
    fn response_failed_is_an_error_event() {
        let chunk = br#"event: response.failed
data: {"type":"response.failed","response":{"status":"failed","error":{"code":"upstream_error"}}}

"#;
        assert!(stream_chunk_has_error_event(chunk));
    }

    #[test]
    fn legacy_top_level_error_is_an_error_event() {
        let chunk = br#"data: {"error":{"message":"quota exceeded"}}

"#;
        assert!(stream_chunk_has_error_event(chunk));
    }

    #[test]
    fn normal_text_containing_error_is_not_an_error_event() {
        let chunk = br#"data: {"type":"response.output_text.delta","delta":"The JSON key is called \"error\"."}

"#;
        assert!(!stream_chunk_has_error_event(chunk));
    }

    #[test]
    fn identifies_codex_transcript_only_assistant_messages() {
        let thought = json!({
            "type": "message",
            "id": "msg_thought_abc_0",
            "role": "assistant",
            "phase": "commentary",
            "content": [{"type": "output_text", "text": "thinking"}],
        });
        let normal_commentary = json!({
            "type": "message",
            "role": "assistant",
            "phase": "commentary",
            "content": [{"type": "output_text", "text": "progress"}],
        });
        let contaminated_final = json!({
            "type": "message",
            "role": "assistant",
            "phase": "final_answer",
            "content": [{"type": "output_text", "text": "**Thinking**\n\nlegacy thought"}],
        });
        let clean_final = json!({
            "type": "message",
            "role": "assistant",
            "phase": "final_answer",
            "content": [{"type": "output_text", "text": "done"}],
        });

        assert!(is_codex_transcript_only_assistant_message(
            &thought, "thinking"
        ));
        assert!(is_codex_transcript_only_assistant_message(
            &normal_commentary,
            "progress"
        ));
        assert!(is_codex_transcript_only_assistant_message(
            &contaminated_final,
            "**Thinking**\n\nlegacy thought"
        ));
        assert!(!is_codex_transcript_only_assistant_message(
            &clean_final,
            "done"
        ));
    }
}

#[cfg(test)]
mod variant_tests {
    use crate::proxy::common::variant_mapping;
    use crate::proxy::mappers::openai::models::ThinkingConfig;

    #[test]
    fn openai_opus_preserves_client_budget_when_present() {
        let client_budget = Some(32_768);
        let spec = variant_mapping::resolve("claude-opus-4-6-thinking", client_budget)
            .expect("Claude Opus 4.6 thinking must resolve");
        let request_thinking = ThinkingConfig {
            thinking_type: Some("enabled".to_string()),
            budget_tokens: Some(spec.effective_thinking_budget(client_budget)),
            effort: None,
        };

        assert_eq!(request_thinking.budget_tokens, client_budget);
    }

    #[test]
    fn openai_opus_falls_back_to_spec_budget_when_client_budget_is_absent() {
        let client_budget = None;
        let spec = variant_mapping::resolve("claude-opus-4-6-thinking", client_budget)
            .expect("Claude Opus 4.6 thinking must resolve");
        let request_thinking = ThinkingConfig {
            thinking_type: Some("enabled".to_string()),
            budget_tokens: Some(spec.effective_thinking_budget(client_budget)),
            effort: None,
        };

        assert_eq!(request_thinking.budget_tokens, Some(1_024));
    }
}

