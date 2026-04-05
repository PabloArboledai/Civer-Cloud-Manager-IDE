# Documentacion canonica del repo

Esta carpeta es la referencia canonica de funcionamiento interno de `AntigravityManager`.

Objetivo:
- explicar como arranca y opera la app
- documentar el stack, almacenamiento, auth, tokens, cuotas, switching, proxy y CLI
- dejar un mapa reutilizable para humanos y agentes
- registrar hallazgos tecnicos y riesgos reales encontrados en el codigo

Alcance de esta investigacion:
- inspeccion estatica de codigo y configuracion del repo en el workspace actual
- no se ejecuto `node` ni `npm` porque no estan disponibles en el `PATH` de esta maquina
- la fecha de lectura de esta documentacion es `2026-04-05`

Mapa de lectura recomendado:
- `docs/documentacion-repo/arquitectura.md`
- `docs/documentacion-repo/stack-y-dependencias.md`
- `docs/documentacion-repo/flujo-ejecucion.md`
- `docs/documentacion-repo/ipc-orpc-y-api-interna.md`
- `docs/documentacion-repo/autenticacion-y-tokens.md`
- `docs/documentacion-repo/almacenamiento-y-datos.md`
- `docs/documentacion-repo/dispositivo-identidad.md`
- `docs/documentacion-repo/switching-y-monitoreo.md`
- `docs/documentacion-repo/proxy-gateway.md`
- `docs/documentacion-repo/saldos-y-modelos.md`
- `docs/documentacion-repo/llamadas-externas.md`
- `docs/documentacion-repo/procesos-y-tray.md`
- `docs/documentacion-repo/ui-rutas.md`
- `docs/documentacion-repo/configuracion.md`
- `docs/documentacion-repo/seguridad.md`
- `docs/documentacion-repo/observabilidad.md`
- `docs/documentacion-repo/cli.md`
- `docs/documentacion-repo/build-test-release.md`
- `docs/documentacion-repo/automatizacion-y-backup.md`
- `docs/documentacion-repo/hallazgos-y-riesgos.md`

Lectura rapida del sistema:

```plaintext
Renderer React
  -> ORPC sobre MessagePort
Electron Main
  -> CloudAccountRepo + SQLite local + archivos JSON
  -> control del IDE Antigravity
  -> AuthServer local OAuth
  -> CloudMonitorService + tray + auto start
  -> servidor NestJS embebido
NestJS Proxy
  -> TokenManagerService
  -> GeminiClient / Google internal APIs / Gemini public API
CLI Python
  -> lee la misma DB local y puede inyectar tokens al IDE
```

Preguntas que responde esta carpeta:
- donde vive cada dato y quien lo escribe
- como se autentican las cuentas y como se refrescan
- como se inyectan tokens en el IDE y como cambia el formato segun version
- como decide el proxy que cuenta usar
- que endpoints externos toca el sistema
- que piezas son estables y cuales tienen deuda o riesgo

Hallazgos mas importantes:
- el CLI Python y la app TS no usan la misma unidad temporal para `expiry_timestamp`
- el flujo OAuth usa `localhost:8888` fijo y no envia `state`
- `gateway.generateKey` guarda la nueva API key en disco pero no refresca el `serverConfig` en memoria
- el menu del tray marca otra cuenta como activa pero no ejecuta el switch real en el IDE
- el proxy queda abierto si `api_key` esta vacia

Referencias base:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\package.json`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\main.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\router.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\database\cloudHandler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\services\GoogleAPIService.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\modules\proxy\proxy.service.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\cli\core.py`
