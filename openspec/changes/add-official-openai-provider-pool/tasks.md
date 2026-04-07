## 1. Scope and Planning Confirmation

- [ ] 1.1 Confirm this change targets official OpenAI API credentials, not browser session capture.
- [ ] 1.2 Confirm Codex local login remains a separate diagnostics capability.
- [ ] 1.3 Confirm proxy-based rotation is the only supported transparent failover path.

## 2. Domain and Persistence

- [ ] 2.1 Add a dedicated OpenAI provider credential type and validation schema.
- [ ] 2.2 Add encrypted persistence for OpenAI provider credentials and state snapshots.
- [ ] 2.3 Add CRUD handlers and renderer actions for provider management.

## 3. Provider State and Health

- [ ] 3.1 Add a service to refresh usage/cost/budget/health state from official OpenAI APIs.
- [ ] 3.2 Normalize provider state for scheduling decisions.
- [ ] 3.3 Add failure classification for auth, rate-limit, budget, and transient errors.

## 4. Proxy and Scheduling

- [ ] 4.1 Add a real OpenAI backend/client behind the local proxy.
- [ ] 4.2 Add scheduler selection/failover across multiple OpenAI credentials.
- [ ] 4.3 Preserve sticky-session semantics where possible.
- [ ] 4.4 Ensure current Google/Gemini behavior does not regress.

## 5. UI and Operator Experience

- [ ] 5.1 Add a management surface for official OpenAI API credentials.
- [ ] 5.2 Show usage/cost/health state in UI.
- [ ] 5.3 Explain proxy-based rotation and out-of-scope direct-client behavior.

## 6. Verification

- [ ] 6.1 Unit test encrypted persistence and schema validation.
- [ ] 6.2 Unit test scheduler failover and cooldown logic.
- [ ] 6.3 Integration test proxy requests against OpenAI backend abstraction.
- [ ] 6.4 Manual test with 2+ credentials through the local proxy.

