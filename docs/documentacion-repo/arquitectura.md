# Arquitectura

Resumen:
- la app es un escritorio Electron con React en el renderer
- el proceso `main` concentra la logica real de cuentas, switching, auth local, config y arranque del proxy
- el proxy es un servidor NestJS embebido que expone compatibilidad OpenAI, Anthropic y Gemini
- existe una CLI Python que reutiliza la persistencia local y parte del modelo operativo

Capas principales:

```plaintext
UI
  React 19 + TanStack Router + React Query + i18n

Bridge
  preload.ts
  window.electron
  MessageChannel / ORPC

Core desktop
  Electron main
  SQLite local
  archivos JSON auxiliares
  control del IDE Antigravity

Gateway
  NestJS + Fastify
  TokenManagerService
  ProxyService
  GeminiClient

Integraciones
  Google OAuth
  Google userinfo
  cloudcode-pa.googleapis.com
  generativelanguage.googleapis.com
```

Procesos reales:
- `src/main.ts` arranca Electron, crea la ventana, inicia ORPC, levanta `AuthServer`, puede arrancar el proxy NestJS, inicia el tray y el monitor cloud.
- `src/preload.ts` expone el bridge al renderer y transfiere el `MessagePort` para ORPC.
- `src/renderer.ts` y `src/App.tsx` montan la UI.
- `src/server/main.ts` arranca un NestJS interno en el puerto configurado.
- `cli/main.py` y `cli/core.py` ofrecen una superficie paralela por consola.

Limites de responsabilidad:
- Renderer:
  UI, estado de vista, formularios, ejemplos de uso, consumo de ORPC.
- Main:
  persistencia, auth, switching, control del IDE, tray, logs, monitor, arranque de proxy.
- NestJS:
  compatibilidad de protocolos, seleccion de cuenta, enrutamiento de modelos, streaming.
- CLI:
  operaciones offline o por terminal sobre cuentas, cuotas y switching.

Zonas de confianza:
- `cloud_accounts.db` y `gui_config.json` son el estado local principal del producto.
- `state.vscdb` y `storage.json` no son datos del manager en si; pertenecen al IDE Antigravity y el manager los manipula.
- el proxy local confia en la API key configurada o queda abierto si no existe una.

Flujos estructurales mas importantes:
- auth cloud:
  browser externo -> `AuthServer` local -> `GoogleAPIService` -> `CloudAccountRepo`
- switch cloud:
  UI/CLI -> `switchCloudAccount` -> `executeSwitchFlow` -> `injectCloudToken` -> reinicio del IDE
- request proxy:
  cliente externo -> controller Nest -> `ProxyService` -> `TokenManagerService` -> `GeminiClient`
- sync desde IDE:
  `state.vscdb` -> protobuf decode -> `GoogleAPIService.getUserInfo` -> upsert en DB local

Modelos de cuenta que conviven:
- cuentas cloud:
  viven en `cloud_accounts.db`, con tokens Google y cuotas cifradas.
- snapshots locales:
  viven en `antigravity_accounts.json` y backups JSON del IDE; sirven para restaurar estados locales mas antiguos.

Puntos donde la app toca el sistema host:
- auto start del sistema operativo
- tray icon
- abrir navegador externo para OAuth
- abrir carpetas de logs e identidad
- detectar, cerrar y reabrir el IDE Antigravity
- leer y escribir DB SQLite del IDE y `storage.json`

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\main.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\preload.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\renderer.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\App.tsx`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\router.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\main.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\cli\main.py`
