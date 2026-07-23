# Arquitectura y procesos

Resumen

La arquitectura se divide en cuatro piezas: Electron (main/preload/renderer), un servidor NestJS embebido (proxy), almacenamiento local (SQLite + archivos de configuracion), y un CLI Python adicional. El proceso main de Electron arranca el servidor NestJS y coordina la autenticacion, el manejo de cuentas y el switching de perfiles.

Componentes principales

Electron main

- Orquesta la app, inicia la bandeja, configura auto arranque, inicia Sentry si esta habilitado, y levanta el servidor NestJS embebido.
- Inicializa ORPC (IPC tipado) y registra handlers para cuentas, base de datos, proxy, sistema, etc.
- Referencia: `src/main.ts`

Electron preload

- Expone APIs limitadas al renderer: listener para el codigo OAuth y cambio de idioma.
- Lee config para decidir si habilitar Sentry en el renderer.
- Referencia: `src/preload.ts`

Renderer (React)

- UI con TanStack Router/Query, React, Tailwind.
- Consume IPC/ORPC para acciones de cuentas, proxy y configuracion.
- Referencia: `src/renderer.ts`, `src/routes/*`, `src/components/*`

Servidor NestJS embebido

- Se inicia como proceso hijo desde Electron.
- Implementa endpoints compatibles con OpenAI y Anthropic y los reenvia a Gemini/Antigravity con mapeo de modelos.
- Referencias: `src/server/main.ts`, `src/server/app.module.ts`, `src/server/modules/proxy/*`

CLI Python

- Tooling adicional que lee la base local, aplica cifrado compatible y puede inyectar tokens en el IDE.
- Referencias: `cli/main.py`, `cli/core.py`, `cli/proto_utils.py`

Flujos de inicio

1. Electron main inicia logs, config local, ORPC y base de datos.
2. Se arranca el servidor NestJS interno para proxy.
3. El renderer se monta y consume IPC/ORPC.
4. Servicios en background monitorizan cuotas y tokens.

IPC/ORPC

- ORPC abre un canal MessageChannel entre main y renderer.
- Se registran routers por dominio: `app`, `window`, `theme`, `database`, `account`, `cloud`, `config`, `gateway`, `system`, `proc`.
- Referencias: `src/ipc/manager.ts`, `src/ipc/handler.ts`, `src/ipc/router.ts`

Persistencia local y paths

- Directorio principal del agente: `src/utils/paths.ts`
- Bases SQLite y archivos JSON se guardan bajo un directorio de appData y un directorio del agente.
- Ejemplos: `cloud_accounts.db`, `antigravity_accounts.json`, `device_original.json`, `gui_config.json`
- Referencia: `src/utils/paths.ts`, `src/ipc/config/manager.ts`

Flujo de datos de alto nivel

1. El renderer solicita acciones via ORPC (por ejemplo, add account o switch).
2. El main coordina servicios (Google API, DB, device profiles) y escribe datos cifrados.
3. El IDE de Antigravity recibe tokens inyectados en `state.vscdb`.
4. El servidor NestJS usa la DB de cuentas para resolver tokens y proxyear requests.

Referencias: `src/ipc/cloud/handler.ts`, `src/ipc/database/cloudHandler.ts`, `src/server/modules/proxy/token-manager.service.ts`, `src/ipc/database/handler.ts`

Observabilidad

- Logs con Winston + rotacion diaria.
- Sentry opcional para main y renderer, condicionado por config local.
- Referencias: `src/utils/logger.ts`, `src/instrument.ts`, `src/renderer.ts`

Configuracion y feature flags

- Config GUI en JSON con opciones de proxy, lenguaje, autostart y error reporting.
- Flags de entorno para habilitar o deshabilitar cambios de identidad en device profiles.
- Referencias: `src/ipc/config/manager.ts`, `src/types/config.ts`, `src/ipc/device/handler.ts`

