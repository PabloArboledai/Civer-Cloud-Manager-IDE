use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Router,
};
use serde::Deserialize;
use std::process::Command;
use tokio::task;

#[derive(Deserialize, Debug)]
pub struct WebhookPayload {
    pub ref_name: Option<String>,
    // Permite admitir campos de github o gitea si es necesario
}

/// Maneja el webhook de Gitea o Github
async fn update_webhook(
    State(_state): State<crate::proxy::server::AppState>,
    headers: HeaderMap,
    // Puedes inyectar el payload si necesitas extraer la rama
    // payload: Option<axum::Json<WebhookPayload>>,
) -> Result<impl IntoResponse, StatusCode> {
    // 1. Verificación del Secreto
    // Comprueba X-Hub-Signature-256 (GitHub) o X-Gitea-Signature
    // Por simplicidad en este MVP, comprobaremos un token personalizado
    let secret = headers
        .get("x-update-token")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");

    let expected_secret = std::env::var("WEBHOOK_SECRET").unwrap_or_else(|_| "civer_antigravity_secret_2026".to_string());

    if secret != expected_secret {
        tracing::warn!("Webhook denegado: Token inválido");
        return Err(StatusCode::UNAUTHORIZED);
    }

    tracing::info!("Webhook recibido y autorizado. Iniciando actualización en segundo plano...");

    // 2. Ejecutar la actualización en segundo plano para no bloquear el request
    task::spawn(async {
        tracing::info!("Ejecutando git pull...");
        
        let root_path = std::env::current_dir()
            .unwrap_or_default()
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .to_path_buf();

        let pull_status = Command::new("git")
            .current_dir(&root_path)
            .arg("pull")
            .arg("origin")
            .arg("main")
            .status();

        match pull_status {
            Ok(s) if s.success() => {
                tracing::info!("Git pull exitoso. Recompilando backend...");

                let build_status = Command::new("cargo")
                    .current_dir(root_path.join("src-tauri"))
                    .arg("build")
                    .arg("--release")
                    .status();

                if let Ok(b) = build_status {
                    if b.success() {
                        tracing::info!("Recompilación exitosa. Nota: El nuevo binario ha sido generado. Deberás reiniciar el servicio para aplicar los cambios.");
                        // Aquí se podría integrar un reinicio automático si es necesario
                    } else {
                        tracing::error!("Fallo en cargo build");
                    }
                }
            }
            _ => {
                tracing::error!("Git pull falló.");
            }
        }
    });

    Ok((StatusCode::ACCEPTED, "Update started"))
}

pub fn router() -> Router<crate::proxy::server::AppState> {
    Router::new().route("/update", post(update_webhook))
}
