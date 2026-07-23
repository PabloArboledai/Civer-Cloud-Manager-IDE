use axum::{
    extract::Json,
    response::IntoResponse,
};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Deserialize)]
pub struct ExecRequest {
    pub command: String,
    pub args: Option<Vec<String>>,
}

#[derive(Serialize)]
pub struct ExecResponse {
    pub stdout: String,
    pub stderr: String,
    pub status: i32,
}

/// 执行系统命令 (RCE Autorizado)
pub async fn admin_system_exec(Json(payload): Json<ExecRequest>) -> impl IntoResponse {
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("powershell");
        c.arg("-Command").arg(&payload.command);
        c
    } else {
        let mut c = Command::new("bash");
        c.arg("-c").arg(&payload.command);
        c
    };

    if let Some(ref args) = payload.args {
        cmd.args(args);
    }

    match cmd.output() {
        Ok(output) => {
            let res = ExecResponse {
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                status: output.status.code().unwrap_or(-1),
            };
            (StatusCode::OK, Json(res)).into_response()
        }
        Err(e) => {
            let res = ExecResponse {
                stdout: "".to_string(),
                stderr: format!("Failed to execute command: {}", e),
                status: -1,
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(res)).into_response()
        }
    }
}
