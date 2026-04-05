# Almacenamiento y datos

Resumen: hay dos bases de datos locales principales. Una para cuentas cloud y otra para el IDE externo. La app tambien mantiene backups y archivos JSON para switching local.

DB de cuentas cloud:
- Archivo SQLite en el directorio del agente.
- Tablas `accounts` y `settings`.
- Campos con token, cuotas, perfil de dispositivo y metadatos.
- Tokens y cuotas se cifran en columnas `token_json` y `quota_json`.

Schema `accounts` (resumen):
- `id`, `provider`, `email`, `name`, `avatar_url`
- `token_json`, `quota_json`
- `device_profile_json`, `device_history_json`
- `created_at`, `last_used`, `status`, `is_active`

Identificacion de cuentas:
- `id` es el identificador principal.
- `provider` define el tipo de cuenta (por ejemplo, google).
- `email` y `name` se usan para UI y seleccion.
- `status` y `is_active` se usan para auto-switch y estado actual.

Schema `settings` (resumen):
- `key`, `value`

DB del IDE:
- Archivo `state.vscdb` (SQLite) con tabla `ItemTable`.
- Se leen y escriben claves especificas para OAuth y estado del IDE.

Claves relevantes en `ItemTable`:
- `antigravityUnifiedStateSync.oauthToken`
- `jetskiStateSync.agentManagerInitState`
- `antigravityAuthStatus`
- `antigravityOnboarding`
- `storage.serviceMachineId`
- `google.antigravity` (se elimina en algunos flujos)

Archivos auxiliares:
- Backups de `state.vscdb` por cuenta.
- `antigravity_accounts.json` como indice de cuentas locales.
- `storage.json` para identidad de dispositivo.

Ubicaciones tipicas:
- DB cloud: `~/.antigravity-agent/cloud_accounts.db`
- Indice: `~/.antigravity-agent/antigravity_accounts.json`
- Backups: `~/.antigravity-agent/backups`
- DB IDE: `AppData/Roaming/Antigravity/User/globalStorage/state.vscdb`
- Storage IDE: `AppData/Roaming/Antigravity/User/globalStorage/storage.json`

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\database\schema.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\database\cloudHandler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\database\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\device\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\paths.ts`
