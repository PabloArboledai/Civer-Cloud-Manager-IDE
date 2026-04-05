# Dispositivo e identidad

Resumen:
- el manager mantiene perfiles de identidad del IDE Antigravity
- esos perfiles afectan `storage.json` y tambien `storage.serviceMachineId` en `state.vscdb`
- el sistema tiene baseline global, historial por cuenta, rollback, safe mode y verificaciones

Estructura del perfil:
- `machineId`
- `macMachineId`
- `devDeviceId`
- `sqmId`

Fuentes y destinos:
- origen principal:
  `storage.json`
- sincronizacion extra:
  `storage.serviceMachineId` en `ItemTable` de `state.vscdb`

Archivos auxiliares:
- `device_original.json`
  baseline global del dispositivo original
- `device_last_known_good/*`
  snapshots del ultimo estado considerado sano

Capacidades del modulo:
- leer perfil actual del IDE
- generar perfil nuevo aleatorio
- guardar baseline global si aun no existe
- aplicar perfil de forma verificada
- sincronizar `serviceMachineId` en DB
- mantener historial por cuenta local o cloud

Aplicacion de perfil:
- `executeSwitchFlow()` decide si aplica fingerprint.
- `applyDeviceProfile()` hace backup, escribe `storage.json`, sincroniza DB, verifica lectura y si falla intenta rollback.
- si acumula fallos de aplicacion entra en `safeMode`.

Controles de hardening:
- contador de fallos consecutivos
- `safeModeActive`
- `safeModeUntil`
- snapshot de ultimo fallo con etapa y razon
- verificacion despues de escribir

Flags de activacion:
- `CRACK_IDENTITY_PROFILE_APPLY_ENABLED`
- `CRACK_DEVICE_FINGERPRINT_ENABLED`

Relacion con cuentas:
- las cuentas cloud guardan `device_profile_json` y `device_history_json` en `cloud_accounts.db`.
- los snapshots locales guardan `deviceProfile` y `deviceHistory` en `antigravity_accounts.json`.
- se puede:
  capturar el perfil actual
  generar uno nuevo
  restaurar una revision
  restaurar baseline
  borrar revisiones historicas

Riesgos y observaciones:
- la identidad aplicada depende de flags de entorno; un switch puede hacer solo cambio de token si la aplicacion esta deshabilitada.
- el baseline es global, no por cuenta.
- este sistema escribe sobre archivos del IDE externo, por lo que su superficie de fallo es mayor que la de un cambio puro en DB local.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\device\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\types\account.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\account\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\cloud\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\paths.ts`
