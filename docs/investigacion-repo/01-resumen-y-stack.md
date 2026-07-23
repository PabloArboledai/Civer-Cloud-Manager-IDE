# Resumen y Stack

Este repo es una aplicacion Electron con UI React y un servidor NestJS embebido que expone un proxy de modelos. La app administra cuentas "cloud", obtiene tokens por OAuth, calcula cuotas y puede alternar cuentas segun consumo.

Componentes principales:
- Electron main: inicia app, ventana, servidor OAuth local, servidor NestJS y tray. Referencias: `src/main.ts`, `src/ipc/tray/handler.ts`, `src/ipc/cloud/authServer.ts`.
- Preload/renderer: expone APIs seguras al renderer y renderiza la UI React. Referencias: `src/preload.ts`, `src/renderer.ts`, `src/App.tsx`.
- IPC/ORPC: capa de RPC tipada entre renderer y main. Referencias: `src/ipc/manager.ts`, `src/ipc/router.ts`.
- NestJS proxy: servidor HTTP para requests estilo OpenAI/Anthropic/Gemini. Referencias: `src/server/server.ts`, `src/server/proxy/proxy.controller.ts`, `src/server/proxy/proxy.service.ts`.
- Persistencia: base SQLite local y archivos de estado para tokens e identidad. Referencias: `src/ipc/database/cloudHandler.ts`, `src/utils/paths.ts`.
- CLI: herramienta Python para administrar cuentas. Referencias: `cli/cli.py`, `cli/README.md`.

Stack tecnico:
- Electron + Vite (main/preload/renderer). Referencias: `forge.config.ts`, `vite.main.config.mts`, `vite.preload.config.mts`, `vite.renderer.config.mts`.
- React 19 + TanStack Router + TanStack Query. Referencias: `src/App.tsx`, `src/renderer.ts`.
- Tailwind CSS v4 + Radix UI + i18next. Referencias: `src/styles`, `src/localization`.
- NestJS + Fastify (servidor proxy). Referencias: `src/server/server.ts`, `src/server/proxy/proxy.module.ts`.
- Better-SQLite3 + Drizzle / SQL directo. Referencias: `src/ipc/database/cloudHandler.ts`, `src/ipc/database/handler.ts`.
- Zod (validacion). Referencias: `src/ipc/router.ts`, `src/ipc/*/router.ts`.

Modelo mental de alto nivel:
1. El usuario agrega una cuenta Google (OAuth).
2. El token se guarda cifrado en SQLite.
3. Se inyecta el token al almacenamiento del IDE para activar acceso.
4. El proxy usa tokens guardados para servir peticiones de modelos.

Referencias clave:
- Entrypoint main: `src/main.ts`
- Configuracion de rutas y RPC: `src/ipc/router.ts`
- Proxy HTTP: `src/server/proxy/proxy.controller.ts`
