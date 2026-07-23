# Plan de fases y reparto para agentes

## Objetivo

Permitir trabajo paralelo sin choques de ownership para construir soporte oficial OpenAI API multi-credencial.

## Fase 0 — decisiones bloqueantes

- Mantener `Codex` como panel separado de diagnóstico local.
- Implementar **OpenAI API oficial**, no captura de sesión ChatGPT/Codex.
- La rotación automática solo se promete para clientes que usen el proxy local.

## Fase 1 — dominio y persistencia

### Ownership sugerido

- `src/types/*`
- `src/ipc/database/*`
- `src/ipc/openai/*` nuevo

### Entregables

- Nuevo tipo persistente para credenciales OpenAI API
- Secretos cifrados
- Estado agregado de usage/cost/health
- Operaciones CRUD + validación

## Fase 2 — cliente OpenAI y estado

### Ownership sugerido

- `src/services/*`
- `src/server/modules/proxy/clients/*`

### Entregables

- Cliente OpenAI oficial para requests del proxy
- Servicio de refresh de usage/cost/budget
- Normalización de errores rate-limit / exhausted / auth / permission

## Fase 3 — scheduler y rotación

### Ownership sugerido

- `src/server/modules/proxy/token-manager.service.ts`
- `src/server/modules/proxy/*`

### Entregables

- Scheduler multi-provider o scheduler OpenAI dedicado
- Sticky sessions por cliente
- Cooldowns por credencial
- Rotación por budget/rate-limit/health

## Fase 4 — UI y experiencia

### Ownership sugerido

- `src/routes/*`
- `src/components/*`
- `src/actions/*`

### Entregables

- Nueva vista de credenciales OpenAI API
- Alta/edición/baja
- Estado de budget/salud
- Explicación explícita de límites:
  - Codex local != pool API oficial
  - rotación solo mediante proxy

## Fase 5 — pruebas y verificación

### Ownership sugerido

- `src/tests/unit/*`
- `src/tests/e2e/*`

### Entregables

- Tests de persistencia cifrada
- Tests de scheduling y failover
- Tests del proxy OpenAI backend
- Pruebas manuales guiadas con 2+ credenciales

## Secuencia mínima recomendada

1. Fase 1
2. Fase 2
3. Fase 3
4. Fase 4
5. Fase 5

## Riesgos a vigilar

- No guardar tokens/callbacks reales en fixtures, docs o logs.
- No romper el proxy Google/Gemini ya existente.
- No mezclar credenciales OpenAI API con cuentas Google/Anthropic actuales.

