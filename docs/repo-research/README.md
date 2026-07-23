# Investigacion completa del repo

Este paquete de documentacion describe en detalle como funciona Antigravity Manager, su stack, sus sistemas internos, sus conexiones externas, y los flujos de autenticacion, tokens, saldos y perfiles de identidad.

Objetivo

- Proveer un mapa de la arquitectura y responsabilidades por modulo.
- Aclarar donde se guardan datos sensibles y como se protegen.
- Describir las llamadas externas y el proxy interno.
- Documentar los flujos de cambio de cuenta, cuotas y perfiles de dispositivo.

Mapa rapido

- Arquitectura y procesos: `docs/repo-research/architecture.md`
- Autenticacion, tokens, cuotas, identidades y almacenamiento: `docs/repo-research/auth-storage-and-identity.md`
- Proxy y llamadas externas: `docs/repo-research/proxy-and-external-calls.md`
- Snapshots locales y switching: `docs/repo-research/local-snapshots-and-switching.md`
- Build, test y release: `docs/repo-research/build-test-release.md`
- Hallazgos y notas de riesgo: `docs/repo-research/notable-findings.md`

Contexto general del producto

Antigravity Manager es una app Electron con React en el renderer y un servidor NestJS embebido que actua como proxy para modelos. La app gestiona cuentas de Antigravity, tokens OAuth, cuotas y perfiles de dispositivo; tambien manipula el estado local del IDE de Antigravity para inyectar tokens y alternar cuentas. El flujo principal se orquesta desde el proceso main de Electron.

Referencias clave de codigo

- Entrada Electron main: `src/main.ts`
- Preload y renderer: `src/preload.ts`, `src/renderer.ts`
- Router IPC/ORPC: `src/ipc/router.ts`, `src/ipc/handler.ts`, `src/ipc/manager.ts`
- Base de datos local y cifrado: `src/ipc/database/cloudHandler.ts`, `src/ipc/database/schema.ts`, `src/utils/security.ts`
- Servicios de Google y cuotas: `src/services/GoogleAPIService.ts`, `src/services/CloudMonitorService.ts`
- Proxy NestJS: `src/server/main.ts`, `src/server/modules/proxy/proxy.controller.ts`
- Inyeccion al IDE: `src/utils/protobuf.ts`, `src/utils/antigravityVersion.ts`, `src/ipc/database/handler.ts`

