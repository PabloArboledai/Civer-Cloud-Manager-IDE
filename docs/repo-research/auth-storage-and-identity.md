# Autenticacion, tokens, cuotas y perfiles

Resumen

La app maneja OAuth con Google para obtener tokens de Antigravity. Los tokens y cuotas se almacenan cifrados en SQLite. Ademas, se inyectan tokens en el estado local del IDE para cambiar de cuenta y se gestionan perfiles de dispositivo para rotar identificadores locales.

OAuth y flujo de login

- Se abre un auth URL con un redirect local en `http://localhost:8888/oauth-callback`.
- Un servidor HTTP local recibe el `code` y lo entrega al renderer via IPC.
- El `code` se intercambia por `access_token` y `refresh_token`.
- Referencias: `src/services/GoogleAPIService.ts`, `src/ipc/cloud/authServer.ts`, `src/ipc/cloud/handler.ts`

Tokens y cuotas

- `token_json` y `quota_json` se guardan en la tabla `accounts` de `cloud_accounts.db`.
- Se cifran con AES-256-GCM usando una llave maestra obtenida via `safeStorage` o `keytar`.
- Existe una ruta de migracion y fallback con una llave almacenada en archivo `.mk` dentro del userData.
- Referencias: `src/ipc/database/schema.ts`, `src/ipc/database/cloudHandler.ts`, `src/utils/security.ts`

Campos relevantes en la DB de cuentas

- `email`, `name`, `avatar_url` para identidad.
- `token_json` (cifrado), `quota_json` (cifrado), `device_profile_json` y `device_history_json`.
- `status`, `is_active`, `last_quota_update`, `last_used_at`.
- Referencias: `src/ipc/database/schema.ts`, `src/ipc/database/cloudHandler.ts`

Seleccion de cuenta y auto switch

- Monitoreo de cuotas cada pocos minutos, con refresco de token si vence.
- Auto switch elige una cuenta con cuota adecuada cuando la cuenta activa esta agotada o rate limited.
- Referencias: `src/services/CloudMonitorService.ts`, `src/services/AutoSwitchService.ts`, `src/ipc/cloud/handler.ts`

Cuotas y project id

- Se consultan cuotas por modelo y total.
- El sistema intenta resolver `project_id` desde respuestas de cuota y/o config de entorno.
- Referencias: `src/services/GoogleAPIService.ts`, `src/server/modules/proxy/token-manager.service.ts`

Identidad y perfiles de dispositivo

- Se leen y escriben identificadores locales en `storage.json` del IDE y en `state.vscdb`.
- Se puede guardar y aplicar perfiles de dispositivo (machineId, macMachineId, devDeviceId, sqmId, storage.serviceMachineId).
- Hay backups y un modo de seguridad para rollback si la aplicacion de perfiles falla.
- Referencias: `src/ipc/device/handler.ts`, `src/utils/paths.ts`

Inyeccion de tokens al IDE

- Se escribe el token OAuth en `state.vscdb` del IDE en clave unificada o en un formato legacy (protobuf).
- Se detecta la version del IDE para decidir el formato.
- Referencias: `src/ipc/database/cloudHandler.ts`, `src/utils/protobuf.ts`, `src/utils/antigravityVersion.ts`

Compatibilidad legacy

- Se soporta lectura de tokens legacy y escritura en formato protobuf en versiones antiguas del IDE.
- Existe una ruta de migracion que intenta leer token en varios formatos.
- Referencias: `src/utils/protobuf.ts`, `src/ipc/database/cloudHandler.ts`

Almacenamiento local adicional

- Snapshots de cuentas locales en `antigravity_accounts.json` con backups.
- Estado relevante del IDE guardado en `ItemTable` (keys como `antigravityAuthStatus`, `antigravityUnifiedStateSync.oauthToken`).
- Referencias: `src/ipc/account/handler.ts`, `src/ipc/database/handler.ts`

Proteccion de datos sensibles

- Se mascara informacion sensible en logs (tokens, api_key, refresh_token).
- Referencia: `src/utils/sensitiveDataMasking.ts`

