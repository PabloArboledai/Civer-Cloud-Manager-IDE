param(
  [string]$SessionName = '',
  [int]$PollSeconds = 2
)

$ErrorActionPreference = 'Stop'

function Resolve-NodePath {
  $candidates = @(
    'C:\Users\Afrodita\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.14.1-win-x64\node.exe',
    'C:\Users\Afrodita\AppData\Local\ms-playwright-go\1.50.1\node.exe',
    'C:\Program Files\nodejs\node.exe',
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
    "$env:APPDATA\nvm\nodejs\node.exe"
  ) | Where-Object { $_ -and (Test-Path $_) }

  if ($candidates.Count -gt 0) {
    return $candidates[0]
  }

  throw 'No se pudo resolver node.exe para iniciar la sesion observada.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$sessionFolderName = if ([string]::IsNullOrWhiteSpace($SessionName)) { $timestamp } else { "$SessionName-$timestamp" }
$sessionDir = Join-Path $repoRoot ("logs\runtime-observation\" + $sessionFolderName)
$launchDir = Join-Path $sessionDir 'launch'
$metaDir = Join-Path $sessionDir 'meta'

New-Item -ItemType Directory -Force -Path $sessionDir | Out-Null
New-Item -ItemType Directory -Force -Path $launchDir | Out-Null
New-Item -ItemType Directory -Force -Path $metaDir | Out-Null

$nodePath = Resolve-NodePath
$npmCli = Join-Path $repoRoot 'node_modules\npm\bin\npm-cli.js'
$mirrorScript = Join-Path $PSScriptRoot 'mirror-runtime-logs.ps1'

if (-not (Test-Path $npmCli)) {
  throw "No se encontro npm-cli.js en: $npmCli"
}

if (-not (Test-Path $mirrorScript)) {
  throw "No se encontro mirror-runtime-logs.ps1 en: $mirrorScript"
}

$stdoutFile = Join-Path $launchDir 'electron-forge.stdout.log'
$stderrFile = Join-Path $launchDir 'electron-forge.stderr.log'

$nodeDir = Split-Path -Parent $nodePath
$env:Path = "$nodeDir;$env:Path"
$env:ELECTRON_ENABLE_LOGGING = '1'
$env:ELECTRON_ENABLE_STACK_DUMPING = '1'
$env:FORCE_COLOR = '1'

$mirrorProcess = Start-Process -FilePath 'powershell.exe' `
  -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $mirrorScript,
    '-SessionDir', $sessionDir,
    '-PollSeconds', $PollSeconds
  ) `
  -WorkingDirectory $repoRoot `
  -PassThru `
  -WindowStyle Hidden

$launchProcess = Start-Process -FilePath $nodePath `
  -ArgumentList @($npmCli, 'start') `
  -WorkingDirectory $repoRoot `
  -PassThru `
  -RedirectStandardOutput $stdoutFile `
  -RedirectStandardError $stderrFile

Start-Sleep -Seconds 8

$status = if ($launchProcess.HasExited) { 'exited_early' } else { 'running' }

$metadata = [PSCustomObject]@{
  createdAt   = (Get-Date).ToString('o')
  sessionDir  = $sessionDir
  repoRoot    = $repoRoot
  nodePath    = $nodePath
  npmCli      = $npmCli
  mirrorScript = $mirrorScript
  launchPid   = $launchProcess.Id
  mirrorPid   = $mirrorProcess.Id
  status      = $status
  stdoutFile  = $stdoutFile
  stderrFile  = $stderrFile
}

$metadata | ConvertTo-Json -Depth 5 | Out-File -FilePath (Join-Path $metaDir 'session.json') -Encoding utf8

if ($status -eq 'exited_early') {
  Write-Output "SESSION_DIR=$sessionDir"
  Write-Output "LAUNCH_PID=$($launchProcess.Id)"
  Write-Output "MIRROR_PID=$($mirrorProcess.Id)"
  Write-Output 'STATUS=exited_early'
  Write-Output 'STDERR_TAIL_BEGIN'
  if (Test-Path $stderrFile) {
    Get-Content -Path $stderrFile -Tail 80
  }
  Write-Output 'STDERR_TAIL_END'
  exit 1
}

Write-Output "SESSION_DIR=$sessionDir"
Write-Output "LAUNCH_PID=$($launchProcess.Id)"
Write-Output "MIRROR_PID=$($mirrorProcess.Id)"
Write-Output "STDOUT_FILE=$stdoutFile"
Write-Output "STDERR_FILE=$stderrFile"
Write-Output 'STATUS=running'
