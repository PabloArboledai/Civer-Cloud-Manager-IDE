# IPC y ORPC

Resumen: el renderer no llama directamente a Electron APIs de alto privilegio. En su lugar usa un puente ORPC montado sobre `MessagePort`, mas algunos eventos IPC raw muy puntuales expuestos por `preload`.

## Arquitectura del puente

El flujo real es:

1. `src/ipc/manager.ts` crea un `MessageChannel`.
2. El renderer conserva `port1` como cliente ORPC.
3. Envia `port2` al preload mediante `window.postMessage(START_ORPC_SERVER, ...)`.
4. `src/preload.ts` reenvia ese puerto al main con `ipcRenderer.postMessage`.
5. `src/main.ts` registra `rpcHandler`.
6. `src/ipc/handler.ts` usa `RPCHandler` de `@orpc/server/message-port` y atiende requests contra `src/ipc/router.ts`.

## Superficie expuesta por preload

`window.electron` expone:

- `SENTRY_ENABLED`
- `onGoogleAuthCode(callback)`
- `changeLanguage(lang)`
- `debugLog(payload)`

Eventos raw observados:

- `GOOGLE_AUTH_CODE`
  Se envia desde `AuthServer` al renderer cuando llega el callback OAuth.
- `START_ORPC_SERVER`
  Se usa para iniciar el canal ORPC.
- `CHANGE_LANGUAGE`
  Permite sincronizar idioma con tray.
- `DEBUG_LOG`
  Permite mandar eventos de debug desde renderer a main.

## Router ORPC raiz

`src/ipc/router.ts` monta estos dominios:

- `ping`
- `theme`
- `window`
- `app`
- `database`
- `proc`
- `account`
- `cloud`
- `config`
- `gateway`
- `system`

## Rutas por dominio

### `app`

- `currentPlatfom`
- `appVersion`

### `theme`

- `getCurrentThemeMode`
- `setThemeMode`
- `toggleThemeMode`

### `window`

- `minimizeWindow`
- `maximizeWindow`
- `closeWindow`

### `database`

- `backupAccount`
- `restoreAccount`
- `getCurrentAccountInfo`

### `proc`

- `isProcessRunning`
- `closeAntigravity`
- `startAntigravity`

### `config`

- `load`
- `save`

### `gateway`

- `start`
- `stop`
- `status`
- `generateKey`

### `system`

- `get_local_ips`
- `openLogDirectory`

### `account`

- `listAccounts`
- `addAccountSnapshot`
- `switchAccount`
- `deleteAccount`
- `previewGenerateIdentityProfile`
- `getIdentityProfiles`
- `bindIdentityProfile`
- `bindIdentityProfileWithPayload`
- `applyBoundIdentityProfile`
- `restoreIdentityProfileRevision`
- `deleteIdentityProfileRevision`
- `restoreBaselineProfile`
- `openIdentityStorageFolder`

### `cloud`

- `addGoogleAccount`
- `listCloudAccounts`
- `deleteCloudAccount`
- `refreshAccountQuota`
- `switchCloudAccount`
- `getAutoSwitchEnabled`
- `setAutoSwitchEnabled`
- `forcePollCloudMonitor`
- `startAuthFlow`
- `syncLocalAccount`
- `getSwitchStatus`
- `getIdentityProfiles`
- `previewIdentityProfile`
- `bindIdentityProfile`
- `bindIdentityProfileWithPayload`
- `restoreIdentityProfileRevision`
- `restoreBaselineProfile`
- `deleteIdentityProfileRevision`
- `openIdentityStorageFolder`

## Observaciones del cliente ORPC

`src/ipc/manager.ts` implementa un cliente custom en vez de un wrapper trivial:

- Construye el `methodPath` dinamicamente con `Proxy`.
- Lleva un mapa de pending requests.
- Loguea request, response, error y timeout.
- Tiene timeout fijo de 60 segundos por request.

## Observaciones utiles para agentes

- Si una accion de renderer no funciona, casi siempre hay que revisar primero el action wrapper en `src/actions/*`, luego el router ORPC y por ultimo el handler main.
- El main loguea bastante informacion del router y de los paquetes ORPC, lo cual ayuda a depurar problemas de transporte.
- El bridge ORPC es la frontera mas importante entre UI y operaciones sensibles.

## Referencias de codigo

- `src/preload.ts`
- `src/constants/index.ts`
- `src/ipc/manager.ts`
- `src/ipc/handler.ts`
- `src/ipc/router.ts`
- `src/ipc/cloud/router.ts`
- `src/ipc/account/router.ts`
- `src/ipc/database/router.ts`
- `src/ipc/gateway/router.ts`
