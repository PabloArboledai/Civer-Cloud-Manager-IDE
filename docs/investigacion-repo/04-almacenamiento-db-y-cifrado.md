# Almacenamiento, DB y Cifrado

## Ubicaciones de almacenamiento

Rutas principales:
- App data (Antigravity): `src/utils/paths.ts`
- BD cloud: `~/.antigravity-agent/cloud_accounts.db` (variable segun OS). Referencia: `src/utils/paths.ts`.
- Archivos de cuenta: `~/.antigravity-agent/antigravity_accounts.json` y `backups/`. Referencia: `src/ipc/account/handler.ts`.
- DB del IDE: `User/globalStorage/state.vscdb` y `storage.json`. Referencias: `src/utils/paths.ts`, `src/ipc/device/handler.ts`.

En Windows, el app data usa `%APPDATA%/Antigravity`; en macOS `~/Library/Application Support/Antigravity`; en Linux `~/.config/Antigravity`. Referencia: `src/utils/paths.ts`.

## Esquema de cloud_accounts.db

Tablas principales:
- `accounts`: guarda `id`, `email`, `token` (cifrado), `quota` (cifrado), timestamps.
- `settings`: claves para valores globales (ej. cuenta activa).
Referencia: `src/ipc/database/cloudHandler.ts`.

## Cifrado y llaves

El cifrado usa AES-256-GCM. La llave maestra se obtiene en este orden:
1. Electron `safeStorage`
2. `keytar`
3. Archivo local `.mk` en `userData`

Formato de cifrado: `iv_hex:auth_tag_hex:ciphertext_hex`.
Referencia: `src/utils/security.ts`.

La funcion `decryptWithMigration` permite migrar datos cifrados con claves previas y re-cifrarlos con la llave actual. Referencia: `src/utils/security.ts`.

## Backups y restauracion

El sistema permite:
- Exportar snapshots de claves especificas del IDE.
- Restaurar snapshots de cuentas locales.
Referencias: `src/ipc/database/handler.ts`, `src/ipc/account/handler.ts`.
