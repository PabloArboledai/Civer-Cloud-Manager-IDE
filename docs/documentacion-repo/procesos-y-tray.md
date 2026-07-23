# Procesos y tray

Resumen:
- el manager detecta, cierra y arranca el IDE Antigravity en Windows, macOS, Linux y WSL
- el tray ofrece acceso rapido a cuenta activa, cuotas resumidas y acciones directas
- la ventana principal normalmente se oculta al tray en vez de cerrar la app

Control de procesos del IDE:
- `isProcessRunning()`:
  usa `find-process`, filtra helpers Electron y evita confundirse con el propio manager.
- `closeAntigravity()`:
  intenta cierre amable por plataforma y luego mata procesos restantes.
- `startAntigravity()`:
  intenta primero URI `antigravity://oauth-success` y luego el ejecutable detectado.

Deteccion de ejecutable:
- `getAntigravityExecutablePath()` revisa rutas comunes por plataforma.
- soporta WSL con conversion de rutas Windows.

Comportamiento de ventana:
- `requestSingleInstanceLock()`
- si una segunda instancia se abre, enfoca la ventana existente
- al cerrar la ventana:
  si la app no esta saliendo, se oculta y sigue viva en tray
- al enfocar:
  dispara `CloudMonitorService.handleAppFocus()`

Tray:
- icono desde `src/assets/tray.png`
- tooltip `Antigravity Manager`
- acciones:
  mostrar cuenta actual
  mostrar resumen de quota
  `switch_next`
  `refresh_current`
  `show_window`
  `quit`

Detalle importante del tray:
- `refresh_current` si hace trabajo real:
  refresca quota con `GoogleAPIService.fetchQuota()`.
- `switch_next` no hace un switch cloud completo:
  solo ejecuta `CloudAccountRepo.setActive(next.id)` y notifica al renderer.
- consecuencia:
  la cuenta marcada como activa puede cambiar en la UI/tray sin que el IDE haya recibido nueva inyeccion de token ni reinicio.

Auto start:
- `syncAutoStart()` usa APIs nativas de Electron en Windows/macOS.
- en Linux crea `.desktop` de autostart.

Instalacion y notice:
- `main.ts` muestra un mensaje en Windows si la app no parece correr desde el directorio de instalacion esperado.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\process\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\tray\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\window\handlers.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\paths.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\autoStart.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\main.ts`
