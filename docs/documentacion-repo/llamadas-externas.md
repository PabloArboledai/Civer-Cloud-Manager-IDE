# Llamadas externas

Resumen: el repo hace llamadas salientes principalmente a Google. Ademas consulta endpoints publicos para actualizacion/versionado y puede reportar errores a Sentry si la config y las variables de entorno lo permiten.

## OAuth y perfil de usuario

Endpoints:

- `https://accounts.google.com/o/oauth2/v2/auth`
- `https://oauth2.googleapis.com/token`
- `https://www.googleapis.com/oauth2/v2/userinfo`

Uso:

- abrir autorizacion en navegador externo
- intercambiar `code` por tokens
- refrescar `access_token`
- identificar email/nombre/avatar

## APIs internas de Google/Cloud Code

Endpoints observados:

- `https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist`
- `https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels`
- `https://daily-cloudcode-pa.googleapis.com/v1internal`

Uso:

- resolver `project_id`
- conocer quota/model availability
- descubrir forwarding rules de modelos deprecados
- obtener tier de suscripcion

## Gemini / Generative Language

Endpoint observado:

- `https://generativelanguage.googleapis.com/v1beta`

Uso:

- servir requests del proxy en formato Gemini
- responder a traducciones desde OpenAI/Anthropic compatibles

## Actualizaciones y metadatos de version

Se observan endpoints publicos consultados para user-agent/version y auto-update:

- `https://antigravity-auto-updater-974169037036.us-central1.run.app`
- `https://antigravity.google/changelog`

Ademas `update-electron-app` se integra con el repo `Draculabo/AntigravityManager`.

## Telemetria opcional

Sentry puede activarse si:

- `error_reporting_enabled` esta en true en config
- existe configuracion/env necesaria para DSN/proyecto

La documentacion del repo no hardcodea un endpoint unico en codigo de negocio, pero el mecanismo existe.

## Servicios locales expuestos por la app

No son llamadas salientes, pero conviene inventariarlos:

- `http://localhost:8888/oauth-callback`
  callback local de OAuth
- `http://localhost:<port>`
  gateway NestJS local

## Soporte de proxy upstream

Si la config lo activa, el repo puede encaminar llamadas HTTP a traves de un upstream proxy:

- en `GoogleAPIService`
- en `GeminiClient`
- y tambien via `upstream_proxy_url` asociado a una cuenta/token

## Resumen practico por subsistema

- Alta/refresco de cuenta: Google OAuth + userinfo
- Resolucion de proyecto/cuota: Cloud Code internal APIs
- Proxy local: Gemini + Cloud Code internal APIs
- Versionado/update: updater service + changelog publico
- Telemetria: Sentry opcional

## Referencias de codigo

- `src/services/GoogleAPIService.ts`
- `src/server/modules/proxy/clients/gemini.client.ts`
- `src/server/modules/proxy/request-user-agent.ts`
- `src/main.ts`
- `src/instrument.ts`
- `src/preload.ts`
- `src/renderer.ts`
