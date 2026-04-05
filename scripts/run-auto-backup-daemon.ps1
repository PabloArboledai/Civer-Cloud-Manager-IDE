$ErrorActionPreference = 'Stop'

function Resolve-NodePath {
  if ($env:AUTO_BACKUP_NODE_BIN -and (Test-Path $env:AUTO_BACKUP_NODE_BIN)) {
    return $env:AUTO_BACKUP_NODE_BIN
  }

  try {
    return (Get-Command node.exe -ErrorAction Stop).Source
  } catch {
  }

  $candidates = @(
    'C:\Program Files\nodejs\node.exe',
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
    "$env:APPDATA\nvm\nodejs\node.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.14.1-win-x64\node.exe"
  )

  if (Test-Path "$env:LOCALAPPDATA\ms-playwright-go") {
    $playwrightNodes = Get-ChildItem "$env:LOCALAPPDATA\ms-playwright-go" -Filter node.exe -Recurse -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending |
      Select-Object -ExpandProperty FullName
    $candidates += $playwrightNodes
  }

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  throw 'No se pudo resolver Node.exe. Define AUTO_BACKUP_NODE_BIN con una ruta válida.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $PSScriptRoot 'auto-backup-daemon.mjs'
$logsDirectory = Join-Path $repoRoot 'logs'

if (-not (Test-Path $logsDirectory)) {
  New-Item -ItemType Directory -Path $logsDirectory | Out-Null
}

$logFile = Join-Path $logsDirectory 'auto-backup-daemon.log'
$nodePath = Resolve-NodePath

Push-Location $repoRoot
try {
  "[{0}] Iniciando watcher continuo de auto-backup." -f (Get-Date -Format o) | Out-File -FilePath $logFile -Append -Encoding utf8
  & $nodePath $scriptPath 2>&1 | Out-File -FilePath $logFile -Append -Encoding utf8

  if ($LASTEXITCODE -ne 0) {
    throw "auto-backup-daemon.mjs terminó con el código $LASTEXITCODE."
  }
} finally {
  Pop-Location
}
