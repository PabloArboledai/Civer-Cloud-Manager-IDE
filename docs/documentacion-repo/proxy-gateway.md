# Proxy y gateway interno

Resumen:
- el proxy local es un NestJS embebido con Fastify
- se expone como API compatible con OpenAI, Anthropic y Gemini
- la eleccion de cuenta/token la hace `TokenManagerService`
- la traduccion de protocolos y respuestas la hace `ProxyService` junto con los mappers `lib/antigravity`

Arranque:
- `bootstrapNestServer(config.proxy)` en `src/server/main.ts`
- guarda una copia de la config en `serverConfig`
- escucha por defecto en `0.0.0.0:<port>`

Autenticacion del proxy:
- `Authorization: Bearer <api_key>`
- `x-api-key`
- `x-goog-api-key`
- si `api_key` no esta configurada:
  `ProxyGuard` permite el acceso y el proxy queda abierto

Endpoints `v1`:
- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/completions`
- `POST /v1/responses`
- `POST /v1/images/generations`
- `POST /v1/images/edits`
- `POST /v1/audio/transcriptions`
- `POST /v1/messages`

Endpoints `v1beta`:
- `GET /v1beta/models`
- `GET /v1beta/models/:model`
- `POST /v1beta/models/:model:generateContent`
- `POST /v1beta/models/:model:streamGenerateContent`
- `POST /v1beta/models/:model/countTokens`

Capas internas:

```plaintext
Controller
  -> ProxyService
     -> TokenManagerService
     -> ModelMapping / RequestMapper / ResponseMapper / StreamingMapper
     -> GeminiClient
```

Compatibilidad de protocolos:
- OpenAI:
  `chat/completions`, `completions`, `responses`, imagenes, transcripcion.
- Anthropic:
  `messages` con soporte de tools, thinking y streaming.
- Gemini:
  `generateContent`, `streamGenerateContent`, `countTokens`, lista de modelos.

Seleccion de cuenta en `TokenManagerService`:
- cachea cuentas cloud en memoria al iniciar el modulo
- mantiene `tokens`, `accountCooldowns` y `sessionBindings`
- soporta modos:
  `cache-first`
  `balance`
  `performance-first`
- soporta `preferred_account_id`
- soporta sticky session por `sessionKey` durante 10 minutos
- resuelve `project_id` y lo persiste si logra obtenerlo
- refresca access token si esta cerca de expirar

Manejo de limites:
- `RateLimitTracker` clasifica `quota_exhausted`, `rate_limit_exceeded`, `model_capacity_exhausted`, `server_error`
- se usan cooldowns por cuenta y bloqueos mas precisos por modelo cuando se puede deducir `resetTime`

Parity y rollout:
- flags:
  `parity_enabled`
  `parity_shadow_enabled`
  `parity_kill_switch`
- mantiene contadores de shadow mismatch y error rate
- puede auto bloquear la ruta parity si supera umbrales no-go

Mapeo de modelos:
- `ModelMapping.resolveModelRoute()` aplica prioridad:
  forwarding dinamico
  custom exact mapping
  family mapping OpenAI
  family mapping Anthropic
  fallback builtin
- tambien genera variantes dinamicas para `gemini-3-pro-image`

Mappers de request y response:
- `ClaudeRequestMapper` convierte requests estilo Claude/OpenAI a `GeminiInternalRequest`
- puede inyectar `googleSearch`, herramientas, thinking config, image config y system instruction
- `ClaudeResponseMapper` y `ClaudeStreamingMapper` convierten la respuesta Gemini a formato Claude y luego OpenAI donde haga falta

Upstream:
- `GeminiClient` usa:
  `generativelanguage.googleapis.com/v1beta`
  `cloudcode-pa.googleapis.com/v1internal`
  `daily-cloudcode-pa.googleapis.com/v1internal`
- tiene failover entre endpoints internos y timeout configurable por `request_timeout`

Observaciones y riesgos:
- `gateway.generateKey()` no refresca el `serverConfig` en memoria.
- `ProxyGuard` entra en modo abierto si la API key esta vacia.
- `serverConfig` es un singleton global en memoria, no una fuente reactiva.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\main.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\server-config.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\modules\proxy\proxy.guard.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\modules\proxy\proxy.controller.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\modules\proxy\gemini.controller.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\modules\proxy\proxy.service.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\modules\proxy\token-manager.service.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\modules\proxy\clients\gemini.client.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\lib\antigravity\ModelMapping.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\lib\antigravity\ClaudeRequestMapper.ts`
