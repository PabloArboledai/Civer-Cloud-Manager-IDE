use axum::{extract::Json, response::IntoResponse};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Deserialize)]
pub struct TailscaleInstallRequest {
    pub auth_key: Option<String>,
}

#[derive(Serialize)]
pub struct TailscaleResponse {
    pub status: String,
    pub message: String,
}

pub async fn install_tailscale(Json(payload): Json<TailscaleInstallRequest>) -> impl IntoResponse {
    // Aquí implementaremos la lógica de descarga e instalación silenciosa
    // de Tailscale según el OS (usando Invoke-WebRequest en Win o curl en Linux).
    let msg = if let Some(key) = payload.auth_key {
        format!("Tailscale auth intent with key: {}", key)
    } else {
        "Tailscale install initialized without auth key.".to_string()
    };
    
    (StatusCode::OK, Json(TailscaleResponse {
        status: "success".to_string(),
        message: msg,
    })).into_response()
}

pub async fn up_tailscale(Json(payload): Json<TailscaleInstallRequest>) -> impl IntoResponse {
    let mut cmd = Command::new("tailscale");
    cmd.arg("up");
    
    if let Some(key) = payload.auth_key {
        cmd.arg(format!("--authkey={}", key));
    }
    
    match cmd.output() {
        Ok(out) => {
            let res = format!("Stdout: {}\nStderr: {}", 
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            );
            (StatusCode::OK, Json(TailscaleResponse { status: "success".to_string(), message: res })).into_response()
        },
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(TailscaleResponse { status: "error".to_string(), message: e.to_string() })).into_response()
        }
    }
}
