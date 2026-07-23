# Proxy y gateway interno

Resumen: el repo embebe un servidor NestJS/Fastify que actua como proxy local compatible con varias superficies API. El proxy no autentica contra una cuenta propia del servidor; reutiliza el pool de cuentas Google guardado por el manager y selecciona la mejor credencial disponible para cada request.

## Arranque del servidor

`src/server/main.ts`:

- crea Nest con `FastifyAdapter`
- habilita CORS
- escucha en `0.0.0.0`
- devuelve estado con `running`, `port`, `base_url` y `active_accounts`

El arranque puede venir de:

- `src/main.ts` al iniciar la app si la config lo indica
- `gateway.start` via ORPC

## Control desde IPC

`src/ipc/gateway/handlers.ts` permite:

- iniciar gateway
- detener gateway
- consultar estado
- generar nueva API key

La API key generada sigue el patron:

- `sk-<uuid sin guiones>`

## Modulo y piezas internas

En `src/server/modules/proxy/` destacan:

- `proxy.module.ts`
- `proxy.controller.ts`
- `gemini.controller.ts`
- `proxy.service.ts`
- `token-manager.service.ts`
- `rate-limit-tracker.ts`
- `proxy.guard.ts`
- `clients/gemini.client.ts`

## Autenticacion del proxy

El guard acepta:

- `Authorization: Bearer <api_key>`
- `x-api-key`
- `x-goog-api-key`

Si no existe `config.proxy.api_key`, `ProxyGuard` deja pasar la request.

Esto significa:

- el proxy puede operar en modo protegido
- o quedar totalmente abierto si la clave esta vacia

## Superficies HTTP expuestas

`ProxyController`:

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/completions`
- `POST /v1/responses`
- `POST /v1/messages`
- `POST /v1/images/generations`
- `POST /v1/images/edits`
- `POST /v1/audio/transcriptions`

`GeminiController`:

- `GET /v1beta/models`
- `GET /v1beta/models/:model`
- `POST /v1beta/models/:modelAction`
- `POST /v1beta/models/:model/countTokens`

## Scheduling y seleccion de cuenta

`TokenManagerService`:

- carga cuentas cloud desde `CloudAccountRepo`
- mantiene cache en memoria
- refresca tokens vencidos o por vencer
- resuelve `project_id`
- soporta sticky sessions con TTL de 10 minutos
- lleva cooldowns por cuenta/modelo
- usa `RateLimitTracker`

Modos de scheduling:

- `cache-first`
- `balance`
- `performance-first`

Tambien soporta:

- parity scheduling
- parity shadow compare
- no-go thresholds por mismatch/error rate

## Cuotas, rate limits y fallback de proyecto

El proxy usa las cuotas cloud para decidir que cuenta servir.

Detalles importantes:

- bloqueos por cuota y `Retry-After`
- lockouts precisos por modelo cuando es posible
- fallback de `project_id` a `silver-orbit-5m7qc` si no se resuelve uno valido

Ese fallback es una observacion importante porque introduce comportamiento implicito cuando la cuenta no trae proyecto usable.

## Model mapping y compatibilidad de protocolos

`src/lib/antigravity/ModelMapping.ts` y archivos vecinos:

- mapean nombres tipo GPT/Claude/Gemini a modelos internos
- aceptan `custom_mapping`
- aceptan `anthropic_mapping`
- aplican forwarding rules dinamicas provenientes de cuotas/modelos deprecados

El proxy actua como capa de traduccion entre:

- clientes OpenAI
- clientes Anthropic
- endpoints Gemini/Cloud Code subyacentes

## Streaming y normalizacion

`proxy.service.ts` implementa:

- streaming SSE
- synthetic streaming cuando hace falta
- traduccion de tool calls
- soporte de imagen/audio
- adaptacion de request/response a los contratos esperados por el cliente

## Salida HTTP real

`GeminiClient` habla con:

- `generativelanguage.googleapis.com`
- `cloudcode-pa.googleapis.com`
- `daily-cloudcode-pa.googleapis.com`

Ademas puede:

- hacer failover entre endpoints internos
- usar `upstream_proxy_url` por cuenta o por config global

## Referencias de codigo

- `src/server/main.ts`
- `src/server/server-config.ts`
- `src/ipc/gateway/handlers.ts`
- `src/ipc/gateway/router.ts`
- `src/server/modules/proxy/proxy.module.ts`
- `src/server/modules/proxy/proxy.controller.ts`
- `src/server/modules/proxy/gemini.controller.ts`
- `src/server/modules/proxy/proxy.guard.ts`
- `src/server/modules/proxy/proxy.service.ts`
- `src/server/modules/proxy/token-manager.service.ts`
- `src/server/modules/proxy/rate-limit-tracker.ts`
- `src/server/modules/proxy/clients/gemini.client.ts`
- `src/lib/antigravity/ModelMapping.ts`
