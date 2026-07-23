use std::process::Command;
use tracing::{info, warn, error};
use tokio::time::{sleep, Duration};

pub async fn start_yggdrasil_network() {
    info!("Starting Omni-Network Layer 8: Yggdrasil Mesh Network");
    
    // Fallback wait
    sleep(Duration::from_secs(6)).await;
    
    let mut cmd = Command::new("yggdrasil");
    cmd.arg("-useconffile").arg("yggdrasil.conf"); // Assuming config is generated or present

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    match cmd.spawn() {
        Ok(_) => {
            info!("Yggdrasil Network (Layer 8) spawned successfully. Connecting to public IPv6 mesh.");
        }
        Err(e) => {
            error!("Failed to execute yggdrasil. Is it installed? Error: {}", e);
        }
    }
}
