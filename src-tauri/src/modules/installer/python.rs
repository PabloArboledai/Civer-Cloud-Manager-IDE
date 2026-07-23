use axum::{response::IntoResponse, Json};
use reqwest::StatusCode;
use serde::Serialize;

#[derive(Serialize)]
pub struct InstallResponse {
    pub status: String,
    pub message: String,
}

pub async fn install_python_env() -> impl IntoResponse {
    (StatusCode::OK, Json(InstallResponse {
        status: "success".to_string(),
        message: "Python environment (uv) install stub".to_string(),
    })).into_response()
}
