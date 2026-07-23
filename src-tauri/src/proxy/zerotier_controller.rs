use std::process::Command;
use tracing::{info, warn, error};
use tokio::time::{sleep, Duration};

pub async fn start_zerotier_daemon() {
    info!("Starting Omni-Network Layer 4: ZeroTier SDN");
    
    let network_id = std::env::var("ZEROTIER_NETWORK_ID").unwrap_or_default();
    
    // Fallback wait just in case
    sleep(Duration::from_secs(12)).await;
    
    let mut cmd = Command::new("zerotier-cli");
    
    if !network_id.is_empty() {
        cmd.arg("join").arg(network_id);
    } else {
        warn!("No ZEROTIER_NETWORK_ID provided, skipping auto-join.");
        return;
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    match cmd.output() {
        Ok(output) => {
            if output.status.success() {
                info!("ZeroTier (Layer 4) joined the network successfully.");
            } else {
                warn!("ZeroTier join returned non-zero status. Output: {:?}", String::from_utf8_lossy(&output.stderr));
            }
        }
        Err(e) => {
            error!("Failed to execute zerotier-cli. Is it installed? Error: {}", e);
        }
    }
}
