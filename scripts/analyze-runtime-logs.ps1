param(
  [Parameter(Mandatory = $true)]
  [string]$SessionDir,
  [int]$PollSeconds = 5
)

$ErrorActionPreference = 'Continue'

$analysisDir = Join-Path $SessionDir 'analysis'
$metaDir = Join-Path $SessionDir 'meta'
$summaryPath = Join-Path $analysisDir 'live-summary.md'
$eventsPath = Join-Path $analysisDir 'events.ndjson'
$notablePath = Join-Path $analysisDir 'notable-events.log'
$stateSnapshotPath = Join-Path $analysisDir 'file-state.json'
$statsPath = Join-Path $analysisDir 'stats.json'
$logFile = Join-Path $metaDir 'log-analyzer.log'

New-Item -ItemType Directory -Force -Path $analysisDir | Out-Null
New-Item -ItemType Directory -Force -Path $metaDir | Out-Null

$startedAt = Get-Date
$fileState = @{}
$recentNotable = New-Object System.Collections.ArrayList
$recentFileChanges = New-Object System.Collections.ArrayList
$stats = [ordered]@{
  startedAt = $startedAt.ToString('o')
  lastScanAt = $null
  scans = 0
  watchedFileCount = 0
  changedFileCount = 0
  totalNotable = 0
  severity = [ordered]@{
    error = 0
    warn = 0
    info = 0
  }
  category = [ordered]@{
    auth = 0
    orpc = 0
    network = 0
    storage = 0
    ui = 0
    runtime = 0
    unknown = 0
  }
  watchedRoots = @()
}

function Write-AnalyzerLog {
  param([string]$Message)

  $line = '[{0}] {1}' -f (Get-Date -Format o), $Message
  $line | Out-File -FilePath $logFile -Append -Encoding utf8
}

function Get-RelativeSessionPath {
  param([string]$FullPath)

  if ($FullPath.StartsWith($SessionDir, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $FullPath.Substring($SessionDir.Length).TrimStart('\\')
  }

  return $FullPath
}

function Test-IsExcludedTextPath {
  param([string]$FullPath)

  $patterns = @(
    '\\Local Storage\\leveldb\\',
    '\\Session Storage\\',
    '\\Code Cache\\',
    '\\GPUCache\\',
    '\\blob_storage\\',
    '\\DawnGraphiteCache\\',
    '\\DawnWebGPUCache\\',
    '\\Cache\\Cache_Data\\'
  )

  foreach ($pattern in $patterns) {
    if ($FullPath -match $pattern) {
      return $true
    }
  }

  return $false
}

function Get-WatchedRoots {
  $roots = @()

  $launchRoot = Join-Path $SessionDir 'launch'
  if (Test-Path $launchRoot) {
    $roots += $launchRoot
  }

  $agentRoot = Join-Path $SessionDir 'mirrored\\agent'
  if (Test-Path $agentRoot) {
    $roots += $agentRoot
  }

  $mirroredRoot = Join-Path $SessionDir 'mirrored'
  if (Test-Path $mirroredRoot) {
    $roots += Get-ChildItem -LiteralPath $mirroredRoot -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '^userdata-.*antigravity.*manager$' } |
      Select-Object -ExpandProperty FullName
  }

  return @($roots | Select-Object -Unique)
}

function Get-WatchedFiles {
  $roots = Get-WatchedRoots
  $stats.watchedRoots = @($roots | ForEach-Object { Get-RelativeSessionPath -FullPath $_ })
  $files = @()

  foreach ($root in $roots) {
    if (-not (Test-Path $root)) {
      continue
    }

    $files += Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
      $extension = $_.Extension.ToLowerInvariant()
      $isInterestingExtension = $extension -in @('.log', '.txt', '.json')
      $isAuditFile = $_.Name -eq '.app-log-audit.json'
      $isSupported = $isInterestingExtension -or $isAuditFile
      $isSmallEnough = $_.Length -lt 25MB
      $isExcluded = Test-IsExcludedTextPath -FullPath $_.FullName
      $isIgnoredJson = $_.Name -in @('session.json', 'stats.json', 'file-state.json')

      return $isSupported -and $isSmallEnough -and -not $isExcluded -and -not $isIgnoredJson
    }
  }

  return @($files | Sort-Object FullName -Unique)
}

function Normalize-Lines {
  param($RawLines)

  if ($null -eq $RawLines) {
    return @()
  }

  if ($RawLines -is [System.Array]) {
    return @($RawLines)
  }

  return @([string]$RawLines)
}

function Get-Severity {
  param([string]$Line)

  $value = $Line.ToLowerInvariant()

  if ($value -match '\b(error|failed|exception|fatal|crash|destroyed|denied|refused|unhandled|invalid|timeout|gone)\b') {
    return 'error'
  }

  if ($value -match '\b(warn|warning|deprecated|fallback|retry)\b') {
    return 'warn'
  }

  return 'info'
}

