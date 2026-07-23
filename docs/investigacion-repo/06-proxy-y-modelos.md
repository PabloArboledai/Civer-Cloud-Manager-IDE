# Proxy y Modelos

## Servidor proxy (NestJS)

El servidor NestJS se inicia desde Electron y escucha en el puerto configurado. Referencias: `src/server/server.ts`, `src/services/ConfigManager.ts`.

Endpoints principales:
- OpenAI compatible (prefijo `/v1`):
  - `GET /models`
  - `POST /chat/completions`
  - `POST /completions`
  - `POST /responses`
  - `POST /images/generations`
  - `POST /images/edits`
  - `POST /audio/transcriptions`
  - `POST /messages` (Anthropic)
  Referencia: `src/server/proxy/proxy.controller.ts`.
- Gemini compatible (prefijo `/v1beta`):
  - `GET /models`
  - `GET /models/:model`
  - `POST /models/:modelAction`
  - `POST /models/:model/countTokens`
  Referencia: `src/server/proxy/gemini.controller.ts`.

## Autenticacion del proxy

La API key se verifica via `Authorization: Bearer` o headers `x-api-key` / `x-goog-api-key`. Si no hay `api_key` configurada, el proxy queda abierto. Referencia: `src/server/proxy/proxy.guard.ts`.

## Seleccion de tokens y cuotas

El TokenManager:
- carga cuentas activas desde DB,
- selecciona cuenta segun estrategia legacy o parity,
- evita cuentas rate-limited,
- refresca tokens cerca del vencimiento,
- actualiza limites de modelos segun cuotas.
Referencias: `src/server/proxy/token-manager.service.ts`, `src/server/proxy/rate-limit-tracker.ts`.

## Mapeo de modelos

Se soporta:
- Mapeo Claude -> Gemini y reglas dinamicas.
- Reglas custom y wildcard.
Referencias: `src/lib/antigravity/ModelMapping.ts`, `src/lib/antigravity/ModelSpecs.ts`, `src/lib/antigravity/model-specs.json`.

## Cliente Gemini

El cliente proxy llama endpoints internos y publicos:
- `https://generativelanguage.googleapis.com/v1beta`
- `https://cloudcode-pa.googleapis.com/v1internal`
- `https://daily-cloudcode-pa.googleapis.com/v1internal`
Referencias: `src/server/proxy/gemini.client.ts`.
