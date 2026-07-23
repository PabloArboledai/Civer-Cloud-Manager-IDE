# Flujo de ejecucion

Resumen:
- el arranque lo lidera `src/main.ts`
- primero inicializa persistencia y config
- despues monta ORPC y la ventana Electron
- luego levanta servicios laterales: OAuth local, proxy NestJS, monitor cloud y tray

Secuencia de arranque:

```plaintext
app.whenReady()
  -> CloudAccountRepo.init()
  -> initDatabase()
  -> ConfigManager.loadConfig()
  -> syncAutoStart()
  -> setupORPC()
  -> createWindow()
  -> checkForUpdates()
  -> AuthServer.start()
  -> bootstrapNestServer() si proxy.auto_start
  -> CloudMonitorService.start() si auto_switch_enabled
  -> initTray()
```

Que hace cada paso:
- `CloudAccountRepo.init()`:
  asegura `cloud_accounts.db` y migra datos legacy no cifrados.
- `initDatabase()`:
  toca la DB del IDE para validar apertura y modo WAL.
- `ConfigManager.loadConfig()`:
  lee `gui_config.json`, mezcla defaults y cachea el resultado.
- `setupORPC()`:
  espera el `MessagePort` desde preload/renderer y lo entrega a `rpcHandler`.
- `createWindow()`:
  crea `BrowserWindow`, registra eventos de consola, focus, close y errores del renderer.
- `checkForUpdates()`:
  configura `update-electron-app` contra el repo GitHub.
- `AuthServer.start()`:
  abre el listener HTTP local en `localhost:8888`.
- `bootstrapNestServer()`:
  arranca el proxy HTTP local si la config lo pide.
- `CloudMonitorService.start()`:
  lanza polling periodico de cuotas y tokens.
- `initTray()`:
  crea icono y menu contextual.

Arranque del renderer:
- `src/renderer.ts` carga Sentry del renderer si aplica.
- se monta React.
- `src/App.tsx` conecta router, query client, theme provider y toaster.

Handshake ORPC:
- `src/ipc/manager.ts` crea `MessageChannel`.
- envia `START_ORPC_SERVER` por `window.postMessage`.
- `src/preload.ts` intercepta el mensaje y lo reenvia a main.
- `src/main.ts` recibe el puerto y hace `rpcHandler.upgrade(port)`.

Flujo de cierre:
- al cerrar ventana, la app normalmente no termina; se esconde al tray.
- en `before-quit` se marca `isQuitting = true`.
- en `will-quit` se destruye el tray.
- en `window-all-closed` se intenta parar NestJS y fuera de macOS se cierra la app.

Flujos de alto nivel adicionales:
- foco de ventana:
  `mainWindow.on('focus')` llama `CloudMonitorService.handleAppFocus()`.
- segunda instancia:
  se adquiere `requestSingleInstanceLock()` y la segunda instancia enfoca la ventana existente.
- auto start:
  si el sistema arranca la app y `auto_startup` esta activo, la ventana puede iniciar oculta.

Detalles de postura Electron:
- `contextIsolation: true`
- `nodeIntegration: true`
- la app empaquetada habilita fuses como `OnlyLoadAppFromAsar`

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\main.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\preload.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\renderer.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\App.tsx`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\manager.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\main.ts`
