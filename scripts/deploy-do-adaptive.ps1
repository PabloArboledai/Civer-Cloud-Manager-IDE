param(
    [string[]]$Droplets = @("167.71.180.226", "174.138.61.18", "64.225.54.211"),
    [string]$SshUser = "root"
)

Write-Host "Iniciando Despliegue Adaptativo a Múltiples Nodos (Omni-Mesh)..."

foreach ($ip in $Droplets) {
    Write-Host "`n======================================================="
    Write-Host "[DEPLOY] Analizando y desplegando en $ip..."
    
    # 1. Medir CPU y RAM remotamente
    $cpuRaw = ssh -o ConnectTimeout=10 $SshUser@$ip "nproc"
    $memRaw = ssh -o ConnectTimeout=10 $SshUser@$ip "free -m | grep Mem | awk '{print `$2}'"
    
    if (-not $cpuRaw -or -not $memRaw) {
        Write-Error "[DEPLOY] Falló la conexión SSH a $ip. Saltando nodo."
        continue
    }

    $cpu = [int]$cpuRaw.Trim()
    $mem = [int]$memRaw.Trim()
    
    Write-Host "[NODE INFO] IP: $ip | CPU: $cpu cores | RAM: ${mem}MB"
    
    $cargoFlags = "--release"
    $envVars = "PORT=1420 RUST_LOG=info"
    
    if ($mem -lt 3000) {
        Write-Host "[ADAPTIVE] Memoria BAJA (<3GB). Restringiendo concurrencia a 1 hilo y deshabilitando LTO."
        $cargoFlags = "--release -j 1 --config 'profile.release.lto=`"off`"'"
    } elseif ($mem -lt 6000) {
        Write-Host "[ADAPTIVE] Memoria MEDIA. Restringiendo concurrencia a 2 hilos."
        $cargoFlags = "--release -j 2 --config 'profile.release.lto=`"off`"'"
    } else {
        Write-Host "[ADAPTIVE] Memoria ALTA. Usando todos los hilos y optimización LTO."
        $cargoFlags = "--release -j $cpu"
    }

    # Comando de despliegue remoto
    $deployCmd = @"
        echo '[DO] Actualizando dependencias de sistema...'
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y > /dev/null 2>&1
        source `$HOME/.cargo/env
        
        # Instalar Node.js si no existe
        if ! command -v npm &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs
        fi
        
        apt-get install -y build-essential libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

        echo '[DO] Clonando / Actualizando Antigravity Manager...'
        if [ ! -d "Antigravity-Manager" ]; then
            git clone https://github.com/PabloArboledai/draculabo-antigravity-manager-private-backup.git Antigravity-Manager
        else
            cd Antigravity-Manager
            git reset --hard HEAD
            git pull
            cd ..
        fi

        cd Antigravity-Manager
        
        echo '[DO] Compilando con perfil adaptativo ($cargoFlags)...'
        cd src-tauri
        nohup bash -c "source `$HOME/.cargo/env && cargo build $cargoFlags > build-adaptive.log 2>&1" &
        echo '[DO] Compilación enviada a segundo plano para no bloquear SSH. (Log: src-tauri/build-adaptive.log)'
"@

    Write-Host "[DEPLOY] Ejecutando comandos de inicialización en $ip..."
    ssh -o ConnectTimeout=20 $SshUser@$ip $deployCmd
    
    Write-Host "[DEPLOY] Nodo $ip orquestado correctamente."
}

Write-Host "`n[FLEET] Todos los despliegues adaptativos han sido despachados."
