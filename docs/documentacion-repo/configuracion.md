# Configuracion

Resumen:
- la config de app vive en `gui_config.json`
- el estado de auto switch vive aparte en la tabla `settings` de `cloud_accounts.db`
- el proxy Nest consume una copia en memoria llamada `serverConfig`

Archivo principal:
- ruta:
  `getAppDataDir()/gui_config.json`
- en Windows normal:
  `C:\Users\<usuario>\AppData\Roaming\Antigravity\gui_config.json`

Campos de `AppConfig`:
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

Campos importantes de `proxy`:
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

Como se carga:
- `ConfigManager.loadConfig()`:
  lee JSON, mezcla defaults y hace merge profundo de `proxy.upstream_proxy`.
- `ConfigManager` mantiene cache de la config cargada.

Como se guarda:
- `ConfigManager.saveConfig()` serializa JSON y actualiza cache.
- `src/ipc/config/handlers.ts` es la via correcta desde UI:
  guarda en disco, actualiza `serverConfig`, ajusta Sentry y sincroniza auto start.

Fuentes de config que NO son el mismo archivo:
- `CloudAccountRepo.getSetting/setSetting`:
  guarda pares clave/valor JSON en `cloud_accounts.db`.
- hoy se usa ahi, por ejemplo:
  `auto_switch_enabled`

Efectos operativos de cambios relevantes:
- `proxy.port`:
  afecta el proximo arranque manual o automatico del gateway.
- `proxy.request_timeout`:
  lo usa `GeminiClient` para requests internos.
- `proxy.api_key`:
  lo valida `ProxyGuard` contra `serverConfig`.
- `proxy.upstream_proxy`:
  cambia salida HTTP de `GoogleAPIService` y `GeminiClient`.
- `auto_startup`:
  pasa por `syncAutoStart`.
- `error_reporting_enabled`:
  cambia el logger y la inicializacion de Sentry.

Hallazgo de consistencia:
- `config.saveConfig` propaga `setServerConfig(config.proxy)`.
- `gateway.generateKey` modifica el archivo pero no invoca `setServerConfig`.
- consecuencia:
  la API key regenerada puede no aplicarse al proxy ya corriendo hasta otra llamada de guardado o reinicio del servidor.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\types\config.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\config\manager.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\config\handlers.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\gateway\handlers.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\server-config.ts`
