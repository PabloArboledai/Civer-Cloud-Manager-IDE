# Snapshots locales y switching de cuentas

Resumen

El switching de cuentas se apoya en snapshots locales y en la inyeccion directa de tokens en el IDE. Se mantiene un historial con backups y un flujo de cierre y reinicio del IDE para aplicar cambios de forma consistente.

Snapshots de cuentas locales

- Archivo principal: `antigravity_accounts.json`
- Backups en un directorio `backups/` dentro del directorio del agente.
- Referencias: `src/ipc/account/handler.ts`, `src/utils/paths.ts`

Respaldo de estado del IDE

- Se guardan claves de `ItemTable` como `antigravityAuthStatus` y `antigravityUnifiedStateSync.oauthToken`.
- Se puede restaurar ese estado al cambiar de cuenta.
- Referencias: `src/ipc/database/handler.ts`, `src/ipc/account/handler.ts`

Switching de cuentas

- Se cierra el IDE (graceful y kill si es necesario).
- Se aplica perfil de dispositivo si esta habilitado.
- Se inyecta token en el IDE y se reinicia el proceso.
- Referencias: `src/ipc/switchFlow.ts`, `src/ipc/process/handler.ts`, `src/ipc/device/handler.ts`

Modo seguro y rollback

- Si la aplicacion de perfiles falla varias veces, se entra en modo seguro.
- Existe un backup original de identidad para recuperar.
- Referencias: `src/ipc/device/handler.ts`

