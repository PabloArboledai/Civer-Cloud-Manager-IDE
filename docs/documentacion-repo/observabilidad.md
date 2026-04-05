# Observabilidad y logging

Resumen: la app registra logs con winston y rotacion diaria, y opcionalmente Sentry en main y renderer. Hay mascaras para datos sensibles.

Logging:
- Winston con `winston-daily-rotate-file`.
- Logs en el directorio del agente.
- Archivo adicional `orpc_packets.log` para trazas ORPC.

Archivos de log:
- `~/.antigravity-agent/app-YYYY-MM-DD.log`
- `~/.antigravity-agent/.app-log-audit.json`
- `AppData/Roaming/Antigravity/orpc_packets.log` (segun plataforma)

Sentry:
- Inicializacion en main y renderer si esta habilitado en config.
- Controlado por `gui_config.json`.

Proteccion de datos:
- Masking de tokens, api keys y secretos en logs.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\logger.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\instrument.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\sensitiveDataMasking.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\main.ts`
