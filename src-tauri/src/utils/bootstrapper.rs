use std::process::Command;
use std::path::PathBuf;
use std::fs;

pub async fn run_bootstrap() -> Result<(), String> {
    tracing::info!("Running system bootstrapper...");
    
    // 1. Install Git if missing
    if !is_installed("git") {
        tracing::warn!("Git not found. Attempting to install via winget...");
        install_via_winget("Git.Git").await?;
    }
    
    // 2. Install Node.js if missing
    if !is_installed("node") {
        tracing::warn!("Node.js not found. Attempting to install via winget...");
        install_via_winget("OpenJS.NodeJS").await?;
    }
    
    // 3. Ensure Syncthing is available in our isolated bin folder
    if let Err(e) = ensure_syncthing().await {
        tracing::error!("Failed to bootstrap Syncthing: {}", e);
    }
    
    // 4. [Omni-Network Layer 1] Install Tailscale if missing
    if !is_installed("tailscale") {
        tracing::warn!("Tailscale not found. Attempting to install via winget...");
        install_via_winget("Tailscale.Tailscale").await?;
    }
    
    // 5. [Omni-Network Layer 2] Install Cloudflared if missing
    if !is_installed("cloudflared") {
        tracing::warn!("Cloudflared not found. Attempting to install via winget...");
        install_via_winget("Cloudflare.cloudflared").await?;
    }

    // 6. [Omni-Network Layer 4] Install ZeroTier if missing
    if !is_installed("zerotier-cli") {
        tracing::warn!("ZeroTier not found. Attempting to install via winget...");
        install_via_winget("ZeroTier.ZeroTierOne").await?;
    }
    
    // Note: Tor (Layer 5) needs a custom download script, we'll assume it's pre-packaged for now or add it later to the download logic.
    
    tracing::info!("Bootstrapper completed successfully.");
    Ok(())
}

fn is_installed(cmd: &str) -> bool {
    Command::new("powershell")
        .args(&["-NoProfile", "-Command", &format!("Get-Command {} -ErrorAction SilentlyContinue", cmd)])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

async fn install_via_winget(package: &str) -> Result<(), String> {
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-Command", &format!("winget install --id {} --accept-package-agreements --accept-source-agreements --silent", package)])
        .output()
        .map_err(|e| e.to_string())?;
        
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Winget failed to install {}: {}", package, err));
    }
    Ok(())
}

async fn ensure_syncthing() -> Result<(), String> {
    let app_dir = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Administrator".to_string());
    let bin_dir = PathBuf::from(format!(r"{}\.gemini\antigravity\bin", app_dir));
    
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;
    }
    
    let exe_path = bin_dir.join("syncthing.exe");
    if !exe_path.exists() {
        tracing::info!("Downloading Syncthing...");
        // Download Syncthing using PowerShell
        let script = r#"
            $ProgressPreference = 'SilentlyContinue'
            $url = "https://github.com/syncthing/syncthing/releases/download/v1.27.7/syncthing-windows-amd64-v1.27.7.zip"
            $zipPath = "$env:TEMP\syncthing.zip"
            Invoke-WebRequest -Uri $url -OutFile $zipPath
            Expand-Archive -Path $zipPath -DestinationPath "$env:TEMP\syncthing_ext" -Force
            Move-Item -Path "$env:TEMP\syncthing_ext\syncthing-windows-amd64-v1.27.7\syncthing.exe" -Destination "$env:USERPROFILE\.gemini\antigravity\bin\syncthing.exe" -Force
            Remove-Item -Path $zipPath -Force
            Remove-Item -Path "$env:TEMP\syncthing_ext" -Recurse -Force
        "#;
        
        let output = Command::new("powershell")
            .args(&["-NoProfile", "-Command", script])
            .output()
            .map_err(|e| e.to_string())?;
            
        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to download Syncthing: {}", err));
        }
    }
    Ok(())
}
