param(
  [string]$TaskName = 'DraculaboAntigravityManager-AutoBackup'
)

$ErrorActionPreference = 'Stop'

$runnerPath = Join-Path $PSScriptRoot 'run-auto-backup-daemon.ps1'

if (-not (Test-Path $runnerPath)) {
  throw "No se encontró el script runner: $runnerPath"
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runnerPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Days 3650)
$description = 'Ejecuta un watcher continuo de auto-backup y hace push al repo privado cuando detecta cambios estables.'

try {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null
} catch {
}

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description $description -Force | Out-Null

Write-Output "Tarea programada registrada: $TaskName"
