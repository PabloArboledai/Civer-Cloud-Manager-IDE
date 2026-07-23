use std::time::Duration;
use tokio::time::sleep;
use crate::modules::command_runner_db;
use crate::modules::logger;
use std::process::Command;
use tauri::{AppHandle, Emitter};

// A simple abstraction to represent our target nodes (e.g. HP One, Modal, VPS)
const HP_ONE_IP: &str = "192.168.1.93"; // Local or Tailscale IP

#[derive(Clone, serde::Serialize)]
struct MeshNodeEvent {
    node_name: String,
    status: String,
    latency_ms: u32,
    bandwidth_mbps: u32,
}

pub async fn start_reconnection_loop(app_handle: AppHandle) {
    logger::log_info("Starting Auto-Connector and Durable Command Engine...");
    
    loop {
        // Step 1: Ping the nodes to detect connection status and latency
        let start_ping = std::time::Instant::now();
        let is_connected = check_ssh_connection(HP_ONE_IP).await;
        let latency = start_ping.elapsed().as_millis() as u32;
        
        let _ = app_handle.emit("mesh-telemetry", MeshNodeEvent {
            node_name: "hp-one-ubuntu".to_string(),
            status: if is_connected { "ONLINE".to_string() } else { "OFFLINE".to_string() },
            latency_ms: if is_connected { latency } else { 0 },
            bandwidth_mbps: if is_connected { 120 } else { 0 } // Simulated bandwidth cap
        });
        
        // Also emit local VPS status 
        let _ = app_handle.emit("mesh-telemetry", MeshNodeEvent {
            node_name: "vps-windows-core".to_string(),
            status: "ONLINE".to_string(),
            latency_ms: 12, // Minimal loopback latency
            bandwidth_mbps: 850 // Internal hypervisor link
        });

        if is_connected {
            logger::log_info(&format!("Node {} is ONLINE", HP_ONE_IP));
            
            // Step 2: Handle commands that were running when we previously disconnected
            let _ = recover_disconnected_commands(HP_ONE_IP).await;
            
            // Step 3: Run pending commands
            let _ = process_pending_commands(HP_ONE_IP).await;

            // Step 4: Real-time P2P Mesh Synchronization
            let _ = sync_mesh_state(HP_ONE_IP).await;
        } else {
            // Node is offline, mark any running commands for this node as disconnected
            let _ = command_runner_db::mark_running_as_disconnected(HP_ONE_IP);
        }
        
        // Wait 3 seconds before next ping to update the real-time helicopter UI rapidly
        sleep(Duration::from_secs(3)).await;
    }
}

async fn check_ssh_connection(ip: &str) -> bool {
    // This uses the native Windows SSH client with a 3-second timeout
    let status = Command::new("C:\\Windows\\System32\\OpenSSH\\ssh.exe")
        .arg("-o")
        .arg("StrictHostKeyChecking=no")
        .arg("-o")
        .arg("ConnectTimeout=3")
        .arg(&format!("miguel@{}", ip))
        .arg("echo 1")
        .output();
        
    match status {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

async fn process_pending_commands(ip: &str) -> Result<(), String> {
    let pending = command_runner_db::get_commands_by_status("PENDING")?;
    
    for cmd in pending {
        if cmd.node_ip == ip {
            logger::log_info(&format!("Running pending command [{}] on node {}", cmd.id, ip));
            
            // Mark as running
            command_runner_db::update_command_status(&cmd.id, "RUNNING", None, None)?;
            
            // Execute the command remotely
            let output = Command::new("C:\\Windows\\System32\\OpenSSH\\ssh.exe")
                .arg("-o")
                .arg("StrictHostKeyChecking=no")
                .arg(&format!("miguel@{}", ip))
                .arg(&cmd.command_text)
                .output();
                
            match output {
                Ok(out) => {
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                    
                    let new_status = if out.status.success() { "COMPLETED" } else { "FAILED" };
                    command_runner_db::update_command_status(
                        &cmd.id, 
                        new_status, 
                        Some(&stdout), 
                        Some(&stderr)
                    )?;
                },
                Err(e) => {
                    command_runner_db::update_command_status(
                        &cmd.id, 
                        "FAILED", 
                        None, 
                        Some(&e.to_string())
                    )?;
                }
            }
        }
    }
    
    Ok(())
}

async fn recover_disconnected_commands(ip: &str) -> Result<(), String> {
    // These are commands that were in "RUNNING" state when the ping loop detected a disconnection.
    // Instead of re-running them (which is unsafe), we mark them as FAILED for manual intervention
    // or try to fetch their logs from the remote node if we implement remote log files in the future.
    let disconnected = command_runner_db::get_commands_by_status("DISCONNECTED")?;
    
    for cmd in disconnected {
        if cmd.node_ip == ip {
            logger::log_info(&format!("Recovering disconnected command [{}] on node {}", cmd.id, ip));
            
            // Currently, we simply mark them as failed to prevent double-execution of destructive commands.
            // Future implementation: SSH into the box and read a log file.
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

use std::sync::atomic::{AtomicUsize, Ordering};
static LAST_SYNC_HASH: AtomicUsize = AtomicUsize::new(0);

async fn sync_mesh_state(ip: &str) -> Result<(), String> {
    // We only push if our state has changed or we just started up
    // Generate the state payload
    let payload_result = crate::commands::export_full_state().await;
    
    if let Ok(payload) = payload_result {
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        payload.hash(&mut hasher);
        let current_hash = hasher.finish() as usize;
        
        let last_hash = LAST_SYNC_HASH.load(Ordering::SeqCst);
        
        if current_hash != last_hash {
            // State changed, push it
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
                    LAST_SYNC_HASH.store(current_hash, Ordering::SeqCst);
                }
                Ok(resp) => {
                    logger::log_warn(&format!("Failed to sync state to node {}: HTTP {}", ip, resp.status()));
                }
                Err(e) => {
                    // Node's HTTP server might not be up yet, that's fine, we'll try next tick since we didn't update LAST_SYNC_HASH
                    logger::log_warn(&format!("Node {} API offline during state sync: {}", ip, e));
                }
            }
        }
    }
    
    Ok(())
}
