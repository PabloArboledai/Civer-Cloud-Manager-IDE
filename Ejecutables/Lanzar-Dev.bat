@echo off
title Civer Cloud - Lanzador Dev
echo =========================================
echo  Iniciando Entorno de Desarrollo...
echo =========================================
cd /d "C:\ProyectoCiverCloudUnificado\Desktop-y-Extensiones\Civer-Cloud-Manager-IDE"
wt.exe -d "C:\ProyectoCiverCloudUnificado\Desktop-y-Extensiones\Civer-Cloud-Manager-IDE" cmd /k "title Civer Cloud DEV & color 0b & npm run tauri dev"
if %errorlevel% neq 0 (
    start "Civer Cloud DEV" cmd /T:0B /k "npm run tauri dev"
)
exit
