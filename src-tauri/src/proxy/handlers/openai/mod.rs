// OpenAI Handler
use axum::{
    extract::Json, extract::State, http::StatusCode, response::IntoResponse, response::Response,
};

use bytes::Bytes;
use serde_json::{json, Value};
use tracing::{debug, error, info}; // Import Engine trait for encode method

use crate::proxy::mappers::openai::{
    transform_openai_request, transform_openai_response, OpenAIMessage, OpenAIRequest,
};
// use crate::proxy::upstream::client::UpstreamClient; // 通过 state 获取
use crate::proxy::debug_logger;
use crate::proxy::server::AppState;
use crate::proxy::upstream::client::mask_email;


pub mod streaming;
pub use streaming::*;
pub mod utils;
pub use utils::*;
pub mod chat;
pub use chat::*;
pub mod tools_mapping;
pub use tools_mapping::*;
pub mod completions;
pub use completions::*;
pub mod models;
pub use models::*;
pub mod routing;
pub use routing::*;
pub mod images;
pub use images::*;
pub mod websocket;
pub use websocket::*;
