use reqwest;
use serde_json::Value;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures::{SinkExt, StreamExt};
use std::time::Duration;

const CDP_HOST: &str = "http://127.0.0.1:9222";

pub fn start_listener(tx: tokio::sync::broadcast::Sender<crate::proxy::handlers::ws_mesh::MeshMessage>) {
    let mut rx = tx.subscribe();
    tokio::spawn(async move {
        tracing::info!("CDP Autopilot listener started");
        while let Ok(msg) = rx.recv().await {
            if msg.msg_type == "CDP_ALERT" {
                if let Ok(payload) = serde_json::from_str::<Value>(&msg.payload) {
                    if payload.get("action").and_then(|v| v.as_str()) == Some("ACCOUNT_ROTATED") {
                        let old_acc = payload.get("old").and_then(|v| v.as_str()).unwrap_or("");
                        let new_acc = payload.get("new").and_then(|v| v.as_str()).unwrap_or("");
                        
                        // Fire and forget the CDP trigger
                        let old_acc_owned = old_acc.to_string();
                        let new_acc_owned = new_acc.to_string();
                        tokio::spawn(async move {
                            if let Err(e) = trigger_ide_reload_and_resume(&old_acc_owned, &new_acc_owned).await {
                                tracing::error!("CDP Autopilot injection failed: {}", e);
                            }
                        });
                    }
                }
            }
        }
    });
}

pub async fn trigger_ide_reload_and_resume(old_account: &str, new_account: &str) -> Result<(), Box<dyn std::error::Error>> {
    tracing::info!("Starting CDP injection sequence: from {} to {}", old_account, new_account);
    
    // Helper closure to find the IDE tab
    let get_ide_ws_url = || async {
        let targets_url = format!("{}/json", CDP_HOST);
        let client = reqwest::Client::new();
        if let Ok(response) = client.get(&targets_url).timeout(Duration::from_secs(2)).send().await {
            if let Ok(targets) = response.json::<Vec<Value>>().await {
                if let Some(target) = targets.into_iter().find(|t| {
                    let title = t.get("title").and_then(|v| v.as_str()).unwrap_or("");
                    let url = t.get("url").and_then(|v| v.as_str()).unwrap_or("");
                    title.contains("Antigravity") || url.contains("localhost:") || url.contains("127.0.0.1:") || url.contains("antigravity")
                }) {
                    return target.get("webSocketDebuggerUrl").and_then(|v| v.as_str()).map(|s| s.to_string());
                }
            }
        }
        None
    };

    // --- STAGE 1: Reload ---
    if let Some(ws_url) = get_ide_ws_url().await {
        tracing::info!("Stage 1: Connecting to CDP WebSocket to reload: {}", ws_url);
        if let Ok((mut ws_stream, _)) = connect_async(&ws_url).await {
            let script = format!("window.location.reload();");
            let msg = serde_json::json!({
                "id": 1,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": script,
                    "returnByValue": true
                }
            });
            let _ = ws_stream.send(Message::Text(msg.to_string().into())).await;
            let _ = ws_stream.close(None).await;
        }
    } else {
        return Err("Antigravity IDE tab not found in CDP targets".into());
    }

    // Wait for the page to reload
    tracing::info!("Waiting 4 seconds for IDE to reload...");
    tokio::time::sleep(Duration::from_secs(4)).await;

    // --- STAGE 2: Inject Resume Prompt ---
    if let Some(ws_url) = get_ide_ws_url().await {
        tracing::info!("Stage 2: Re-connecting to CDP WebSocket to inject prompt: {}", ws_url);
        if let Ok((mut ws_stream, _)) = connect_async(&ws_url).await {
            let script = format!(
                r#"
                (function() {{
                    console.log('Antigravity Autopilot: Resuming chat...');
                    
                    // Encontrar el textarea (suele ser el input principal del chat)
                    let input = document.querySelector('textarea') || document.querySelector('input[type="text"]');
                    if (input) {{
                        let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                        if (!nativeInputValueSetter) {{
                            nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        }}
                        nativeInputValueSetter.call(input, '[SYSTEM] Rotación automática a cuenta {new_account} por bajo saldo. Continúa tu trabajo.');
                        let ev2 = new Event('input', {{ bubbles: true}});
                        input.dispatchEvent(ev2);
                        
                        // Intentar buscar el botón de enviar
                        setTimeout(() => {{
                            let buttons = document.querySelectorAll('button');
                            for (let btn of buttons) {{
                                // Buscar iconos de enviar o texto
                                if (btn.innerHTML.includes('send') || btn.innerHTML.includes('Enviar') || btn.querySelector('svg')) {{
                                    btn.click();
                                    break;
                                }}
                            }}
                        }}, 500);
                    }}
                }})();
                "#
            );

            let msg = serde_json::json!({
                "id": 2,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": script,
                    "returnByValue": true
                }
            });
            let _ = ws_stream.send(Message::Text(msg.to_string().into())).await;
            let _ = ws_stream.close(None).await;
            tracing::info!("CDP Autopilot resume sequence completed successfully.");
            return Ok(());
        }
    }
    
    Err("Failed to reconnect to Antigravity IDE after reload".into())
}
