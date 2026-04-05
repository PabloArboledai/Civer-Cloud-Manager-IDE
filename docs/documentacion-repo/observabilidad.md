# Observabilidad y logging

Resumen:
- el repo tiene logging bastante trabajado para una app desktop
- usa `winston` con rotacion diaria
- puede integrar Sentry en main y renderer
- ademas persiste paquetes ORPC sanitizados y eventos de debug

Logger principal:
- archivo:
  `src/utils/logger.ts`
- niveles:
  `info`, `warn`, `error`, `debug`
- salidas:
  consola
  archivo rotado `app-%DATE%.log`

Retencion:
- `30d`
- maximo por archivo:
  `10m`

Directorio de logs:
- `getAgentDir()`
- tipicamente:
  `~/.antigravity-agent`

Buffer de logs recientes:
- el logger guarda una ventana de `30s` y hasta `200` entradas en memoria
- se usa para enriquecer eventos enviados a Sentry

Sentry:
- `src/instrument.ts` inicializa Sentry en main
- `src/renderer.ts` puede inicializar Sentry en renderer
- depende de `error_reporting_enabled` y `SENTRY_DSN`

ORPC y debug:
- `src/main.ts` escribe `orpc_packets.log` en `app.getPath('userData')`
- los paquetes se serializan con `safeStringifyPacket()`
- `src/ipc/router.ts` loguea inicio, exito y error de cada request ORPC
- `src/ipc/manager.ts` mantiene `ipcDebugState`
- en desarrollo hay heartbeat periodico del proceso main con memoria y estado de ventana

Proteccion de datos:
- `sanitizeObject()` recorre objetos y limpia secretos conocidos
- `instrument.ts` recorta rutas locales en Sentry

Superficies observables desde UI:
- `system.openLogDirectory()`
- boton de apertura de logs en settings

Limitaciones:
- aunque hay sanitizacion, `orpc_packets.log` sigue siendo un punto sensible porque registra payloads internos.
- no se aprecia un sistema de metricas remoto aparte de Sentry y logs.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\logger.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\sensitiveDataMasking.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\instrument.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\main.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\router.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\manager.ts`
