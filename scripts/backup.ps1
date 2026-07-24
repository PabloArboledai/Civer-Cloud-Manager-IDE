# Backup script for Antigravity-Manager
$source = "C:\Users\Administrator\Desktop\Antigravity-Manager"
$zipName = "Antigravity-Manager-Backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
$destination = "C:\Users\Administrator\Desktop\$zipName"
Write-Host "Creating MASSIVE full backup of $source to $destination"

# Exclude only .git, but KEEP node_modules and target for full backup.
$exclude = @("*.git*")
Get-ChildItem -Path $source -Recurse -Exclude $exclude | Compress-Archive -DestinationPath $destination -Force
Write-Host "Zip creation complete! Uploading to Google Drive (gdrive:/Antigravity-Backups/)..."

# Upload to Google Drive
rclone copy $destination "gdrive:/Antigravity-Backups/" -v

Write-Host "Uploading to HP One (100.104.166.73)..."
# Upload to HP One (assuming SSH is configured or passwordless, but if not it will prompt. Using ssh/scp config)
# Actually, since it's a VPS, SCP will just run.
scp $destination miguel@100.104.166.73:/home/miguel/backups/

Write-Host "Backup process fully completed! Deleting local ZIP to save space."
Remove-Item -Path $destination -Force