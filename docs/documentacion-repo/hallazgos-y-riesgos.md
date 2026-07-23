# Hallazgos y riesgos

Resumen:
- esta seccion resume los hallazgos mas utiles para mantenimiento, hardening y debugging
- estan ordenados por impacto practico, no por severidad formal de seguridad

1. El tray no ejecuta el switch cloud real
- modulo:
  `src/ipc/tray/handler.ts`
- hoy `switch_next` solo llama `CloudAccountRepo.setActive(next.id)`.
- no inyecta token, no aplica identidad, no reinicia el IDE.
- efecto:
  puede quedar una "cuenta activa" visual distinta de la cuenta realmente cargada en Antigravity IDE.

2. El CLI y la app TS no coinciden en `expiry_timestamp`
- modulos:
  `cli/core.py`
  `src/ipc/cloud/handler.ts`
  `src/services/CloudMonitorService.ts`
- la GUI usa segundos.
- el CLI trata el valor como milisegundos y lo reescribe asi.
- efecto:
  refreshes erraticos, expiraciones mal interpretadas y mezcla de estados entre herramientas.

3. El OAuth no usa `state` y depende de puerto fijo
- modulos:
  `src/ipc/cloud/handler.ts`
  `src/ipc/cloud/authServer.ts`
  `src/services/GoogleAPIService.ts`
- la URL de auth se construye sin `state`.
- el callback local escucha en `localhost:8888`.
- efecto:
  endurecimiento insuficiente del flujo de auth y menor flexibilidad si el puerto esta ocupado.

4. Regenerar la API key no actualiza la config viva del proxy
- modulos:
  `src/ipc/gateway/handlers.ts`
  `src/ipc/config/handlers.ts`
  `src/server/server-config.ts`
- `generateApiKey()` guarda archivo pero no hace `setServerConfig()`.
- efecto:
  el proxy corriendo puede seguir validando contra la key anterior hasta nuevo guardado o reinicio.

5. El proxy puede quedar abierto a la red
- modulo:
  `src/server/modules/proxy/proxy.guard.ts`
- si `api_key` esta vacia, la auth se omite.
- el servidor escucha en `0.0.0.0`.
- efecto:
  exposicion accidental en red local o interfaces compartidas.

6. `nodeIntegration: true` en el renderer
- modulo:
  `src/main.ts`
- aunque `contextIsolation` esta activo, esta decision debilita la postura de seguridad Electron.

7. La heuristica de auto switch es muy simple
- modulo:
  `src/services/AutoSwitchService.ts`
- una cuenta se considera depletada si cualquier modelo baja de 5 por ciento.
- efecto:
  puede hacer rotaciones que no reflejan el mejor uso real de la cuenta.

8. Metricas de rollback poco conectadas al flujo real
- modulo:
  `src/ipc/switchMetrics.ts`
- `recordSwitchRollback()` existe, pero no se observa integrado al flujo principal.
- efecto:
  visibilidad incompleta de recuperaciones y fallos de rollback.

9. Cobertura de validacion parcial
- archivos:
  `vitest.config.mjs`
  `.github/workflows/testing.yaml`
- CI corre unit tests, no E2E.
- los tests mockean modulos nativos.
- existe al menos un test fuera del glob principal.

10. Auto backup puede subir trabajo no revisado
- modulo:
  `scripts/auto-backup.mjs`
- tras 5 minutos de silencio hace `git add -A`, commit y push.
- efecto:
  muy util como red de seguridad, pero peligroso como automatismo si el arbol contiene cambios experimentales o sensibles.

11. Notas menores de consistencia
- `DEFAULT_APP_CONFIG.error_reporting_enabled` esta en `true` aunque el comentario dice otra cosa.
- hay multiples carpetas de investigacion previas en `docs/`, pero esta carpeta se propone como la canonica.

Validacion ejecutable:
- no se pudo correr `node` ni `npm` en esta maquina, asi que estos hallazgos salen de lectura estatica y de relaciones internas de codigo.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\tray\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\gateway\handlers.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\modules\proxy\proxy.guard.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\main.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\services\AutoSwitchService.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\cli\core.py`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\scripts\auto-backup.mjs`
