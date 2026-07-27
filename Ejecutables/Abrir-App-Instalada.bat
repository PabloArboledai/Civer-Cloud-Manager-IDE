@echo off
title Civer Cloud - Abrir App
echo =========================================
echo  Buscando aplicacion instalada...
echo =========================================
cd /d "C:\ProyectoCiverCloudUnificado\Desktop-y-Extensiones\Civer-Cloud-Manager-IDE\src-tauri\target\release"

for %%F in (*.exe) do (
    if /i not "%%F"=="build.exe" (
        echo Ejecutable encontrado: %%F
        start "" "%%F"
        exit
    )
)

echo No se encontro ningun ejecutable (.exe) compilado. 
echo Por favor ejecuta el Build Mode primero.
pause
