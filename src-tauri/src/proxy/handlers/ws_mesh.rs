use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use futures::{sink::SinkExt, stream::StreamExt};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshMessage {
    pub msg_type: String, // e.g. "CDP_ALERT", "SYSTEM_EXEC"
    pub target: Option<String>,
    pub payload: String,
}

pub async fn ws_mesh_handler(
    ws: WebSocketUpgrade,
    State(state): State<crate::proxy::server::AppState>,
) -> impl IntoResponse {
    let tx = state.mesh_tx.clone();
    ws.on_upgrade(move |socket| handle_socket(socket, tx))
}

async fn handle_socket(socket: WebSocket, tx: broadcast::Sender<MeshMessage>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = tx.subscribe();

    // Tarea para enviar mensajes del canal broadcast al cliente WebSocket
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    });

    // Tarea para recibir mensajes del cliente WebSocket y publicarlos al canal
    let tx_clone = tx.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            if let Ok(mesh_msg) = serde_json::from_str::<MeshMessage>(&text) {
                let _ = tx_clone.send(mesh_msg);
            }
        }
    });

    // Si cualquiera de las tareas termina, cerramos la conexión
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };
}
