import os
import re

MOD_PATH = r"C:\Users\Administrator\Desktop\Antigravity-Manager\src-tauri\src\proxy\handlers\openai\mod.rs"
DIR_PATH = os.path.dirname(MOD_PATH)

def extract_file():
    with open(MOD_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove all top-level or scattered use statements that are problematic
    # We will just replace them with empty strings.
    removals = [
        r"use std::sync::OnceLock;",
        r"use tokio::sync::RwLock as TokioRwLock;",
        r"use std::collections::HashMap;",
        r"use std::collections::VecDeque;",
        r"use uuid::Uuid;",
        r"use futures::{stream::StreamExt, SinkExt};",
        r"use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};",
        r"use super::common::{[^}]*};",
        r"use axum::http::HeaderMap;",
        r"use tokio::time::Duration;",
        r"use crate::modules::account;",
        r"use crate::proxy::common::client_adapter::CLIENT_ADAPTERS;.*?// \[NEW\] Adapter Registry",
        r"use crate::proxy::common::client_adapter::CLIENT_ADAPTERS;",
        r"use crate::proxy::session_manager::SessionManager;",
        r"use base64::Engine as _;"
    ]
    for r in removals:
        content = re.sub(r, "", content, flags=re.DOTALL)

    pattern = re.compile(
        r'^(///.*?|#\[.*?\]\s*)*(pub (async )?fn |(async )?fn |pub mod |mod |struct |pub struct |enum |pub enum |impl\s+(?:<.*?>\s+)?|static |pub static |const |pub const )([a-zA-Z0-9_]+)',
        re.MULTILINE
    )

    matches = list(pattern.finditer(content))
    
    top_matter = content[:matches[0].start()]
    
    blocks = []
    for i in range(len(matches)):
        start = matches[i].start()
        end = matches[i+1].start() if i + 1 < len(matches) else len(content)
        item_name = matches[i].group(5).strip()
        
        block_content = content[start:end].strip() + "\n"
        
        # Make things pub
        if block_content.startswith('fn '):
            block_content = 'pub ' + block_content
        elif block_content.startswith('async fn '):
            block_content = 'pub ' + block_content
        elif block_content.startswith('struct '):
            block_content = 'pub ' + block_content
        elif block_content.startswith('const '):
            block_content = 'pub ' + block_content
        elif block_content.startswith('static '):
            block_content = 'pub ' + block_content
            
        blocks.append({
            'name': item_name,
            'content': block_content
        })
        
    modules = {
        'streaming.rs': ['stream_chunk_has_error_event', 'is_codex_transcript_only_assistant_message', 'stream_peek_tests', 'variant_tests'],
        'utils.rs': ['compact_apply_patch_failure_output', 'codex_ledger_from_body', 'strip_codex_step_markers', 'prefix_with_step_marker', 'get_cached_tool_call', 'insert_cached_tool_call', 'WEBSOCKET_TOOL_CALL_CACHE', 'MAX_RETRY_ATTEMPTS', 'CODEX_VISIBLE_THOUGHT_MESSAGE_PREFIX', 'APPLY_PATCH_CHAT_PATH_SYSTEM_GUIDANCE_ZH', 'WEB_TOOLS_SYSTEM_GUIDANCE_ZH', 'CHINESE_LANGUAGE_DIRECTIVE', 'INTERNAL_BACKGROUND_TASK', 'CONTEXT_SUMMARY_PROMPT'],
        'chat.rs': ['handle_chat_completions'],
        'tools_mapping.rs': ['tools_register_apply_patch', 'tools_register_web_fetch', 'apply_patch_chat_guidance_message', 'web_tools_guidance_message', 'split_namespace_tool_name'],
        'completions.rs': ['handle_completions', 'call_openai_gemini_sync', 'try_compress_openai_with_summary'],
        'models.rs': ['handle_list_models'],
        'routing.rs': ['handle_chat_redirection', 'intercept_chat_to_image'],
        'images.rs': ['handle_images_generations', 'handle_images_generations_internal', 'handle_images_edits'],
        'websocket.rs': ['WebsocketSessionState', 'handle_responses_websocket', 'handle_websocket_session', 'should_handle_prewarm_locally', 'handle_prewarm_locally', 'normalize_responses_websocket_request', 'normalize_response_subsequent_request', 'should_replace_websocket_transcript', 'normalize_response_transcript_replacement', 'dedupe_input_items_by_id', 'dedupe_function_calls_by_call_id', 'repair_tool_calls', 'convert_codex_to_openai_request', 'TranslationState', 'send_ws_event', 'translate_openai_chunk_to_ws', 'finalize_ws_events']
    }

    import_block = """use super::*;
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
"""

    for mod_name, func_names in modules.items():
        mod_content = import_block + "\n"
        for block in blocks:
            if block['name'] in func_names:
                mod_content += block['content'] + "\n"
        
        with open(os.path.join(DIR_PATH, mod_name), 'w', encoding='utf-8') as f:
            f.write(mod_content)
            
    # Rewrite mod.rs
    mod_rs_content = top_matter + "\n"
    for mod_name in modules.keys():
        mod_stem = mod_name.split('.')[0]
        mod_rs_content += f"pub mod {mod_stem};\n"
        mod_rs_content += f"pub use {mod_stem}::*;\n"
        
    with open(MOD_PATH, 'w', encoding='utf-8') as f:
        f.write(mod_rs_content)

if __name__ == "__main__":
    extract_file()
