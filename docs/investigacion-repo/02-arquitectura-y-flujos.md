# Arquitectura y Flujos

## Procesos principales

Electron tiene tres procesos:
- Main: orquesta ventanas, IPC, BD, proxy, tray y autenticacion local. Referencia: `src/main.ts`.
- Preload: puente seguro para exponer API a renderer. Referencia: `src/preload.ts`.
- Renderer: UI React. Referencia: `src/renderer.ts`.

Adicionalmente, el main inicia un servidor NestJS (proxy) en un puerto configurable. Referencia: `src/server/server.ts`.

## Flujo de inicio

1. Inicializa Sentry si esta habilitado y obtiene "single instance lock". Referencias: `src/main.ts`, `src/instrument.ts`.
2. Inicializa BD local (WAL) y carga configuracion. Referencias: `src/ipc/database/handler.ts`, `src/services/ConfigManager.ts`.
3. Arranca IPC/ORPC. Referencia: `src/ipc/handler.ts`.
4. Crea ventana, inicia OAuth local en `localhost:8888` y, si aplica, el servidor proxy. Referencias: `src/main.ts`, `src/ipc/cloud/authServer.ts`, `src/server/server.ts`.
5. Inicia monitoreo de cuentas y auto-switch si esta activado. Referencias: `src/services/CloudMonitorService.ts`, `src/services/AutoSwitchService.ts`.

## Flujo OAuth (agregar cuenta)

1. Renderer solicita `startAuthFlow`.
2. Main abre URL OAuth de Google.
3. Servidor local recibe `code` en `http://localhost:8888/oauth-callback`.
4. Se intercambia `code` por token y se obtiene perfil.
5. Se almacena cuenta y cuota en DB cifrada.

Referencias:
- Inicio OAuth: `src/ipc/cloud/handler.ts`
- Servidor callback: `src/ipc/cloud/authServer.ts`
- Llamadas a Google: `src/services/GoogleAPIService.ts`
- DB cloud: `src/ipc/database/cloudHandler.ts`

## Flujo de switch de cuenta

1. Se verifica guardia de switch para evitar concurrencia.
2. Se cierra proceso del IDE.
3. Se aplica perfil de identidad si esta habilitado.
4. Se inyecta token (nuevo o legacy) o se restaura snapshot.
5. Se reinicia el IDE y se registran metricas.

Referencias:
- Guard: `src/ipc/switchGuard.ts`
- Flujo: `src/ipc/switchFlow.ts`
- Identidad: `src/ipc/device/handler.ts`
- Token injection: `src/ipc/database/cloudHandler.ts`
- Control de procesos: `src/ipc/process/handler.ts`

## Flujo proxy

1. Cliente externo hace request HTTP a `/v1` o `/v1beta`.
2. Proxy valida API key si esta configurada.
3. TokenManager elige cuenta segun politica y cuota.
4. Proxy llama APIs internas de Gemini/Cloud Code Assist.
5. Se transforma respuesta al formato solicitado.

Referencias:
- Controller: `src/server/proxy/proxy.controller.ts`, `src/server/proxy/gemini.controller.ts`
- Guard: `src/server/proxy/proxy.guard.ts`
- TokenManager: `src/server/proxy/token-manager.service.ts`
- Cliente: `src/server/proxy/gemini.client.ts`
