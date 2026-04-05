# Llamadas externas

Resumen:
- el repo habla sobre todo con servicios Google
- tambien toca endpoints publicos de versionado y GitHub para automatizacion
- ademas expone listeners y servicios locales en la propia maquina

Google OAuth y perfil:
- `https://accounts.google.com/o/oauth2/v2/auth`
- `https://oauth2.googleapis.com/token`
- `https://www.googleapis.com/oauth2/v2/userinfo`

Google Cloud Code interno:
- `https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels`
- `https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist`
- `https://cloudcode-pa.googleapis.com/v1internal`
- `https://daily-cloudcode-pa.googleapis.com/v1internal`

Gemini publico:
- `https://generativelanguage.googleapis.com/v1beta`

Versionado / user agent discovery:
- `https://antigravity-auto-updater-974169037036.us-central1.run.app`
- `https://antigravity.google/changelog`

GitHub para auto backup:
- `https://api.github.com/user`
- `https://api.github.com/repos/:owner/:repo`
- `https://api.github.com/user/repos`

Superficie local expuesta por la app:
- OAuth callback:
  `http://localhost:8888/oauth-callback`
- proxy/gateway:
  `http://localhost:<port>` o `http://<ip-lan>:<port>`
- listen del proxy:
  `0.0.0.0`

Headers e identidad de request:
- Google OAuth usa `application/x-www-form-urlencoded`.
- `GoogleAPIService` y `GeminiClient` adjuntan `Authorization: Bearer`.
- para APIs internas se construye `User-Agent` estilo Antigravity.
- el `project_id` cuando existe se manda en payload del request interno.

Proxy HTTP saliente:
- `GoogleAPIService` usa `undici.ProxyAgent` si `config.proxy.upstream_proxy.enabled`.
- `GeminiClient` parsea `upstream_proxy.url` y la traduce a config de `axios`.
- algunos tokens cloud tambien pueden portar `upstream_proxy_url`.

Llamadas al host local:
- abrir navegador para OAuth
- abrir carpeta de logs
- abrir carpeta de storage/identidad
- lanzar URI `antigravity://oauth-success`
- matar / arrancar el ejecutable Antigravity

Notas:
- no se detectaron websockets propios del producto en la lectura hecha.
- hay dependencias gRPC en `package.json`, pero no aparecen como integracion central del flujo principal documentado aqui.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\services\GoogleAPIService.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\modules\proxy\clients\gemini.client.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\modules\proxy\request-user-agent.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\cloud\authServer.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\scripts\setup-auto-backup.mjs`
