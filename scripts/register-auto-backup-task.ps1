param(
  [string]$TaskName = 'DraculaboAntigravityManager-AutoBackup'
)

$ErrorActionPreference = 'Stop'

$runnerPath = Join-Path $PSScriptRoot 'run-auto-backup.ps1'

if (-not (Test-Path $runnerPath)) {
  throw "No se encontró el script runner: $runnerPath"
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runnerPath`""
$startAt = (Get-Date).AddMinutes(1)
$baseTrigger = New-ScheduledTaskTrigger -Once -At $startAt
$repeatingTrigger = New-ScheduledTaskTrigger -Once -At $startAt -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$baseTrigger.Repetition = $repeatingTrigger.Repetition
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -StartWhenAvailable
$description = 'Ejecuta el script de auto-backup del repositorio cada minuto y hace push de un snapshot de respaldo tras 5 minutos de inactividad.'

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $baseTrigger -Settings $settings -Description $description -Force | Out-Null

Write-Output "Tarea programada registrada: $TaskName"