function Get-Categories {
  param(
    [string]$Line,
    [string]$RelativePath
  )

  $value = ($RelativePath + ' ' + $Line).ToLowerInvariant()
  $categories = @()

  if ($value -match 'oauth|auth|token|login|credential|keytar|safestorage|master key|verification') {
    $categories += 'auth'
  }

  if ($value -match 'orpc://|\borpc\b|\bipc\b|\brpc\b|packet') {
    $categories += 'orpc'
  }

  if ($value -match 'proxy|gateway|anthropic|openai|gemini|grpc|googleapis|quota|balance|cloud') {
    $categories += 'network'
  }

  if ($value -match 'database|sqlite|\.db\b|storage|migration|encrypt|decrypt') {
    $categories += 'storage'
  }

  if ($value -match 'renderer|browserwindow|window|page|route|focus|vite|tray|ui') {
    $categories += 'ui'
  }

  if ($value -match 'heartbeat|startup|before-quit|will-quit|process|render-process-gone|did-fail-load|stderr|stdout|launch') {
    $categories += 'runtime'
  }

  if ($categories.Count -eq 0) {
    $categories += 'unknown'
  }

  return @($categories | Select-Object -Unique)
}

function Test-IsNotableEvent {
  param(
    [string]$Severity,
    [string[]]$Categories,
    [string]$RelativePath,
    [string]$Line
  )

  if ($Severity -ne 'info') {
    return $true
  }

  if ($RelativePath -like 'launch\\*') {
    return $true
  }

  if ($Categories -contains 'orpc' -or $Categories -contains 'auth') {
    return $true
  }

  if ($Line -match 'Page finished loading|Renderer Console|createWindow:|IPC:|App before-quit') {
    return $true
  }

  return $false
}

function Add-RecentItem {
  param(
    [System.Collections.ArrayList]$List,
    [object]$Item,
    [int]$Limit
  )

  [void]$List.Add($Item)

  while ($List.Count -gt $Limit) {
    $List.RemoveAt(0)
  }
}

function Write-Summary {
  $summaryLines = New-Object System.Collections.Generic.List[string]
  $summaryLines.Add('# Resumen vivo de logs') | Out-Null
  $summaryLines.Add('') | Out-Null
  $summaryLines.Add('- Sesión: `' + $SessionDir + '`') | Out-Null
  $summaryLines.Add('- Iniciado: ' + $stats.startedAt) | Out-Null
  $summaryLines.Add('- Último escaneo: ' + $stats.lastScanAt) | Out-Null
  $summaryLines.Add('- Escaneos: ' + $stats.scans) | Out-Null
  $summaryLines.Add('- Archivos vigilados: ' + $stats.watchedFileCount) | Out-Null
  $summaryLines.Add('- Archivos con cambios detectados: ' + $stats.changedFileCount) | Out-Null
  $summaryLines.Add('- Eventos notables acumulados: ' + $stats.totalNotable) | Out-Null
  $summaryLines.Add('') | Out-Null
  $summaryLines.Add('## Fuentes vigiladas') | Out-Null
  $summaryLines.Add('') | Out-Null

  foreach ($root in $stats.watchedRoots) {
    $summaryLines.Add('- `' + $root + '`') | Out-Null
  }

  if ($stats.watchedRoots.Count -eq 0) {
    $summaryLines.Add('- Sin fuentes detectadas todavía') | Out-Null
  }

  $summaryLines.Add('') | Out-Null
  $summaryLines.Add('## Conteo por severidad') | Out-Null
  $summaryLines.Add('') | Out-Null
  foreach ($key in @('error', 'warn', 'info')) {
    $summaryLines.Add('- ' + $key + ': ' + $stats.severity[$key]) | Out-Null
  }

  $summaryLines.Add('') | Out-Null
  $summaryLines.Add('## Conteo por categoría') | Out-Null
  $summaryLines.Add('') | Out-Null
  foreach ($key in @('auth', 'orpc', 'network', 'storage', 'ui', 'runtime', 'unknown')) {
    $summaryLines.Add('- ' + $key + ': ' + $stats.category[$key]) | Out-Null
  }

  $summaryLines.Add('') | Out-Null
  $summaryLines.Add('## Últimos archivos con actividad') | Out-Null
  $summaryLines.Add('') | Out-Null

  if ($recentFileChanges.Count -eq 0) {
    $summaryLines.Add('- Sin cambios nuevos desde que arrancó el analizador') | Out-Null
  } else {
    foreach ($item in @($recentFileChanges)) {
      $summaryLines.Add('- [' + $item.when + '] `' + $item.path + '` +' + $item.addedLines + ' líneas') | Out-Null
    }
  }

  $summaryLines.Add('') | Out-Null
  $summaryLines.Add('## Últimos eventos notables') | Out-Null
  $summaryLines.Add('') | Out-Null

  if ($recentNotable.Count -eq 0) {
    $summaryLines.Add('- Sin eventos notables nuevos desde que arrancó el analizador') | Out-Null
  } else {
    foreach ($item in @($recentNotable)) {
      $summaryLines.Add('- [' + $item.observedAt + '] [' + $item.severity + '] `' + $item.sessionPath + '` :: ' + $item.line) | Out-Null
    }
  }

  $summaryLines | Set-Content -LiteralPath $summaryPath -Encoding utf8
}

