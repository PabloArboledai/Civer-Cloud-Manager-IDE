use std::process::Command;
use tracing::{info, warn, error};
use tokio::time::{sleep, Duration};

pub async fn start_tailscale_daemon() {
    info!("Starting Omni-Network Layer 1: Tailscale (P2P VPN)");
    
    // We try to grab the Auth Key from env (or secure storage).
    // If not present, we will just run `tailscale up` and the user might need to authenticate manually once.
    let auth_key = std::env::var("TAILSCALE_AUTH_KEY").unwrap_or_default();
    
    // Give it a few seconds to ensure the tailscale service is running after bootstrapper
    sleep(Duration::from_secs(5)).await;
    
    let mut cmd = Command::new("tailscale");
    cmd.arg("up");
    
    if !auth_key.is_empty() {
        cmd.arg("--authkey").arg(auth_key);
    }
    
    // We want to accept routes if this node is acting as a subnet router
    cmd.arg("--accept-routes");

    // Execute silently
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    match cmd.output() {
        Ok(output) => {
            if output.status.success() {
                info!("Tailscale Layer 1 initialized successfully.");
            } else {
                warn!("Tailscale initialization returned non-zero status. It might already be up or require manual auth. Output: {:?}", String::from_utf8_lossy(&output.stderr));
            }
        }
        Err(e) => {
            error!("Failed to execute tailscale CLI. Is it installed? Error: {}", e);
        }
    }
}
