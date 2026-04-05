# Riesgos y notas

## Riesgos operativos

- Proxy abierto si `api_key` no esta configurada. Referencia: `src/server/proxy/proxy.guard.ts`.
- Escritura de tokens en almacenamiento del IDE puede fallar si la DB esta bloqueada o versiones no coinciden. Referencias: `src/ipc/database/cloudHandler.ts`, `src/utils/protobuf.ts`.
- Aplicacion de identidad del dispositivo puede dejar el IDE en estado inconsistente si falla a mitad; existe rollback. Referencia: `src/ipc/device/handler.ts`.

## Persistencia y cifrado

- Si `safeStorage` y `keytar` fallan, la llave se guarda en archivo local `.mk`. Referencia: `src/utils/security.ts`.
- Migracion de cifrado reescribe datos, requiere que la clave antigua sea recuperable. Referencia: `src/utils/security.ts`.

## Red y dependencias

- Dependencia de endpoints internos de Google (Cloud Code Assist). Referencias: `src/services/GoogleAPIService.ts`, `src/server/proxy/gemini.client.ts`.
- Dependencia de servicio remoto para user-agent. Referencia: `src/utils/request-user-agent.ts`.
