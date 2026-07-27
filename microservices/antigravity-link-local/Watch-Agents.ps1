$telemetryDir = "$env:USERPROFILE\.gemini\antigravity\telemetry"
$lastModified = @{}

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  ANTIGRAVITY MOS - TELEMETRY MONITOR        " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Monitoring $telemetryDir for live agent thoughts..." -ForegroundColor DarkGray

while ($true) {
    if (Test-Path $telemetryDir) {
        $files = Get-ChildItem -Path $telemetryDir -Filter "*.json"
        foreach ($file in $files) {
            $workspace = $file.BaseName
            $currentModified = $file.LastWriteTime
            
            if (-not $lastModified.ContainsKey($workspace) -or $lastModified[$workspace] -ne $currentModified) {
                $lastModified[$workspace] = $currentModified
                
                try {
                    $content = Get-Content $file.FullName -Raw | ConvertFrom-Json
                    $isGenerating = $content.isGenerating
                    $message = $content.lastMessage
                    
                    Write-Host ""
                    Write-Host "[$workspace] $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Yellow -NoNewline
                    if ($isGenerating) {
                        Write-Host " [EN EJECUCION] " -ForegroundColor Red -NoNewline
                    } else {
                        Write-Host " [ESPERANDO] " -ForegroundColor Green -NoNewline
                    }
                    Write-Host ""
                    
                    if ($message) {
                        $lines = $message -split "`n"
                        # Limit to last 5 lines to avoid terminal spam
                        if ($lines.Count -gt 5) {
                            $lines = $lines[($lines.Count - 5)..($lines.Count - 1)]
                        }
                        foreach ($line in $lines) {
                            if ($line.Trim() -ne "") {
                                Write-Host "  > $line" -ForegroundColor Gray
                            }
                        }
                    }
                } catch {
                    # Ignore parsing errors from race conditions
                }
            }
        }
    }
    Start-Sleep -Milliseconds 500
}
