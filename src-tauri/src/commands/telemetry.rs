use crate::modules::logger;

#[tauri::command]
pub async fn log_frontend_event(level: String, message: String, payload: Option<String>) -> Result<(), String> {
    let payload_str = payload.unwrap_or_else(|| "".to_string());
    let log_msg = if payload_str.is_empty() {
        format!("[Frontend] {}", message)
    } else {
        format!("[Frontend] {} | Payload: {}", message, payload_str)
    };

    match level.to_lowercase().as_str() {
        "error" => logger::log_error(&log_msg),
        "warn" => logger::log_warn(&log_msg),
        _ => logger::log_info(&log_msg),
    }

    Ok(())
}
