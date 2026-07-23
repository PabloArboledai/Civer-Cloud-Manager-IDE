use axum::{response::IntoResponse, Json};
use reqwest::StatusCode;
use serde::Serialize;

#[derive(Serialize)]
pub struct InstallResponse {
    pub status: String,
    pub message: String,
}

pub async fn install_antigravity_sdk() -> impl IntoResponse {
    (StatusCode::OK, Json(InstallResponse {
        status: "success".to_string(),
        message: "Antigravity SDK install stub".to_string(),
    })).into_response()
}
