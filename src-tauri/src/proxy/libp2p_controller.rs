use std::process::Command;
use tracing::{info, warn, error};
use tokio::time::{sleep, Duration};

pub async fn start_libp2p_daemon() {
    info!("Starting Omni-Network Layer 9: IPFS/Libp2p PubSub");
    
    // IPFS daemon provides libp2p pubsub out of the box
    sleep(Duration::from_secs(8)).await;
    
    let mut cmd = Command::new("ipfs");
    cmd.arg("daemon");
    cmd.arg("--enable-pubsub-experiment");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    match cmd.spawn() {
        Ok(_) => {
            info!("IPFS/Libp2p Daemon (Layer 9) spawned successfully. Connecting to planetary pubsub network.");
        }
        Err(e) => {
            error!("Failed to execute ipfs. Is it installed? Error: {}", e);
        }
    }
}
