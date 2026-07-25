use std::time::Duration;
use tokio::time::sleep;
use crate::modules::command_runner_db;
use crate::modules::logger;
use std::process::Command;
use tauri::{AppHandle, Emitter};

// A list of known peer nodes in our Mesh Network
const KNOWN_PEERS: &[(&str, &str, &str)] = &[
    ("192.168.1.93", "hp-one-ubuntu", "SSH/HTTP"),
    ("100.96.218.12", "laptop-thinkpad", "WinRM/HTTP"),
];

#[derive(Clone, serde::Serialize)]
struct MeshNodeEvent {
    node_name: String,
    ip: String,
    status: String,
    latency_ms: u32,
    bandwidth_mbps: u32,
    protocol: String,
    sync_status: String,
    // Nuevos campos de telemetría extendida
    app_installed: bool,
    app_running: bool,
    os_type: String,
    supported_protocols: Vec<String>,
}

use std::sync::atomic::{AtomicUsize, Ordering};
use std::collections::HashMap;
use std::sync::Mutex;
use lazy_static::lazy_static;

lazy_static! {
    static ref PEER_SYNC_HASHES: Mutex<HashMap<String, usize>> = Mutex::new(HashMap::new());
}

pub async fn start_reconnection_loop(app_handle: AppHandle) {
    logger::log_info("Starting Auto-Connector and Durable Command Engine...");
    
    loop {
        // Emit local VPS status 
        let _ = app_handle.emit("mesh-telemetry", MeshNodeEvent {
            node_name: "vps-windows-core".to_string(),
            ip: "localhost".to_string(),
            status: "ONLINE".to_string(),
            latency_ms: 12,
            bandwidth_mbps: 850,
            protocol: "Local Loopback".to_string(),
            sync_status: "Synced".to_string(),
            app_installed: true,
            app_running: true,
            os_type: "Windows Server".to_string(),
            supported_protocols: vec!["RDP".to_string(), "SSH".to_string()],
        });

        for &(ip, name, protocol) in KNOWN_PEERS {
            // Step 1: Ping the nodes to detect connection status and latency
            let start_ping = std::time::Instant::now();
            let is_connected = check_ssh_connection(ip, name).await;
            let latency = start_ping.elapsed().as_millis() as u32;
            
            // Detección de OS
            let is_windows = name.to_lowercase().contains("windows") || name.to_lowercase().contains("thinkpad");
            let is_ubuntu = name.to_lowercase().contains("ubuntu");
            
            let os_type = if is_windows {
                "Windows 11"
            } else if is_ubuntu {
                "Ubuntu Linux"
            } else {
                "Unknown"
            }.to_string();

            let mut supported_protocols = vec![];
            if is_windows { supported_protocols.push("RDP".to_string()); }
            supported_protocols.push("SSH".to_string());
            supported_protocols.push("FTP".to_string());

            // Simularemos la detección de la app (En un caso real se usa ssh para comprobar que exista la ruta y el proceso)
            // Por defecto diremos que si está conectado, y tiene SSH/WinRM, la app está instalada, pero podría no estar corriendo
            let app_installed = true; 
            // Si responde rápido (latency < 200) asumimos corriendo
            let app_running = is_connected && latency < 200;

            // Step 4: Real-time P2P Mesh Synchronization
            let mut sync_status = "Desynchronized".to_string();
            if is_connected {
                logger::log_info(&format!("Node {} ({}) is ONLINE", name, ip));
                
                // Step 2: Handle commands that were running when we previously disconnected
                let _ = recover_disconnected_commands(ip, name).await;
                
                // Step 3: Run pending commands
                let _ = process_pending_commands(ip, name).await;

                // Sync Mesh state
                if sync_mesh_state(ip).await.is_ok() {
                    sync_status = "Synced".to_string();
                }
            } else {
                // Node is offline, mark any running commands for this node as disconnected
                let _ = command_runner_db::mark_running_as_disconnected(ip);
            }

            let _ = app_handle.emit("mesh-telemetry", MeshNodeEvent {
                node_name: name.to_string(),
                ip: ip.to_string(),
                status: if is_connected { "ONLINE".to_string() } else { "OFFLINE".to_string() },
                latency_ms: if is_connected { latency } else { 0 },
                bandwidth_mbps: if is_connected { 120 } else { 0 },
                protocol: protocol.to_string(),
                sync_status,
                app_installed,
                app_running,
                os_type,
                supported_protocols,
            });
        }
        
        // Wait 3 seconds before next ping
        sleep(Duration::from_secs(3)).await;
    }
}

