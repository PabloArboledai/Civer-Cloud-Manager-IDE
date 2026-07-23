use std::process::Command;
use tracing::{info, warn, error};
use tokio::time::{sleep, Duration};

pub async fn start_i2p_daemon() {
    info!("Starting Omni-Network Layer 7: I2P (Invisible Internet Project)");
    
    // Fallback wait
    sleep(Duration::from_secs(18)).await;
    
    let mut cmd = Command::new("i2pd");
    cmd.arg("--daemon");
    cmd.arg("--sam.enabled=true"); // SAM bridge for programmatic access

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    match cmd.spawn() {
        Ok(_) => {
            info!("I2P Daemon (Layer 7) spawned successfully.");
        }
        Err(e) => {
            error!("Failed to execute i2pd. Is it installed? Error: {}", e);
        }
    }
}
