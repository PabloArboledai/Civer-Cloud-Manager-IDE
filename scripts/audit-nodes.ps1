# scripts/audit-nodes.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Antigravity Omni-Mesh Audit Tool     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$localHash = (git rev-parse HEAD).Trim()
Write-Host "Local Node (Windows): $localHash" -ForegroundColor Green

# Array of remote nodes
$nodes = @(
    @{ Name = "HP One"; User = "miguel"; Host = "100.104.166.73"; Dir = "Antigravity-Manager" }
)

foreach ($node in $nodes) {
    Write-Host "`nAuditing Node: $($node.Name) ($($node.Host))..." -ForegroundColor Yellow
    try {
        $sshResult = ssh -o ConnectTimeout=5 "$($node.User)@$($node.Host)" "cd $($node.Dir) && git rev-parse HEAD" 2>$null
        
        if ($sshResult) {
            $remoteHash = $sshResult.Trim()
            if ($remoteHash -eq $localHash) {
                Write-Host "[$($node.Name)] SYNCED! Hash: $remoteHash" -ForegroundColor Green
            } else {
                Write-Host "[$($node.Name)] OUT OF SYNC!" -ForegroundColor Red
                Write-Host "Local : $localHash" -ForegroundColor Red
                Write-Host "Remote: $remoteHash" -ForegroundColor Red
            }
        } else {
            Write-Host "[$($node.Name)] OFFLINE or UNREACHABLE." -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "[$($node.Name)] ERROR Connect." -ForegroundColor Red
    }
}

Write-Host "`nAudit Complete." -ForegroundColor Cyan
