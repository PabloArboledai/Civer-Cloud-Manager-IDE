# Autenticacion y tokens

Resumen:
- la autenticacion principal es OAuth 2.0 de Google
- el `main` abre el navegador externo y un server local recibe el `code`
- los tokens se guardan cifrados en `cloud_accounts.db`
- luego se inyectan dentro de la DB del IDE Antigravity para "logear" la cuenta en el producto externo

Flujo OAuth completo:

```plaintext
UI -> cloud.startAuthFlow()
  -> shell.openExternal(google auth URL)
Google redirect
  -> http://localhost:8888/oauth-callback?code=...
AuthServer
  -> renderer event GOOGLE_AUTH_CODE
UI / ORPC
  -> cloud.addGoogleAccount(authCode)
GoogleAPIService.exchangeCode()
GoogleAPIService.getUserInfo()
GoogleAPIService.fetchQuota()
CloudAccountRepo.addAccount()
```

Piezas implicadas:
- `src/ipc/cloud/authServer.ts`
- `src/ipc/cloud/handler.ts`
- `src/services/GoogleAPIService.ts`
- `src/ipc/database/cloudHandler.ts`

Datos del token cloud:
- `access_token`
- `refresh_token`
- `expires_in`
- `expiry_timestamp`
- `token_type`
- `email`
- `project_id`
- `session_id`
- `upstream_proxy_url`

Unidad temporal importante:
- TypeScript usa `expiry_timestamp` en segundos unix.
- `addGoogleAccount`, `switchCloudAccount`, `refreshAccountQuota`, `CloudMonitorService` y `TokenManagerService` trabajan asi.
- el CLI Python no sigue esa misma convencion y ahi hay una desviacion documentada en `riesgos-y-hallazgos.md`.

Scopes OAuth pedidos:
- `https://www.googleapis.com/auth/cloud-platform`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`
- `https://www.googleapis.com/auth/cclog`
- `https://www.googleapis.com/auth/experimentsandconfigs`

Obtencion de metadatos posteriores al login:
- `getUserInfo()` obtiene email, nombre y avatar.
- `fetchProjectContext()` intenta resolver `project_id` y tier de suscripcion.
- `fetchQuota()` obtiene cuotas y reglas dinamicas de forwarding.

Refresco de tokens:
- `refreshAccountQuota()` refresca si faltan menos de 5 minutos.
- `switchCloudAccount()` intenta refrescar con margen de 20 minutos antes de inyectar.
- `CloudMonitorService.poll()` refresca si faltan menos de 10 minutos.
- `TokenManagerService.finalizeSelectedToken()` refresca si faltan menos de 5 minutos para una request del proxy.

Almacenamiento de auth dentro del IDE:
- clave nueva:
  `antigravityUnifiedStateSync.oauthToken`
- clave legacy:
  `jetskiStateSync.agentManagerInitState`
- estado complementario:
  `antigravityAuthStatus`
  `antigravityOnboarding`
- limpieza:
  elimina `google.antigravity`

Estrategia de inyeccion:
- `CloudAccountRepo` detecta version del IDE con `getAntigravityVersion()`.
- si la version es nueva usa formato unified.
- si la version es vieja usa protobuf legacy en el campo 6.
- si no puede decidir, intenta ambos caminos.

Sync desde el IDE:
- `CloudAccountRepo.syncFromIDE()` lee `state.vscdb`.
- intenta primero `antigravityUnifiedStateSync.oauthToken`.
- si no existe, cae a `jetskiStateSync.agentManagerInitState`.
- decodifica protobuf, valida token con Google y upsertea la cuenta en DB local.

Riesgos y observaciones:
- `CLIENT_ID` y `CLIENT_SECRET` estan embebidos en el repo.
- `startAuthFlow()` construye la URL sin parametro `state`.
- el redirect usa `localhost:8888` fijo.
- `AuthServer` es local y simple; no hay rotacion de puerto ni proteccion adicional del callback.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\cloud\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\cloud\authServer.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\services\GoogleAPIService.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\database\cloudHandler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\protobuf.ts`

## Codex / ChatGPT local

El login de Codex/ChatGPT no entra al pool `Accounts`. Se detecta como estado local separado en `~/.codex` y se muestra en la ruta `Codex`.

Puntos clave:
- `auth.json` se lee desde `C:\Users\Afrodita\.codex\auth.json`.
- el estado se considera autenticado si existe `access_token`, `refresh_token`, `id_token` o `OPENAI_API_KEY`.
- la UI no expone tokens crudos; solo muestra una tarjeta redaccionada con:
  - cuenta enmascarada
  - correo enmascarado
  - plan ChatGPT
  - organizacion por defecto
  - expiracion aproximada de tokens
  - ventana de suscripcion, si el claim existe

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\codex\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\routes\codex.tsx`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\types\codex.ts`
