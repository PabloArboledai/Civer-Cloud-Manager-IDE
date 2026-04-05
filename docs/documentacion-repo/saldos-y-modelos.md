# Saldos, cuotas y modelos

Resumen: los saldos se representan como cuotas por modelo obtenidas desde el endpoint interno de Google. Estas cuotas se guardan en `quota_json` y alimentan el auto-switch, el rate limit y la lista de modelos del proxy.

Origen de cuotas:
- `fetchAvailableModels` devuelve un mapa de modelos y cuotas.
- Se actualiza periodicamente via CloudMonitorService y TokenManagerService.

Uso de cuotas:
- Auto-switch prioriza cuentas con cuota suficiente.
- TokenManagerService bloquea cuentas/modelos con rate limit.
- El proxy filtra o mapea modelos segun disponibilidad.

Modelos y mapeo:
- `ModelMapping` traduce nombres OpenAI/Claude a Gemini.
- `ModelSpecs` define limites de output y modos de pensamiento.
- Existe soporte para reglas dinamicas basadas en respuesta de cuota.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\services\GoogleAPIService.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\services\cloudMonitorService.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\proxy\services\tokenManager.service.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\lib\antigravity\ModelMapping.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\lib\antigravity\ModelSpecs.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\lib\antigravity\model-specs.ts`
