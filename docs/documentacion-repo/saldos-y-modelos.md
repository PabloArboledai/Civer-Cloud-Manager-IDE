# Saldos, cuotas y modelos

Resumen:
- la nocion de "saldo" del repo es un conjunto de cuotas por modelo
- esas cuotas llegan desde `fetchAvailableModels`
- se guardan cifradas en `quota_json`
- alimentan UI, tray, auto switch, scheduling del proxy y routing dinamico

Forma de la cuota:
- `models: Record<string, CloudQuotaModelInfo>`
- `model_forwarding_rules`
- `subscription_tier`
- `is_forbidden`

Por cada modelo se puede tener:
- `percentage`
- `resetTime`
- `display_name`
- `supports_images`
- `supports_thinking`
- `thinking_budget`
- `recommended`
- `max_tokens`
- `max_output_tokens`
- `supported_mime_types`

Origen:
- `GoogleAPIService.fetchProjectContext()` intenta sacar `projectId` y `subscriptionTier`.
- `GoogleAPIService.fetchQuota()` llama `fetchAvailableModels`.
- si la respuesta trae `deprecatedModelIds`, se convierten a `model_forwarding_rules`.

Usos internos:
- UI:
  listado de cuentas y resumenes de cuota.
- tray:
  muestra lineas resumidas de Gemini High, Gemini Image y Claude.
- `AutoSwitchService`:
  decide si una cuenta esta depletada y cual es mejor candidata.
- `TokenManagerService`:
  extrae `model_quotas`, `model_limits`, `model_reset_times`, `model_forwarding_rules`.
- `ProxyService`:
  usa limits y thinking budgets para recortar requests.

Routing de modelos:
- `ModelMapping` contiene alias builtin para Claude, OpenAI y Gemini.
- `resolveModelRoute()` aplica prioridad sobre mappings custom, mappings de familia y forwarding dinamico.
- tambien se generan modelos dinamicos de imagen:
  `gemini-3-pro-image`
  variantes `-2k`, `-4k`
  ratios `-1x1`, `-4x3`, `-3x4`, `-16x9`, `-9x16`, `-21x9`

Thinking y output limits:
- `ModelSpecs` contiene caps y budgets por modelo.
- `TokenManagerService` puede sobrescribir con limites mas reales observados en la cuota de la cuenta.
- `ProxyService` ajusta `thinkingBudget` y `maxOutputTokens` para no romper restricciones del modelo/cuenta.

Suscripcion y project id:
- `subscription_tier` se intenta inferir desde `loadCodeAssist`.
- `project_id` ayuda a construir requests internos mas completos.
- si no se resuelve, el proxy puede usar un fallback `silver-orbit-5m7qc` o el valor de `PROXY_FALLBACK_PROJECT_ID`.

Observaciones:
- la UI y el tray presentan una vista simplificada de cuotas frente a la riqueza real del objeto.
- las reglas dinamicas de forwarding hacen que la lista de modelos pueda cambiar segun respuesta de Google.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\types\cloudAccount.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\services\GoogleAPIService.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\modules\proxy\token-manager.service.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\lib\antigravity\ModelMapping.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\lib\antigravity\ModelSpecs.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\lib\antigravity\model-specs.json`