Write-AnalyzerLog ('Inicio del analizador de logs. SessionDir=' + $SessionDir + ' PollSeconds=' + $PollSeconds)
Write-Summary

while ($true) {
  try {
    $stats.scans = [int]$stats.scans + 1
    $stats.lastScanAt = (Get-Date).ToString('o')
    $watchedFiles = @(Get-WatchedFiles)
    $stats.watchedFileCount = $watchedFiles.Count

    foreach ($file in $watchedFiles) {
      $relativePath = Get-RelativeSessionPath -FullPath $file.FullName
      $signature = '{0}|{1}' -f $file.Length, $file.LastWriteTimeUtc.Ticks

      if (-not $fileState.ContainsKey($relativePath)) {
        $baselineLines = Normalize-Lines (Get-Content -LiteralPath $file.FullName -ErrorAction SilentlyContinue)
        $fileState[$relativePath] = [ordered]@{
          signature = $signature
          lineCount = $baselineLines.Count
          lastSeenAt = (Get-Date).ToString('o')
        }
        Write-AnalyzerLog ('Baseline capturado para ' + $relativePath + ' con ' + $baselineLines.Count + ' líneas')
        continue
      }

      if ($fileState[$relativePath].signature -eq $signature) {
        continue
      }

      $allLines = Normalize-Lines (Get-Content -LiteralPath $file.FullName -ErrorAction SilentlyContinue)
      $previousLineCount = [int]$fileState[$relativePath].lineCount
      $currentLineCount = $allLines.Count
      $startIndex = $previousLineCount

      if ($currentLineCount -lt $previousLineCount) {
        $startIndex = 0
      }

      $newLines = @()
      if ($currentLineCount -gt $startIndex) {
        $newLines = @($allLines[$startIndex..($currentLineCount - 1)])
      }

      $fileState[$relativePath] = [ordered]@{
        signature = $signature
        lineCount = $currentLineCount
        lastSeenAt = (Get-Date).ToString('o')
      }

      $stats.changedFileCount = [int]$stats.changedFileCount + 1
      Add-RecentItem -List $recentFileChanges -Item ([ordered]@{
        when = (Get-Date).ToString('o')
        path = $relativePath
        addedLines = $newLines.Count
      }) -Limit 50

      if ($newLines.Count -eq 0) {
        continue
      }

      Write-AnalyzerLog ('Cambio detectado en ' + $relativePath + ' +' + $newLines.Count + ' líneas')

      foreach ($rawLine in $newLines) {
        $line = [string]$rawLine
        if ([string]::IsNullOrWhiteSpace($line)) {
          continue
        }

        $severity = Get-Severity -Line $line
        $categories = Get-Categories -Line $line -RelativePath $relativePath

        $stats.severity[$severity] = [int]$stats.severity[$severity] + 1
        foreach ($category in $categories) {
          if (-not $stats.category.Contains($category)) {
            $stats.category[$category] = 0
          }
          $stats.category[$category] = [int]$stats.category[$category] + 1
        }

        if (-not (Test-IsNotableEvent -Severity $severity -Categories $categories -RelativePath $relativePath -Line $line)) {
          continue
        }

        $event = [ordered]@{
          observedAt = (Get-Date).ToString('o')
          severity = $severity
          categories = $categories
          sessionPath = $relativePath
          line = $line.Trim()
        }

        $stats.totalNotable = [int]$stats.totalNotable + 1
        Add-RecentItem -List $recentNotable -Item $event -Limit 80
        ($event | ConvertTo-Json -Compress -Depth 6) | Out-File -FilePath $eventsPath -Append -Encoding utf8
        ('[{0}] [{1}] {2} :: {3}' -f $event.observedAt, $severity.ToUpperInvariant(), $relativePath, $event.line) | Out-File -FilePath $notablePath -Append -Encoding utf8
      }
    }

    @($fileState.GetEnumerator() | ForEach-Object {
      [ordered]@{
        path = $_.Key
        signature = $_.Value.signature
        lineCount = $_.Value.lineCount
        lastSeenAt = $_.Value.lastSeenAt
      }
    }) | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $stateSnapshotPath -Encoding utf8

    $stats | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $statsPath -Encoding utf8
    Write-Summary
  } catch {
    Write-AnalyzerLog ('Error en analizador de logs: ' + $_.Exception.Message)
  }

  Start-Sleep -Seconds $PollSeconds
}
