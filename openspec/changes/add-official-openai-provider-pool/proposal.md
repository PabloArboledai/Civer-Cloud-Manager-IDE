# Change: Add Official OpenAI Provider Pool

## Why

- The current product has Google-centric cloud account management and a local Codex diagnostics panel, but it does not support official multi-credential OpenAI API routing.
- Users need OpenAI-compatible proxy access with credential rotation, health-aware failover, and observable usage status.
- Reusing browser callbacks or consumer ChatGPT/Codex sessions as generic API credentials is not a safe or supportable foundation.

## What Changes

- Add a separate encrypted store for official OpenAI API credentials and project metadata.
- Add provider status tracking for usage/cost/budget/health/error-rate.
- Add an OpenAI backend behind the existing local proxy surface.
- Add scheduling and failover across multiple OpenAI credentials.
- Add UI to manage official OpenAI API credentials and explain proxy-based rotation behavior.
- Keep Codex local-environment diagnostics separate from the OpenAI API credential pool.

## Constraints

- Do not repurpose consumer ChatGPT/Codex browser sessions as the primary credential strategy.
- Do not fold OpenAI API credentials into `CloudAccount`.
- Do not promise transparent rotation for clients that bypass the local proxy.

## Impact

- Affected specs: `openai-provider-pool`
- Affected code:
  - `src/server/modules/proxy/*`
  - `src/ipc/database/*`
  - `src/routes/*`
  - `src/types/*`

## Risks

- Cross-provider scheduling refactors may destabilize current Google/Gemini behavior.
- Usage/cost semantics differ from current quota semantics and require a new normalized status model.
- Proxy compatibility must be preserved while introducing a real OpenAI backend.

