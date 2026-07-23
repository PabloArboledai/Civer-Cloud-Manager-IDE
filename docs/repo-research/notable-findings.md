# Hallazgos y notas

Discrepancias y riesgos

- `SECURITY.md` menciona uso de keychain, pero el codigo tambien usa `safeStorage` y un fallback `.mk` en userData. Referencias: `SECURITY.md`, `src/utils/security.ts`
- El CLI y la app principal parecen usar directorios distintos para datos locales en algunas rutas. Referencias: `cli/core.py`, `src/utils/paths.ts`
- El proxy puede quedar abierto si `api_key` no esta configurada. Referencia: `src/server/modules/proxy/proxy.guard.ts`

Dependencias criticas externas

- OAuth y APIs de Google, Gemini y Cloudcode; si cambian endpoints o scopes, el login y cuotas pueden romperse.
- Referencias: `src/services/GoogleAPIService.ts`, `src/server/modules/proxy/clients/gemini.client.ts`

Areas de alta sensibilidad

- Inyeccion directa en `state.vscdb` del IDE para cambiar cuentas.
- Identificadores de dispositivo locales modificados para perfiles.
- Referencias: `src/ipc/database/cloudHandler.ts`, `src/ipc/device/handler.ts`

