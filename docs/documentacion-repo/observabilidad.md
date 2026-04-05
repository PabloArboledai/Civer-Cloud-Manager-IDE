# Observabilidad y logging

Resumen: el repo tiene una capa de observabilidad razonable para una app desktop. Usa logs rotados, packet logging ORPC, eventos de debug estructurados y Sentry opcional. Tambien intenta enmascarar datos sensibles antes de escribirlos.

## Logging principal

`src/utils/logger.ts` monta:

- `winston`
- `winston-daily-rotate-file`
- rotacion diaria
- retention aproximada de 30 dias
- limite por archivo de alrededor de 10 MB

Archivos observados:

- `~/.antigravity-agent/app-%DATE%.log`
- `~/.antigravity-agent/.app-log-audit.json`

## Packet log ORPC

`src/main.ts` escribe paquetes ORPC en:

- `app.getPath('userData')/orpc_packets.log`

Antes de loguearlos pasa por `safeStringifyPacket()` para evitar exposicion directa de secretos.

## Debug estructurado

El repo usa helpers de debug para eventos uniformes:

- `createDebugEvent`
- `formatDebugEvent`
- `emitRendererDebug`

Esto aparece en:

- eventos renderer -> main
- trazas ORPC request/response/error
- heartbeat del proceso principal en desarrollo

## Sentry

Se inicializa de forma condicional:

- `src/instrument.ts` en main
- `src/preload.ts` y `src/renderer.ts` para el lado renderer

Condiciones:

- `error_reporting_enabled` en config
- entorno de produccion
- variables/env de Sentry presentes

## Otras capacidades utiles

- `system.openLogDirectory`
  Abre la carpeta de logs.
- `system.get_local_ips`
  Expone IPs locales.
- logs de `console-message` del renderer terminan en el logger del main.
- `render-process-gone`, `did-fail-load` y `child-process-gone` tambien se registran.

## Proteccion de datos en observabilidad

Se observo masking para:

- tokens
- API keys
- secretos conocidos
- paquetes ORPC sensibles

Esto reduce riesgo, aunque siempre conviene revisar que nuevos campos sensibles pasen por las mismas utilidades.

## Observaciones utiles

- Hay bastante instrumentacion para depurar problemas de arranque y transporte IPC.
- El packet log ORPC puede ser muy valioso en soporte, pero sigue siendo un artefacto sensible aunque se enmascare.
- Los logs recientes se mantienen tambien en memoria para adjuntarlos a reportes de error.

## Referencias de codigo

- `src/utils/logger.ts`
- `src/utils/debug.ts`
- `src/utils/sensitiveDataMasking.ts`
- `src/utils/rendererDebug.ts`
- `src/instrument.ts`
- `src/preload.ts`
- `src/renderer.ts`
- `src/main.ts`
- `src/ipc/system/handler.ts`
