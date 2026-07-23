#!/bin/bash
set -e

echo "============================================="
echo " Antigravity Native Builder (Linux Headless) "
echo "============================================="

# 1. Instalar dependencias del sistema operativo
echo "Instalando dependencias base de compilación..."
sudo apt-get update
sudo apt-get install -y build-essential curl wget file libssl-dev pkg-config

# 2. Instalar Rust si no está
if ! command -v cargo &> /dev/null; then
    echo "Instalando Rust (cargo)..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "Rust ya está instalado: $(cargo --version)"
fi

# 3. Compilar el backend
cd "$(dirname "$0")/.." # Ir a la raíz del proyecto
echo "Compilando backend de Antigravity (Headless)..."
cd src-tauri
cargo build --release --bin antigravity_tools

echo "============================================="
echo "✅ Compilación exitosa."
echo "Binario disponible en: src-tauri/target/release/antigravity_tools"
echo "Para iniciarlo en modo servidor, ejecuta:"
echo "  ./src-tauri/target/release/antigravity_tools --headless"
echo "============================================="
