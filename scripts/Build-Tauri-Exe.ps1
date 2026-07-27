<#
.SYNOPSIS
Builds the Tauri .exe installer and handles lock/zombie process issues.

.DESCRIPTION
This script safely builds the Antigravity Ecosystem Tauri application by first killing any zombie Cargo/Rustc processes that might be locking the target directory. It cleans the target if requested, then runs `npm run tauri build`.
#>

param (
    [switch]$Clean = $false
)

$ErrorActionPreference = "Stop"
$ProjectPath = "C:\ProyectoCiverCloudUnificado\Otros\Antigravity-Ecosystem"
$TargetDir = Join-Path $ProjectPath "src-tauri\target"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Antigravity Ecosystem - Tauri Build Tool" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Kill zombie processes holding file locks
Write-Host "[1/4] Checking for locked processes (cargo, rustc, link)..." -ForegroundColor Yellow
$processesToKill = @("cargo", "rustc", "link")
foreach ($procName in $processesToKill) {
    $runningProcs = Get-Process -Name $procName -ErrorAction SilentlyContinue
    if ($runningProcs) {
        Write-Host "      Found running $procName processes. Terminating..." -ForegroundColor DarkYellow
        Stop-Process -Name $procName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

# 2. Optional: Clean target dir
if ($Clean) {
    Write-Host "[2/4] Cleaning Cargo target directory (Warning: This will make the next build slow)..." -ForegroundColor Yellow
    Set-Location -Path (Join-Path $ProjectPath "src-tauri")
    cargo clean
} else {
    Write-Host "[2/4] Skipping Cargo clean (Incremental build)." -ForegroundColor Green
}

# 3. Build the application
Write-Host "[3/4] Building Tauri application (npm run tauri build)..." -ForegroundColor Yellow
Set-Location -Path $ProjectPath
try {
    npm run tauri build
    Write-Host "Build completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "Build failed! Check the errors above." -ForegroundColor Red
    exit 1
}

# 4. Open the output directory
$OutputDir = Join-Path $TargetDir "release\bundle\nsis"
if (Test-Path $OutputDir) {
    Write-Host "[4/4] Opening installer location..." -ForegroundColor Yellow
    Invoke-Item $OutputDir
} else {
    Write-Host "Could not find installer folder at $OutputDir" -ForegroundColor Red
}

Write-Host "Done." -ForegroundColor Cyan
