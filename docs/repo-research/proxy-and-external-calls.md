# Proxy interno y llamadas externas

Resumen

La app inicia un servidor NestJS embebido que ofrece endpoints compatibles con OpenAI y Anthropic. Internamente, mapea modelos y reenvia las solicitudes a Gemini/Antigravity. El proxy puede aplicar balanceo y control de rate limit basado en tokens almacenados.

Endpoints principales del proxy

- OpenAI compatible: `/v1/chat/completions`, `/v1/completions`, `/v1/responses`, `/v1/images/*`, `/v1/audio/transcriptions`
- Anthropic compatible: `/v1/messages`
- Gemini passthrough: `/v1beta/*`
- Referencias: `src/server/modules/proxy/proxy.controller.ts`, `src/server/modules/proxy/gemini.controller.ts`

Streaming y errores

- Soporta streaming SSE cuando el cliente lo solicita.
- Mapea errores de Gemini a formatos compatibles con OpenAI/Anthropic.
- Referencias: `src/server/modules/proxy/proxy.service.ts`, `src/server/modules/proxy/response-transformer.ts`

Proteccion de acceso

- Un guard valida una API key configurada en la app (Bearer o headers `x-api-key` / `x-goog-api-key`).
- Si no hay `api_key` configurada, el proxy queda abierto.
- Referencia: `src/server/modules/proxy/proxy.guard.ts`

Seleccion de token y rate limit

- Un token manager escoge cuentas disponibles por round robin o por criterio de cuotas.
- Se penalizan tokens rate limited con un tracker en memoria.
- Referencias: `src/server/modules/proxy/token-manager.service.ts`, `src/server/modules/proxy/rate-limit-tracker.ts`

Programacion y reglas de forwarding

- Permite reglas de mapeo de modelos y overrides.
- Define limites de contexto y tamanos maximos de salida.
- Referencias: `src/types/config.ts`, `src/lib/antigravity/ModelSpecs.ts`, `src/lib/antigravity/model-specs.json`

Mapeo de modelos

- Se mapea entre modelos OpenAI/Anthropic y Gemini.
- Existe un set de specs y una tabla de mapeo por nombre.
- Referencias: `src/lib/antigravity/ModelMapping.ts`, `src/lib/antigravity/ModelSpecs.ts`, `src/lib/antigravity/model-specs.json`

Llamadas externas identificadas

- OAuth y tokens Google: `https://oauth2.googleapis.com/*`
- User info Google: `https://www.googleapis.com/oauth2/v1/userinfo`
- Cloudcode/Antigravity quotas: `https://cloudcode-pa.googleapis.com/*`
- Gemini API: `https://generativelanguage.googleapis.com/v1beta/*`
- Auto update y changelog: URLs en `src/utils/antigravityVersion.ts`
- Sentry (si esta habilitado) via DSN de entorno.
- Referencias: `src/services/GoogleAPIService.ts`, `src/server/modules/proxy/clients/gemini.client.ts`, `src/utils/antigravityVersion.ts`, `src/instrument.ts`

Proxy upstream (salida corporativa)

- El cliente HTTP puede usar un proxy upstream si se define en config.
- Referencias: `src/services/GoogleAPIService.ts`, `src/server/modules/proxy/clients/gemini.client.ts`, `src/types/config.ts`

Variables de entorno relevantes

- `PROXY_INTERNAL_BASE_URLS` o `ANTIGRAVITY_INTERNAL_BASE_URLS` para overrides de endpoints internos.
- `PROXY_FALLBACK_PROJECT_ID` para resolver project id cuando no hay respuesta de cuotas.
- Referencias: `src/server/modules/proxy/request-user-agent.ts`, `src/server/modules/proxy/token-manager.service.ts`

