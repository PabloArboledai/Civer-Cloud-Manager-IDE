# IPC, ORPC y API interna

La comunicacion renderer <-> main usa ORPC sobre MessageChannel. El preload escucha `START_ORPC_SERVER` y el main crea el servidor RPC. Referencias: `src/ipc/manager.ts`, `src/preload.ts`, `src/ipc/handler.ts`.

## Rutas principales del router ORPC

Rutas:
- `theme`, `window`, `app`: UI y ventana. Referencia: `src/ipc/router.ts`.
- `database`: backup/restore, info de cuenta. Referencia: `src/ipc/database/router.ts`.
- `proc`: start/stop/status del IDE. Referencia: `src/ipc/process/router.ts`.
- `account`: snapshots locales. Referencia: `src/ipc/account/router.ts`.
- `cloud`: cuentas cloud, refresh, switch, auth flow, auto-switch. Referencia: `src/ipc/cloud/router.ts`.
- `config`: leer/guardar config. Referencia: `src/ipc/config/router.ts`.
- `gateway`: controlar proxy (start/stop/status/generateKey). Referencia: `src/ipc/gateway/router.ts`.
- `system`: info de sistema. Referencia: `src/ipc/system/router.ts`.

## Consideraciones de seguridad

El ORPC vive dentro del proceso local y se comunica solo con el renderer. No hay exposicion de red desde ORPC.

## Mensajeria adicional

El main emite eventos al renderer:
- `GOOGLE_AUTH_CODE` con el `code` OAuth. Referencia: `src/ipc/cloud/authServer.ts`.
- Logs de consola del renderer en main. Referencia: `src/main.ts`.
