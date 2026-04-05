# Configuracion

Resumen: la configuracion principal se guarda en `gui_config.json` y se maneja con `ConfigManager`. El schema completo esta definido con Zod en `src/types/config.ts`. Hay settings generales de UI/operacion y un bloque amplio dedicado al proxy local.

## Ubicacion

Archivo:

- `gui_config.json`

Se guarda bajo `getAppDataDir()`, no dentro de `~/.antigravity-agent`.

## `AppConfig`

Campos de nivel alto:

- `language`
- `theme`
- `auto_refresh`
- `refresh_interval`
- `auto_sync`
- `sync_interval`
- `auto_startup`
- `error_reporting_enabled`
- `privacy_consent_asked`
- `default_export_path`
- `model_visibility`
- `provider_groupings_enabled`
- `grid_layout`
- `proxy`

## `ProxyConfig`

Campos observados:

- `enabled`
- `port`
- `api_key`
- `auto_start`
- `backend_canary_enabled`
- `parity_enabled`
- `parity_shadow_enabled`
- `parity_kill_switch`
- `parity_no_go_mismatch_rate`
- `parity_no_go_error_rate`
- `scheduling_mode`
- `max_wait_seconds`
- `preferred_account_id`
- `circuit_breaker_enabled`
- `circuit_breaker_backoff_steps`
- `custom_mapping`
- `anthropic_mapping`
- `request_timeout`
- `upstream_proxy.enabled`
- `upstream_proxy.url`

## Defaults relevantes

Segun `DEFAULT_APP_CONFIG`:

- `language: zh-CN`
- `theme: system`
- `auto_refresh: false`
- `auto_sync: false`
- `auto_startup: false`
- `error_reporting_enabled: true`
- `proxy.enabled: false`
- `proxy.port: 8045`
- `proxy.api_key: ''`
- `proxy.auto_start: false`
- `proxy.scheduling_mode: balance`

## Efecto operativo de settings importantes

- `proxy.enabled`
  Habilita el feature del proxy.
- `proxy.auto_start`
  Permite arrancarlo al iniciar la app.
- `proxy.port`
  Define el puerto del servicio NestJS.
- `proxy.api_key`
  Si esta vacia, el proxy no exige autenticacion.
- `proxy.upstream_proxy`
  Encamina salidas HTTP por un proxy externo.
- `proxy.custom_mapping` / `proxy.anthropic_mapping`
  Ajustan la traduccion de modelos.
- `error_reporting_enabled`
  Habilita Sentry si el resto de prerequisitos existe.
- `auto_startup`
  Sincroniza login item / auto-start del sistema.

## Observacion sobre settings aparentemente no cableados del todo

Detecte `auto_refresh`, `refresh_interval`, `auto_sync` y `sync_interval` en schema y UI, pero no encontre un timer equivalente claramente conectado a esas opciones en los servicios principales actuales.

Lo que si existe:

- `CloudMonitorService` hace polling cada 5 minutos con constante interna
- `AutoSwitchService` depende de `auto_switch_enabled` guardado en la tabla `settings` de la DB cloud

Interpretacion practica:

- esos toggles existen en la experiencia de usuario
- pero pueden estar incompletos, reservados para futuras extensiones o parcialmente desconectados del runtime actual

## Hallazgo de consistencia

- `config.saveConfig` propaga `setServerConfig(config.proxy)`
- `gateway.generateKey` modifica el archivo pero no invoca `setServerConfig`

Consecuencia:

- la API key regenerada puede no aplicarse al proxy ya corriendo hasta otro guardado o reinicio del servidor

## Referencias de codigo

- `src/ipc/config/manager.ts`
- `src/ipc/config/router.ts`
- `src/ipc/gateway/handlers.ts`
- `src/server/server-config.ts`
- `src/types/config.ts`
- `src/routes/settings.tsx`
- `src/utils/autoStart.ts`
