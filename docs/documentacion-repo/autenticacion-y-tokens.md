# Autenticacion y tokens

Resumen: el flujo principal usa OAuth de Google. El main abre una ventana de auth, recibe el `code` via un server local, intercambia por tokens, guarda tokens cifrados en SQLite y los inyecta en el IDE para habilitar el acceso. El proxy interno reutiliza esos tokens via TokenManagerService.

Flujo OAuth:
- El renderer solicita `startAuthFlow` via ORPC.
- Main abre la URL de OAuth de Google en el navegador.
- AuthServer escucha en `http://localhost:8888/oauth-callback` y recibe el `code`.
- Main intercambia el `code` por `access_token` y `refresh_token`.
- Se obtiene `userinfo`, `loadCodeAssist` y `fetchAvailableModels`.
- Se guarda la cuenta en la DB local con cifrado.

Almacenamiento:
- Tokens y cuotas se cifran con AES-256-GCM.
- La master key se obtiene de `safeStorage` o `keytar`, con fallback local.
- La DB de cuentas vive en el directorio del agente.

Inyeccion en IDE:
- Se escriben claves en `state.vscdb` para el token OAuth y estado de auth.
- Se soportan formatos de token antiguos y nuevos segun version del IDE.

Proxy interno:
- El TokenManagerService cachea tokens por cuenta y decide cual usar.
- Refresh automatico cuando el token expira o esta por expirar.

Tokens y formatos en el IDE:
- Nuevo formato: se escribe `antigravityUnifiedStateSync.oauthToken` con un payload protobuf generado.
- Formato legacy: se escribe `jetskiStateSync.agentManagerInitState` con el token en el campo 6 del protobuf.
- Estado de auth: se actualiza `antigravityAuthStatus` y se ajusta `antigravityOnboarding` para evitar flujos repetidos.
- Limpieza: se elimina la key `google.antigravity` para evitar conflictos.

Saldos y cuotas:
- `fetchAvailableModels` devuelve cuotas por modelo.
- Esas cuotas se guardan en `quota_json` y se usan para decisiones de auto-switch.
- El proxy usa cuotas para rate limit y seleccion de cuenta.

Refresco de tokens:
- Si el token esta proximo a expirar, se usa `refresh_token` para renovar.
- El TokenManagerService guarda el token actualizado en la DB local.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\cloud\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\cloud\authServer.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\services\GoogleAPIService.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\database\cloudHandler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\security.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\proxy\services\tokenManager.service.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\database\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\protobuf.ts`
