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
    "$env:APPDATA\nvm\nodejs\node.exe"
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

  throw 'Node.exe could not be resolved. Set AUTO_BACKUP_NODE_BIN to a valid path.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $PSScriptRoot 'auto-backup.mjs'
$logsDirectory = Join-Path $repoRoot 'logs'

if (-not (Test-Path $logsDirectory)) {
  New-Item -ItemType Directory -Path $logsDirectory | Out-Null
}

$logFile = Join-Path $logsDirectory 'auto-backup.log'
$nodePath = Resolve-NodePath

Push-Location $repoRoot
try {
  "[{0}] Starting scheduled auto-backup run." -f (Get-Date -Format o) | Out-File -FilePath $logFile -Append -Encoding utf8
  & $nodePath $scriptPath *>> $logFile

  if ($LASTEXITCODE -ne 0) {
    throw "auto-backup.mjs exited with code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}
