use std::process::Command;
use tracing::{info, warn, error};
use tokio::time::{sleep, Duration};
use std::fs;

pub async fn start_tor_hidden_service() {
    info!("Starting Omni-Network Layer 5: Tor Hidden Service (.onion)");
    
    // We assume tor.exe is placed in the bin directory by the bootstrapper
    let tor_binary = "tor"; 
    
    // Create hidden service directory if it doesn't exist
    let _ = fs::create_dir_all("hidden_service");
    
    // Wait for other networking layers to settle
    sleep(Duration::from_secs(15)).await;
    
    let mut cmd = Command::new(tor_binary);
    cmd.arg("HiddenServiceDir").arg("hidden_service/");
    cmd.arg("HiddenServicePort").arg("8045 127.0.0.1:8045");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    match cmd.spawn() {
        Ok(_) => {
            info!("Tor Hidden Service (Layer 5) spawned successfully.");
        }
        Err(e) => {
            error!("Failed to execute tor. Is it installed? Error: {}", e);
        }
    }
}
