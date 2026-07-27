Set objShell = WScript.CreateObject("WScript.Shell")
' Run pythonw (windowless python) to start the system tray script silently
objShell.Run "pythonw.exe ""C:\ProyectoCiverCloudUnificado\Desktop-y-Extensiones\Civer-Cloud-Manager-IDE\Ejecutables\Omni-Hotkeys.py""", 0, False
