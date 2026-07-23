## ADDED Requirements

### Requirement: The system shall manage a separate pool of official OpenAI API credentials

The system SHALL provide encrypted storage, CRUD operations, and operator-visible state for multiple official OpenAI API credentials without reusing the existing Google/Anthropic `CloudAccount` model.

#### Scenario: Add an OpenAI API credential

- **WHEN** an operator adds a valid official OpenAI API credential
- **THEN** the system stores it in an encrypted provider pool
- **AND** the credential appears as an independent OpenAI provider entry

#### Scenario: Disable a credential

- **WHEN** an operator disables an OpenAI provider credential
- **THEN** the scheduler excludes it from new request selection

### Requirement: The system shall expose OpenAI-compatible requests through the local proxy using official OpenAI credentials

The system SHALL preserve the local proxy contract while routing supported requests through a real OpenAI backend selected from the OpenAI provider pool.

#### Scenario: Request enters through the local proxy

- **WHEN** a client sends a supported OpenAI-compatible request to the local proxy
- **THEN** the system selects an eligible OpenAI provider credential
- **AND** forwards the request through the OpenAI backend

### Requirement: The system shall rotate OpenAI provider credentials based on health and budget state

The system SHALL avoid unhealthy or exhausted credentials and SHALL fail over to another eligible credential when the current credential becomes unavailable.

#### Scenario: Current credential enters rate limit

- **WHEN** the active credential returns a classified rate-limit failure
- **THEN** the scheduler places that credential in cooldown
- **AND** retries or routes the next eligible request through another credential when available

#### Scenario: Current credential budget is exhausted

- **WHEN** provider state indicates the credential is budget-exhausted
- **THEN** the scheduler excludes it from selection
- **AND** uses another eligible credential if one exists

### Requirement: The system shall keep Codex local auth diagnostics separate from the OpenAI API provider pool

The system SHALL treat local Codex auth state as an environment diagnostics capability and SHALL NOT rely on browser callback token capture as the primary credential source for the OpenAI provider pool.

#### Scenario: Operator opens Codex panel

- **WHEN** the operator opens the Codex panel
- **THEN** the system may show local installation and auth diagnostics
- **AND** the panel SHALL clearly distinguish this from the official OpenAI API provider pool

