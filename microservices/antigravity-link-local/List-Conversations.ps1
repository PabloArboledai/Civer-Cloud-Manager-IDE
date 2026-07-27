$brainDir = "$env:USERPROFILE\.gemini\antigravity\brain"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  ANTIGRAVITY MOS - CONVERSATION INVENTORY   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

if (-not (Test-Path $brainDir)) {
    Write-Host "Brain directory not found!" -ForegroundColor Red
    exit
}

$conversations = @()
$dirs = Get-ChildItem -Path $brainDir -Directory

foreach ($dir in $dirs) {
    $metaPath = Join-Path $dir.FullName "metadata.json"
    if (Test-Path $metaPath) {
        try {
            $content = Get-Content $metaPath -Raw | ConvertFrom-Json
            $title = $content.title
            if (-not $title) { $title = "Sin Título" }
            
            $conversations += [PSCustomObject]@{
                ID = $dir.Name
                Title = $title
                Modified = $dir.LastWriteTime
            }
        } catch {}
    }
}

$conversations = $conversations | Sort-Object Modified -Descending

foreach ($conv in $conversations) {
    Write-Host "- ID: " -NoNewline
    Write-Host "$($conv.ID) " -ForegroundColor Yellow -NoNewline
    Write-Host "| Título: " -NoNewline
    Write-Host "$($conv.Title)" -ForegroundColor Green
    Write-Host "  Modificado: $($conv.Modified.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor DarkGray
    Write-Host ""
}

Write-Host "Total de conversaciones: $($conversations.Count)" -ForegroundColor Cyan
