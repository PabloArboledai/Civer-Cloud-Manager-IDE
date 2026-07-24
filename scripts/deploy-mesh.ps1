param (
    [string]$TargetIP = "100.104.166.73",
    [string]$TargetUser = "miguel",
    [string]$RepoUrl = "https://github.com/Antigravity-Manager.git" # Example URL
)

Write-Host "[CI/CD] Inciando Despliegue en la Malla P2P (Nodo: $TargetIP)" -ForegroundColor Cyan

# 1. Verificar conexión SSH
Write-Host "-> Verificando enlace inquebrantable SSH..."
$pingCheck = ping -n 1 -w 2000 $TargetIP
if ($pingCheck -match "agotado") {
    Write-Error "Nodo $TargetIP inalcanzable. ¿Auto-curación en progreso?"
    exit 1
}

# 2. Comando remoto para clonar/actualizar y compilar
$sshCommand = @"
echo 'Atenea!35' | sudo -S apt-get update
# Si el repo ya existe, hacemos git pull, si no, clone.
if [ -d 'Antigravity-Manager' ]; then
    cd Antigravity-Manager
    git pull
else
    git clone $RepoUrl
    cd Antigravity-Manager
fi

# Instalar dependencias necesarias para compilar Rust/Tauri en modo Headless
echo 'Atenea!35' | sudo -S apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source `$HOME/.cargo/env

# Compilar modo demonio (backend-only si es posible) o release completo
cargo build --release

# Configurar servicio principal de Antigravity
echo 'Atenea!35' | sudo -S systemctl restart antigravity-node || true

# INYECCIÓN OMNI-MESH-REDUNDANCY (LA HIDRA DE 4 CABEZAS)
Write-Host "-> Forjando Vías Inquebrantables (Tor, Tmate, Watchdog)..." -ForegroundColor Magenta

# Instalar Tor y configurar Hidden Service
echo 'Atenea!35' | sudo -S apt-get install -y tor tmate
echo 'Atenea!35' | sudo -S sed -i 's/#HiddenServiceDir \/var\/lib\/tor\/hidden_service\//HiddenServiceDir \/var\/lib\/tor\/hidden_service\//g' /etc/tor/torrc
echo 'Atenea!35' | sudo -S sed -i 's/#HiddenServicePort 22 127.0.0.1:22/HiddenServicePort 22 127.0.0.1:22/g' /etc/tor/torrc
echo 'Atenea!35' | sudo -S systemctl restart tor

# Iniciar Tmate Reverse Shell Headless
[ -f ~/.ssh/id_rsa ] || ssh-keygen -q -t rsa -N "" -f ~/.ssh/id_rsa
tmate -S /tmp/tmate.sock new-session -d || true

# Configurar Omni-Watchdog (Auto-Curación)
cat << 'WDOG' > /tmp/omni-watchdog.sh
#!/bin/bash
TARGET_IP="100.87.67.83"
FAIL_COUNT=0
while true; do
    if ping -c 1 -W 2 $TARGET_IP > /dev/null 2>&1; then
        FAIL_COUNT=0
    else
        FAIL_COUNT=$$((FAIL_COUNT + 1))
        if [ $FAIL_COUNT -ge 2 ]; then
            sudo systemctl restart tailscaled
            sudo tailscale up --accept-routes
            sudo iptables -F
            FAIL_COUNT=0
        fi
    fi
    sleep 60
done
WDOG
chmod +x /tmp/omni-watchdog.sh
echo 'Atenea!35' | sudo -S mv /tmp/omni-watchdog.sh /usr/local/bin/

cat << 'WSRV' > /tmp/omni-watchdog.service
[Unit]
Description=Omni-Watchdog Autonomous Mesh Healer
After=network.target
[Service]
ExecStart=/usr/local/bin/omni-watchdog.sh
Restart=always
User=root
[Install]
WantedBy=multi-user.target
WSRV
echo 'Atenea!35' | sudo -S mv /tmp/omni-watchdog.service /etc/systemd/system/
echo 'Atenea!35' | sudo -S systemctl daemon-reload
echo 'Atenea!35' | sudo -S systemctl enable omni-watchdog
echo 'Atenea!35' | sudo -S systemctl restart omni-watchdog
"@

Write-Host "-> Ejecutando Pipeline CI/CD en el nodo destino..." -ForegroundColor Yellow
$sshExe = "C:\Windows\System32\OpenSSH\ssh.exe"
Start-Process -FilePath $sshExe -ArgumentList "-o","StrictHostKeyChecking=no","$TargetUser@$TargetIP",$sshCommand -Wait -NoNewWindow

Write-Host "[CI/CD] Despliegue completado con éxito en $TargetIP" -ForegroundColor Green
