use axum::{
    body::Body,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::path::Path;
use tokio::fs::File;
use tokio_util::io::ReaderStream;

/// Devuelve el ejecutable principal
async fn download_release() -> Result<impl IntoResponse, StatusCode> {
    let file_path = Path::new("C:\\Program Files\\antigravity.civer.cloud\\antigravity_tools.exe");
    
    // Si no existe ahí, buscar en target/release (para desarrollo)
    let path = if file_path.exists() {
        file_path.to_path_buf()
    } else {
        Path::new("target\\release\\antigravity_tools.exe").to_path_buf()
    };

    if !path.exists() {
        tracing::error!("Release executable not found at {:?}", path);
        return Err(StatusCode::NOT_FOUND);
    }

    let file = match File::open(&path).await {
        Ok(file) => file,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let headers = [
        (header::CONTENT_TYPE, "application/octet-stream"),
        (
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"antigravity_tools.exe\"",
        ),
    ];

    Ok((headers, body))
}

/// Genera un ZIP del código fuente en tiempo real y lo sirve
async fn download_source() -> Result<impl IntoResponse, StatusCode> {
    // Definimos el path temporal para el ZIP
    let zip_path = std::env::temp_dir().join("antigravity-manager-source.zip");
    
    // El root path es un nivel arriba de src-tauri
    let root_path = std::env::current_dir()
        .unwrap_or_default()
        .parent()
        .unwrap_or(Path::new("."))
        .to_path_buf();

    tracing::info!("Generando archivo ZIP del código fuente en {:?}", zip_path);

    // Usamos tar de Windows (bsdtar) para comprimir
    let status = tokio::process::Command::new("tar")
        .current_dir(&root_path)
        .arg("-a")
        .arg("-c")
        .arg("-f")
        .arg(&zip_path)
        .arg("--exclude=node_modules")
        .arg("--exclude=src-tauri/target")
        .arg("--exclude=.git")
        .arg(".")
        .status()
        .await;

    match status {
        Ok(s) if s.success() => {
            tracing::info!("ZIP generado exitosamente");
        }
        _ => {
            tracing::error!("Falló la generación del ZIP con tar");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    let file = match File::open(&zip_path).await {
        Ok(file) => file,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let headers = [
        (header::CONTENT_TYPE, "application/zip"),
        (
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"antigravity_manager_source.zip\"",
        ),
    ];

    Ok((headers, body))
}

pub fn router() -> Router<crate::proxy::server::AppState> {
    Router::new()
        .route("/source", get(download_source))
        .route("/release", get(download_release))
}
