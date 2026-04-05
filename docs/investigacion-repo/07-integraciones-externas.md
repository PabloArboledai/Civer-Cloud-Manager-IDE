# Integraciones externas

## Google OAuth y APIs

Se usan endpoints OAuth y APIs internas para:
- intercambio de token,
- perfil de usuario,
- carga de cuotas y modelos,
- contextos de proyecto.

Referencias: `src/services/GoogleAPIService.ts`.

Lista de endpoints (externos):
- `https://oauth2.googleapis.com/token`
- `https://www.googleapis.com/oauth2/v2/userinfo`
- `https://accounts.google.com/o/oauth2/v2/auth`
- `https://cloudcode-pa.googleapis.com/v1internal`
- `https://daily-cloudcode-pa.googleapis.com/v1internal`
- `https://generativelanguage.googleapis.com/v1beta`

## Sentry

El main y renderer pueden inicializar Sentry si esta habilitado en config. Referencias: `src/instrument.ts`, `src/renderer.ts`, `src/preload.ts`.

## Auto update

Usa `update-electron-app` para revisar actualizaciones. Referencia: `src/main.ts`.

## User-Agent remoto

Existe un servicio remoto para obtener version y user-agent:
- `https://antigravity-auto-updater-974169037036.us-central1.run.app`
- `https://antigravity.google/changelog`
Referencias: `src/utils/request-user-agent.ts`.
