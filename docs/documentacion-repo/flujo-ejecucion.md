# Flujo de ejecucion

Resumen: el arranque inicia en `main.ts`, carga configuracion, prepara IPC ORPC, levanta OAuth local, opcionalmente inicia el proxy NestJS y el monitor de cuentas. El renderer inicia React y el router. El preload expone APIs seguras al renderer.

Inicio del proceso principal:
- Inicializa repositorios locales (CloudAccountRepo y DB del IDE).
- Carga configuracion local (`gui_config.json`).
- Registra handler ORPC sobre MessagePort.
- Crea la ventana y carga el renderer.
- Arranca el servidor local de OAuth para Google.
- Arranca el proxy NestJS si esta habilitado en la config.
- Arranca el servicio de monitoreo de cuentas si `auto_switch` esta activo.
- Inicializa el tray con acciones rapidas.
- Configura auto-update del paquete Electron.

Renderer:
- Inicializa i18n y theme.
- Registra rutas con TanStack Router.
- Consume el cliente ORPC para operaciones de UI.

Preload:
- Configura el bridge seguro (`window.electron`) con eventos de OAuth y cambios de idioma.
- Prepara el MessagePort para ORPC.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\main.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\renderer.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\preload.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\manager.ts`
