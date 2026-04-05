# Proxy y gateway interno

Resumen: el servidor NestJS expone endpoints tipo OpenAI, Claude y Gemini. Autentica con API key local, selecciona cuenta via TokenManagerService y traduce solicitudes a APIs de Gemini. Tiene soporte para streaming y limitacion por cuota.

Arranque y control:
- El main arranca el servidor si esta habilitado en config.
- El gateway puede iniciar/detener y generar API key via IPC.

Auth del proxy:
- Header `Authorization: Bearer <api_key>` o `x-api-key` o `x-goog-api-key`.
- Si no hay `api_key` configurada, el proxy puede estar abierto.

Endpoints principales:
- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/completions`
- `POST /v1/responses`
- `POST /v1/images/generations`
- `POST /v1/images/edits`
- `POST /v1/audio/transcriptions`
- `POST /v1/messages` (Anthropic)
- `GET /v1beta/models`
- `POST /v1beta/models/:model:generateContent`
- `POST /v1beta/models/:model:streamGenerateContent`
- `POST /v1beta/models/:model:countTokens`

TokenManagerService:
- Cache de tokens por cuenta.
- Seleccion de cuenta por modo `cache-first`, `balance` o `performance-first`.
- Sticky sessions opcional.
- Rate limit tracker por modelo y cuenta.
- Soporte de shadow parity para comparar respuestas.

Mapping y compatibilidad:
- Se mapean modelos OpenAI y Claude a modelos Gemini internos.
- Hay reglas de mapeo personalizadas y reglas dinamicas por cuota.
- Se normalizan formatos de request y response para compatibilidad.

Streaming:
- Soporta streaming SSE para chat y Gemini.
- Hay adaptacion de chunks para endpoints OpenAI y Anthropic.

GeminiClient:
- Usa `generativelanguage.googleapis.com` y endpoints internos `cloudcode-pa`.
- Failover entre hosts internos.
- Respeta `upstream_proxy` si esta configurado.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\proxy\proxy.module.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\proxy\controllers\proxy.controller.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\proxy\controllers\gemini.controller.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\proxy\services\tokenManager.service.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\proxy\services\proxy.service.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\proxy\services\geminiClient.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\lib\antigravity\ModelMapping.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\lib\antigravity\ClaudeRequestMapper.ts`
