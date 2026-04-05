# Procesos y tray

Resumen: el main controla el proceso del IDE externo, gestiona la ventana Electron y expone acciones via tray y ORPC.

Control del IDE:
- Inicio y cierre del IDE usando path detectado por plataforma.
- Esperas y reintentos para cierre limpio antes de switching.
- Lectura de version del IDE para seleccionar formato de token.

Ventana Electron:
- Acciones `minimize`, `maximize`, `close` via IPC.
- Manejo de focus y eventos para el monitor de cuentas.

Tray:
- Menu con cuenta activa, cuotas resumidas y acciones rapidas.
- Acceso directo a refresh y switching.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\proc\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\window\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\tray\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\antigravityVersion.ts`
