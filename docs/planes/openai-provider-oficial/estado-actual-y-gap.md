# Estado actual y gap de implementación

## Lo reutilizable del repo

- **Scheduler y rotación base** ya existen en `src/server/modules/proxy/token-manager.service.ts`.
- **Persistencia cifrada** ya existe en `src/ipc/database/cloudHandler.ts`.
- **Proxy OpenAI-compatible** ya existe a nivel de superficie HTTP en `src/server/modules/proxy/proxy.controller.ts`.
- **Panel Codex** ya detecta instalación y estado local desde `~/.codex`.

## Bloqueos concretos

### 1. Modelo de datos

- `CloudAccount` solo soporta `google | anthropic`.
- La forma actual de `token` está orientada a OAuth Google, no a API keys/proyectos OpenAI.
- La forma actual de `quota` está orientada a cuotas por modelo tipo Gemini.

### 2. Auth y Codex

- El login Codex actual solo ejecuta `codex login`.
- El analizador de callback OpenAI/Codex es diagnóstico, no persistencia.
- No existe listener local OpenAI/Codex equivalente al servidor Google `localhost:8888`.

### 3. Proxy backend

- El proxy externo acepta contratos OpenAI/Anthropic/Gemini.
- El backend real actual traduce hacia Gemini/Claude; no hay cliente OpenAI oficial detrás.

### 4. Usage / saldo

- El repo actual trabaja con “quota” técnica, no con saldo financiero API OpenAI.
- Para OpenAI API la señal útil debe venir de:
  - usage/cost/budget por proyecto o cuenta
  - health/rate-limit/error rate
  - disponibilidad operacional real

### 5. Rotación transparente

- Solo es viable para clientes que consuman el **proxy local**.
- No es viable para extensiones/herramientas que usen directamente sus propios tokens/API keys sin pasar por Antigravity.

## Decisión operativa

- Separar el nuevo dominio como **OpenAIProviderCredential** o equivalente.
- No mezclarlo dentro de `CloudAccount`.
- Reusar infraestructura de cifrado, scheduler y proxy, pero con un backend/provider OpenAI nuevo y un store separado.

