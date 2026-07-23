# Autenticacion, Tokens e Identidad

## OAuth y cuentas cloud

El sistema usa OAuth de Google para autenticar cuentas y obtener tokens de acceso/refresco. El flujo se inicia con una URL OAuth y termina en un callback local. Referencias: `src/ipc/cloud/handler.ts`, `src/ipc/cloud/authServer.ts`.

Endpoints externos usados:
- Token exchange: `https://oauth2.googleapis.com/token`
- User info: `https://www.googleapis.com/oauth2/v2/userinfo`
- Auth URL: `https://accounts.google.com/o/oauth2/v2/auth`
Referencias: `src/services/GoogleAPIService.ts`.

## Tokens y cuotas (saldos)

Los tokens y la informacion de cuotas se guardan por cuenta en la DB `cloud_accounts.db`. Los campos `token` y `quota` se almacenan cifrados. La cuota se obtiene via endpoints internos (Cloud Code Assist) y contiene limites por modelo. Referencias: `src/ipc/database/cloudHandler.ts`, `src/services/GoogleAPIService.ts`.

El proxy usa estas cuotas para:
- decidir la cuenta activa,
- calcular agotamiento (porcentaje restante),
- establecer limites por modelo.
Referencias: `src/services/AutoSwitchService.ts`, `src/server/proxy/token-manager.service.ts`, `src/lib/antigravity/ModelSpecs.ts`.

## Inyeccion de token en IDE

El sistema escribe tokens en el almacenamiento del IDE para habilitar uso sin login manual.

Formas soportadas:
- Formato unificado: `antigravityUnifiedStateSync.oauthToken` en `state.vscdb` (token protobuf).
- Formato legacy: actualiza `jetskiStateSync.agentManagerInitState` (campo 6) con token protobuf.

Referencias:
- Inyeccion y limpieza: `src/ipc/database/cloudHandler.ts`
- Protobuf: `src/utils/protobuf.ts`
- Acceso a DB del IDE: `src/utils/paths.ts`

## Identidad del dispositivo

El sistema puede aplicar perfiles de identidad para el IDE, modificando:
- `storage.json`: `machineId`, `macMachineId`, `devDeviceId`, `sqmId`
- `state.vscdb`: `storage.serviceMachineId`

Hay manejo de backups, last-known-good y un modo seguro para evitar fallos repetidos. Referencia: `src/ipc/device/handler.ts`.

Flags de control:
- `CRACK_IDENTITY_PROFILE_APPLY_ENABLED`
- `CRACK_DEVICE_FINGERPRINT_ENABLED`
Referencias: `src/ipc/device/handler.ts`.
