# Backup script for Antigravity-Manager
$source = "C:\Users\Administrator\Desktop\Antigravity-Manager"
$destination = "C:\Users\Administrator\Desktop\Antigravity-Manager-Backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
Write-Host "Creating backup of $source to $destination"
# Exclude node_modules, target, and .git
$exclude = @("*node_modules*", "*target*", "*.git*")
Get-ChildItem -Path $source -Recurse -Exclude $exclude | Compress-Archive -DestinationPath $destination -Force
Write-Host "Backup complete!"