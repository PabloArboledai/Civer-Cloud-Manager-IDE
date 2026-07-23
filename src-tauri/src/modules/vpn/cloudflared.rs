use axum::{response::IntoResponse, Json};
use reqwest::StatusCode;
use serde::Serialize;

#[derive(Serialize)]
pub struct VpnResponse {
    pub status: String,
    pub message: String,
}

pub async fn install_cloudflared() -> impl IntoResponse {
    (StatusCode::OK, Json(VpnResponse {
        status: "success".to_string(),
        message: "Cloudflared installation stub".to_string(),
    })).into_response()
}
