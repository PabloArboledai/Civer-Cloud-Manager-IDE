# Almacenamiento y datos

Resumen:
- el repo usa varios almacenes locales, cada uno con un rol distinto
- el estado "propio" del manager vive sobre todo en `cloud_accounts.db`, `gui_config.json` y algunos JSON auxiliares
- el manager ademas opera sobre la DB y archivos del IDE Antigravity

Mapa de persistencia:

```plaintext
~/.antigravity-agent/
  cloud_accounts.db
  antigravity_accounts.json
  backups/*.json
  device_original.json
  device_last_known_good/*
  .mk
  app-YYYY-MM-DD.log

AppData Antigravity/
  gui_config.json
  User/globalStorage/state.vscdb
  User/globalStorage/storage.json
```

1. `cloud_accounts.db`
- archivo:
  `~/.antigravity-agent/cloud_accounts.db`
- tabla `accounts`:
  `id`, `provider`, `email`, `name`, `avatar_url`
  `token_json`, `quota_json`
  `device_profile_json`, `device_history_json`
  `created_at`, `last_used`, `status`, `is_active`
- tabla `settings`:
  `key`, `value`

2. `antigravity_accounts.json`
- indice de snapshots locales del IDE
- no almacena el token cloud cifrado; apunta a backups JSON por cuenta local

3. `backups/*.json`
- snapshots de claves concretas de `state.vscdb`
- sirven para restaurar el estado de una cuenta local del IDE

4. `state.vscdb`
- SQLite del IDE Antigravity
- tabla `ItemTable`
- claves importantes:
  `antigravityAuthStatus`
  `jetskiStateSync.agentManagerInitState`
  `antigravityUnifiedStateSync.oauthToken`
  `antigravityOnboarding`
  `storage.serviceMachineId`
  `google.antigravity`

5. `storage.json`
- archivo del IDE donde viven ids de dispositivo
- contiene `machineId`, `macMachineId`, `devDeviceId`, `sqmId`

6. `gui_config.json`
- config general de UI y proxy
- no vive en `~/.antigravity-agent`; vive en `getAppDataDir()`

7. `.mk`
- fallback del master key si `safeStorage` y `keytar` no se pueden usar
- no contiene tokens; contiene la clave con la que luego se cifran columnas de la DB

Como se protegen los datos:
- `token_json` y `quota_json` van cifrados con AES-256-GCM.
- el resto de metadatos suele ir como JSON plano o columnas normales.
- `CloudAccountRepo.migrateToEncrypted()` migra filas antiguas en texto plano.

Como se identifica cada cuenta:
- `id`:
  identificador interno principal del manager
- `email`:
  identidad humana usada por UI, tray y CLI
- `is_active`:
  cuenta cloud marcada como actual en el manager
- `status`:
  `active`, `rate_limited`, `expired`

Diferencia entre "cuenta local" y "cuenta cloud":
- cuenta local:
  snapshot del estado del IDE, pensada para restauraciones.
- cuenta cloud:
  credencial Google viva, con refresh token, project id y cuotas.

Rutas de descubrimiento del IDE:
- `getAntigravityDbPaths()` y `getAntigravityStoragePaths()` prueban varias ubicaciones.
- soportan Windows, macOS, Linux y WSL.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\database\cloudHandler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\database\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\database\schema.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\paths.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\security.ts`
