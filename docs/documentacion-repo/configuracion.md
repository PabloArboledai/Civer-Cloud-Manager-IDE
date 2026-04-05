# Configuracion

Resumen: la configuracion de la UI y del proxy se guarda en `gui_config.json` dentro del directorio de datos de la app. Incluye puerto del proxy, api key, reglas de mapeo y ajustes de upstream proxy.

Archivo de config:
- `gui_config.json` en el directorio `appData`.

Campos relevantes:
- `proxy_enabled`, `proxy_port`, `api_key`
- `proxy_upstream_*` para proxy saliente
- `proxy_request_timeout`
- `proxy_model_mapping` y reglas de forwarding
- `proxy_parity_*` para shadow compare
- `auto_switch` para el monitor de cuentas

Efectos principales:
- `proxy_enabled` decide si se arranca NestJS al inicio.
- `proxy_port` controla el puerto local del gateway.
- `api_key` habilita auth del proxy por header.
- `proxy_upstream_*` redirige trafico HTTP por un proxy externo.
- `proxy_model_mapping` cambia el mapeo de modelos.
- `proxy_parity_*` activa comparaciones de respuestas.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\config\manager.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\types\config.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\paths.ts`