async fn check_ssh_connection(ip: &str, name: &str) -> bool {
    // If it's a Windows node (thinkpad), we might not have SSH enabled, but for pinging, we can use a basic network ping
    // Since we use WinRM for laptop, and SSH for ubuntu, let's do a basic ping to check if it's reachable.
    let mut cmd = Command::new("ping");
    cmd.arg("-n").arg("1").arg("-w").arg("1000").arg(ip);
        
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    let status = cmd.output();
        
    match status {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

async fn process_pending_commands(ip: &str, name: &str) -> Result<(), String> {
    let pending = command_runner_db::get_commands_by_status("PENDING")?;
    
    for cmd in pending {
        if cmd.node_ip == ip {
            logger::log_info(&format!("Running pending command [{}] on node {}", cmd.id, name));
            
            command_runner_db::update_command_status(&cmd.id, "RUNNING", None, None)?;
            
            // For simplicity, assuming SSH for all remote execution in this prototype
            let mut cmd_exec = Command::new("C:\\Windows\\System32\\OpenSSH\\ssh.exe");
            cmd_exec.arg("-o")
                .arg("StrictHostKeyChecking=no")
                .arg(&format!("miguel@{}", ip))
                .arg(&cmd.command_text);
                
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                cmd_exec.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }
            
            let output = cmd_exec.output();
                
            match output {
                Ok(out) => {
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                    let new_status = if out.status.success() { "COMPLETED" } else { "FAILED" };
                    command_runner_db::update_command_status(&cmd.id, new_status, Some(&stdout), Some(&stderr))?;
                },
                Err(e) => {
                    command_runner_db::update_command_status(&cmd.id, "FAILED", None, Some(&e.to_string()))?;
                }
            }
        }
    }
    
    Ok(())
}

async fn recover_disconnected_commands(ip: &str, name: &str) -> Result<(), String> {
    let disconnected = command_runner_db::get_commands_by_status("DISCONNECTED")?;
    
    for cmd in disconnected {
        if cmd.node_ip == ip {
            logger::log_info(&format!("Recovering disconnected command [{}] on node {}", cmd.id, name));
            command_runner_db::update_command_status(
                &cmd.id, 
                "FAILED", 
                None, 
                Some("Command execution state lost due to network disconnection. Safely aborted to prevent double execution.")
            )?;
        }
    }
    
    Ok(())
}

async fn sync_mesh_state(ip: &str) -> Result<(), String> {
    let payload_result = crate::commands::export_full_state().await;
    
    if let Ok(payload) = payload_result {
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        payload.hash(&mut hasher);
        let current_hash = hasher.finish() as usize;
        
        let last_hash = {
            let map = PEER_SYNC_HASHES.lock().unwrap();
            map.get(ip).copied().unwrap_or(0)
        };
        
        if current_hash != last_hash {
            logger::log_info(&format!("Local mesh state changed (hash: {}), syncing with node {}", current_hash, ip));
            
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .map_err(|e| e.to_string())?;
                
            let url = format!("http://{}:8045/api/downloads/sync_mesh", ip);
            
            match client.post(&url)
                .header("Content-Type", "application/json")
                .body(payload)
                .send()
                .await {
                Ok(resp) if resp.status().is_success() => {
                    logger::log_info(&format!("Successfully synced state to node {}", ip));
                    let mut map = PEER_SYNC_HASHES.lock().unwrap();
                    map.insert(ip.to_string(), current_hash);
                    return Ok(());
                }
                Ok(resp) => {
                    logger::log_warn(&format!("Failed to sync state to node {}: HTTP {}", ip, resp.status()));
                    return Err(format!("HTTP {}", resp.status()));
                }
                Err(e) => {
                    logger::log_warn(&format!("Node {} API offline during state sync: {}", ip, e));
                    return Err(e.to_string());
                }
            }
        } else {
            return Ok(()); // Already synced
        }
    }
    
    Err("Failed to generate export payload".to_string())
}
