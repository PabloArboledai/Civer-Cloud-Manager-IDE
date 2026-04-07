## Context

- The repo already contains:
  - encrypted secret persistence,
  - a local OpenAI-compatible proxy surface,
  - token scheduling and cooldown logic,
  - a separate Codex diagnostics panel.
- The repo does not contain:
  - an official OpenAI API credential pool,
  - a real OpenAI backend provider,
  - normalized usage/cost/budget state,
  - automatic failover across OpenAI credentials.

## Goals / Non-Goals

- Goals:
  - Support multiple official OpenAI API credentials.
  - Provide proxy-based request routing and failover.
  - Surface usage/cost/health information in UI and scheduler state.
  - Preserve current Google/Gemini and Codex-local behavior.

- Non-Goals:
  - Building a browser-token capture flow for ChatGPT consumer auth.
  - Turning local ChatGPT/Codex sessions into universal API credentials.
  - Transparent credential swapping for tools that do not use the proxy.

## Decisions

- Decision: Create a new provider domain separate from `CloudAccount`.
- Decision: Keep Codex local login/status as diagnostics only.
- Decision: Reuse the existing proxy entrypoints and local API key guard.
- Decision: Add a real OpenAI backend/client behind the proxy.
- Decision: Normalize OpenAI status around usage/cost/budget/health instead of Gemini-style quota.

## Architecture

### Domain model

- Add a dedicated credential entity such as `OpenAIProviderCredential`.
- Store:
  - encrypted API key,
  - label,
  - organization/project metadata,
  - enabled/disabled state,
  - budget/usage snapshot,
  - health/rate-limit state,
  - last-used / last-error / cooldown metadata.

### Persistence

- Reuse the encrypted SQLite/JSON persistence patterns already used for cloud accounts.
- Keep OpenAI provider persistence isolated from Google/Anthropic account tables or logical stores.

### Provider state

- Introduce a service that refreshes usage/cost/budget/health using official OpenAI APIs where available.
- Maintain a normalized scheduler-ready snapshot independent from request payload schemas.

### Proxy integration

- Preserve current public proxy contract.
- Add OpenAI backend selection logic behind the proxy service.
- Route each incoming request to a selected OpenAI credential through the scheduler.

### Scheduling

- Reuse current cooldown, sticky-session, and failover concepts.
- Extend selection rules to account for:
  - hard auth failures,
  - rate-limit failures,
  - usage/budget exhaustion,
  - manual disablement,
  - recent error rate.

### UI

- Add a dedicated management surface for official OpenAI API credentials.
- Explicitly explain:
  - Codex local login is separate,
  - proxy use is required for seamless rotation,
  - direct clients outside the proxy are out of scope.

## Migration Plan

1. Add data model and encrypted persistence.
2. Add provider-state refresh service.
3. Add proxy backend and scheduler integration.
4. Add UI and operator flows.
5. Add tests and runtime verification.

## Open Questions

- Confirm which official usage/cost/budget endpoints are available to the target OpenAI account model and keys.
- Decide whether the scheduler should be multi-provider generic or OpenAI-provider specific in v1.

