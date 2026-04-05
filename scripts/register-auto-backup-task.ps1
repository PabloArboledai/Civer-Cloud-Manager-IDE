param(
  [string]$TaskName = 'DraculaboAntigravityManager-AutoBackup'
)

$ErrorActionPreference = 'Stop'

$runnerPath = Join-Path $PSScriptRoot 'run-auto-backup.ps1'

if (-not (Test-Path $runnerPath)) {
  throw "Runner script not found: $runnerPath"
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runnerPath`""
$startAt = (Get-Date).AddMinutes(1)
$baseTrigger = New-ScheduledTaskTrigger -Once -At $startAt
$repeatingTrigger = New-ScheduledTaskTrigger -Once -At $startAt -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$baseTrigger.Repetition = $repeatingTrigger.Repetition
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -StartWhenAvailable
$description = 'Runs the repository auto-backup script every minute and pushes a backup snapshot after 5 minutes of inactivity.'

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $baseTrigger -Settings $settings -Description $description -Force | Out-Null

Write-Output "Scheduled task registered: $TaskName"
