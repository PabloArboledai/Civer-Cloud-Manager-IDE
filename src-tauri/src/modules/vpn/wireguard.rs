use axum::{response::IntoResponse, Json};
use reqwest::StatusCode;
use serde::Serialize;

#[derive(Serialize)]
pub struct VpnResponse {
    pub status: String,
    pub message: String,
}

pub async fn install_wireguard() -> impl IntoResponse {
    (StatusCode::OK, Json(VpnResponse {
        status: "success".to_string(),
        message: "Wireguard installation stub".to_string(),
    })).into_response()
}
