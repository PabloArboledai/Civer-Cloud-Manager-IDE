# Riesgos y hallazgos

Resumen: estos son los hallazgos mas importantes surgidos de la revision del repo. No todos son vulnerabilidades; varios son simplemente comportamientos implicitos, deuda tecnica o zonas donde otros agentes deberian tener especial cuidado.

## Hallazgos funcionales

- El sistema maneja cuotas por modelo, no balances financieros.
- Hay dos universos de cuentas:
  - snapshots locales del IDE
  - pool cloud cifrado del manager
- La UI principal da protagonismo al pool cloud; el subsistema local existe pero parece menos expuesto.

## Hallazgos de autenticacion

- La autenticacion primaria es Google OAuth.
- No hay sistema clasico de usuarios del producto.
- El flujo OAuth no incluye `state`.
- El callback local escucha en `localhost:8888`.

## Hallazgos de seguridad

- `CLIENT_SECRET` de Google esta hardcodeado.
- `nodeIntegration: true` convive con `contextIsolation: true`.
- El proxy escucha en `0.0.0.0`.
- Si `api_key` esta vacia, el proxy queda abierto.

## Hallazgos de comportamiento

- `CloudMonitorService` usa intervalos internos fijos de 5 minutos.
- Los toggles `auto_refresh` y `auto_sync` existen en schema/UI, pero no encontre timers claramente unidos a ellos en runtime.
- La accion del tray para "switch next" no ejecuta el switching completo del IDE; solo cambia `is_active` en la DB propia.
- `TokenManagerService` usa `silver-orbit-5m7qc` como fallback de proyecto.

## Hallazgos de mantenimiento

- El CLI Python duplica logica sensible del runtime TypeScript.
- El CLI tambien duplica credenciales OAuth y varias heuristicas de paths.
- Existen varias carpetas de documentacion parciales en `docs/`; esta carpeta se propone como referencia canonica para futuras investigaciones.

## Riesgos practicos para futuros cambios

- Cambiar switching sin revisar device identity puede romper el IDE aunque el token sea correcto.
- Cambiar auth sin revisar protobuf/unified token puede dejar el login visualmente "activo" pero funcionalmente roto.
- Cambiar proxy sin revisar `TokenManagerService` y `RateLimitTracker` puede degradar mucho la estabilidad.
- Cambiar paths sin revisar el CLI y los tests puede dejar componentes fuera de sincronizacion.

## Recomendaciones para otros agentes

- Antes de tocar auth, leer `autenticacion-y-tokens.md` y `almacenamiento-y-datos.md`.
- Antes de tocar switching, leer `flujo-ejecucion.md`, `dispositivo-identidad.md` y `switching-y-monitoreo.md`.
- Antes de tocar proxy, leer `proxy-gateway.md`, `configuracion.md` y `llamadas-externas.md`.
- Si hay que endurecer seguridad, empezar por `seguridad.md`.

## Referencias de codigo

- `src/main.ts`
- `src/services/GoogleAPIService.ts`
- `src/ipc/cloud/handler.ts`
- `src/ipc/tray/handler.ts`
- `src/services/CloudMonitorService.ts`
- `src/server/modules/proxy/token-manager.service.ts`
- `cli/core.py`
