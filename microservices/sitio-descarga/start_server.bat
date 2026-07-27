@echo off
:: Script de inicio del servidor de descarga Antigravity en puerto 3000
:: Registrado en Task Scheduler para auto-inicio en sistema

:restart
echo [%date% %time%] Iniciando servidor antigravity.civer.cloud puerto 3000...
"C:\Program Files\nodejs\node.exe" "C:\Users\Administrator\Desktop\Proyectos AWS Jacinto\mesh-shared-vault\sitio-descarga\server.js" >> "C:\Users\Administrator\Desktop\Proyectos AWS Jacinto\mesh-shared-vault\scratch\server-3000.log" 2>&1
echo [%date% %time%] Servidor detenido. Reiniciando en 3 segundos...
timeout /t 3 /nobreak > NUL
goto restart
