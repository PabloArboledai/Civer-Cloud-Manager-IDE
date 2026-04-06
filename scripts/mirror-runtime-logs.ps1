param(
  [Parameter(Mandatory = $true)]
  [string]$SessionDir,
  [int]$PollSeconds = 2
)

$ErrorActionPreference = 'Continue'

function Write-MirrorLog {
  param([string]$Message)

  $logFile = Join-Path $SessionDir 'meta\mirror-runtime.log'
  $line = "[{0}] {1}" -f (Get-Date -Format o), $Message
  $line | Out-File -FilePath $logFile -Append -Encoding utf8
}

function Get-InterestingFiles {
  param([string]$SourcePath)

  Get-ChildItem -Path $SourcePath -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -eq 'orpc_packets.log' -or
    $_.Name -eq '.app-log-audit.json' -or
    $_.Name -eq 'gui_config.json' -or
    $_.Extension -in @('.log', '.txt')
  }
}

function Get-SourceList {
  $sources = @()

  $agentDir = Join-Path $HOME '.antigravity-agent'
  if (Test-Path $agentDir) {
    $sources += [PSCustomObject]@{
      Label = 'agent'
      Path  = $agentDir
    }
  }

  if ($env:APPDATA) {
    $antigravityDir = Join-Path $env:APPDATA 'Antigravity'
    if (Test-Path $antigravityDir) {
      $sources += [PSCustomObject]@{
        Label = 'appdata-antigravity'
        Path  = $antigravityDir
      }
    }

    $userDataCandidates = @(
      (Join-Path $env:APPDATA 'antigravity-manager'),
      (Join-Path $env:APPDATA 'Antigravity Manager'),
      (Join-Path $env:APPDATA 'AntigravityManager')
    )

    $discovered = Get-ChildItem -Path $env:APPDATA -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match 'antigravity.*manager|manager.*antigravity' } |
      Select-Object -ExpandProperty FullName

    foreach ($candidate in ($userDataCandidates + $discovered | Select-Object -Unique)) {
      if (-not $candidate) {
        continue
      }
      if (-not (Test-Path $candidate)) {
        continue
      }

      $safeLabel = ('userdata-' + (Split-Path $candidate -Leaf).ToLower().Replace(' ', '-'))
      $sources += [PSCustomObject]@{
        Label = $safeLabel
        Path  = $candidate
      }
    }
  }

  return $sources | Sort-Object Label -Unique
}

New-Item -ItemType Directory -Force -Path $SessionDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $SessionDir 'meta') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $SessionDir 'mirrored') | Out-Null

$copiedState = @{}
$knownSources = @{}

Write-MirrorLog "Inicio de mirror runtime. SessionDir=$SessionDir PollSeconds=$PollSeconds"

while ($true) {
  try {
    $sources = Get-SourceList

    foreach ($source in $sources) {
      if (-not $knownSources.ContainsKey($source.Label) -or $knownSources[$source.Label] -ne $source.Path) {
        $knownSources[$source.Label] = $source.Path
        Write-MirrorLog "Fuente detectada: $($source.Label) => $($source.Path)"
      }

      $targetRoot = Join-Path $SessionDir ("mirrored\\" + $source.Label)
      New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null

      foreach ($file in Get-InterestingFiles -SourcePath $source.Path) {
        $relativePath = $file.FullName.Substring($source.Path.Length).TrimStart('\\')
        $destination = Join-Path $targetRoot $relativePath
        $destinationDir = Split-Path -Parent $destination

        if (-not (Test-Path $destinationDir)) {
          New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
        }

        $signature = '{0}|{1}' -f $file.Length, $file.LastWriteTimeUtc.Ticks

        if ($copiedState.ContainsKey($destination) -and $copiedState[$destination] -eq $signature) {
          continue
        }

        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force -ErrorAction SilentlyContinue
        $copiedState[$destination] = $signature
        Write-MirrorLog "Copiado: $($file.FullName) => $destination"
      }
    }
  } catch {
    Write-MirrorLog "Error en mirror runtime: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds $PollSeconds
}
