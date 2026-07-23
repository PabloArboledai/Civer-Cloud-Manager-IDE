use axum::{response::IntoResponse, Json};
use reqwest::StatusCode;
use serde::Serialize;

#[derive(Serialize)]
pub struct SyncResponse {
    pub status: String,
    pub message: String,
}

pub async fn configure_syncthing_brain() -> impl IntoResponse {
    (StatusCode::OK, Json(SyncResponse {
        status: "success".to_string(),
        message: "Brain directory (.gemini/antigravity/brain) synced via Syncthing stub".to_string(),
    })).into_response()
}
