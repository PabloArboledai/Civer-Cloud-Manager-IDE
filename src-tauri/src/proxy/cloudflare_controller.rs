use std::process::Command;
use tracing::{info, warn, error};
use tokio::time::{sleep, Duration};

pub async fn start_cloudflare_tunnel() {
    info!("Starting Omni-Network Layer 2: Cloudflare Tunnels");
    
    let token = std::env::var("CLOUDFLARE_TUNNEL_TOKEN").unwrap_or_default();
    
    sleep(Duration::from_secs(10)).await;
    
    let mut cmd = Command::new("cloudflared");
    
    // FORZAR HTTP2 SOBRE TCP: Fundamental para que el sitio cargue correctamente en 
    // redes móviles (Datos) y fuera de la VPS. El protocolo por defecto (QUIC/UDP) 
    // a menudo es bloqueado.
    cmd.arg("--protocol").arg("http2");

    if !token.is_empty() {
        cmd.arg("tunnel").arg("run").arg("--token").arg(token);
    } else {
        // Quick tunnel fallback to expose the local mesh port 8045
        cmd.arg("tunnel").arg("--url").arg("http://127.0.0.1:8045");
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    match cmd.spawn() {
        Ok(_) => {
            info!("Cloudflare Tunnel (Layer 2) spawned successfully.");
        }
        Err(e) => {
            error!("Failed to execute cloudflared CLI. Is it installed? Error: {}", e);
        }
    }
}
