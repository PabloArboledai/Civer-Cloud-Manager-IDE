# Documentacion canonica del repo

Resumen: esta carpeta es la referencia principal para entender como funciona Antigravity Manager a nivel de arquitectura, stack, flujos, autenticacion, tokens, almacenamiento, proxy interno, llamadas externas, observabilidad, build y riesgos. Esta guia esta pensada para humanos y para otros agentes que necesiten incorporarse rapido al proyecto sin volver a recorrer todo el codigo desde cero.

## Que es este repo

Antigravity Manager es una aplicacion de escritorio en Electron que hace cuatro cosas grandes:

- Administra cuentas cloud de Google usadas por Antigravity.
- Lee y escribe el estado local del IDE Antigravity para cambiar credenciales activas.
- Expone un proxy HTTP local compatible con APIs tipo OpenAI, Anthropic y Gemini.
- Mantiene un sistema de monitoreo, auto-switch y perfiles de identidad de dispositivo.

No es una aplicacion web tradicional con backend remoto propio. La mayor parte del sistema vive localmente en el proceso principal de Electron, en el renderer React y en un servidor NestJS embebido dentro de la propia app.

## Como leer esta documentacion

- Empieza por `docs/documentacion-repo/stack-y-dependencias.md` si quieres una foto rapida del stack.
- Sigue por `docs/documentacion-repo/arquitectura.md` y `docs/documentacion-repo/flujo-ejecucion.md` si quieres entender el recorrido end-to-end.
- Lee `docs/documentacion-repo/autenticacion-y-tokens.md` y `docs/documentacion-repo/almacenamiento-y-datos.md` si necesitas tocar auth, cuotas, DB o cifrado.
- Ve a `docs/documentacion-repo/proxy-gateway.md` si vas a trabajar en el proxy local.
- Consulta `docs/documentacion-repo/riesgos-y-hallazgos.md` antes de tocar seguridad o comportamiento critico.

## Planes activos para agentes

- `docs/planes/README.md`
- `docs/planes/openai-provider-oficial/README.md`
- `openspec/changes/add-official-openai-provider-pool/proposal.md`

Si vas a trabajar en soporte OpenAI/Codex, consulta primero esos planes. Son la referencia operativa para coordinar trabajo paralelo.

## Mapa de archivos canonicos

- `docs/documentacion-repo/stack-y-dependencias.md`
  Panorama de runtime, librerias, scripts y tooling.
- `docs/documentacion-repo/arquitectura.md`
  Capas del sistema y relacion entre main, preload, renderer, IPC y servidor NestJS.
- `docs/documentacion-repo/flujo-ejecucion.md`
  Flujos principales de arranque, login, importacion, switching y proxy.
- `docs/documentacion-repo/ipc-y-orpc.md`
  Superficie ORPC/IPC y eventos raw entre renderer y main.
- `docs/documentacion-repo/ui-rutas.md`
  Rutas, componentes y hooks visibles en la UI.
- `docs/documentacion-repo/autenticacion-y-tokens.md`
  OAuth, tokens, cuotas, identificacion de tokens y escritura al IDE.
- `docs/documentacion-repo/almacenamiento-y-datos.md`
  Archivos, DBs, claves de SQLite, cifrado y persistencia.
- `docs/documentacion-repo/dispositivo-identidad.md`
  Sistema de huella de dispositivo e identidad persistente.
- `docs/documentacion-repo/switching-y-monitoreo.md`
  Monitor de cuotas, auto-switch, guardas, metricas y flujos de cambio.
- `docs/documentacion-repo/proxy-gateway.md`
  Proxy local NestJS, API key, model mapping y scheduling.
- `docs/documentacion-repo/llamadas-externas.md`
  Inventario de endpoints y salidas a red.
- `docs/documentacion-repo/configuracion.md`
  `gui_config.json`, opciones de proxy y observaciones sobre settings.
- `docs/documentacion-repo/observabilidad.md`
  Logs, Sentry, packet logging y trazas de debug.
- `docs/documentacion-repo/cli.md`
  CLI Python paralelo al producto Electron.
- `docs/documentacion-repo/build-test-y-release.md`
  Build, empaquetado, CI, release y publicacion.
- `docs/documentacion-repo/seguridad.md`
  Postura de seguridad observada en codigo.
- `docs/documentacion-repo/riesgos-y-hallazgos.md`
  Hallazgos accionables, ambiguedades y riesgos concretos.

Nota:

- Si ves otros archivos no listados arriba dentro de esta carpeta, tratalos como borradores o material heredado. La lista anterior es la referencia canonica mantenida por esta investigacion.

## Material complementario util

Estos archivos no son necesarios para seguir el mapa principal, pero contienen detalle adicional valioso:

- `docs/documentacion-repo/saldos-y-modelos.md`
  Profundiza en cuotas, modelos, forwarding y limites.
- `docs/documentacion-repo/procesos-y-tray.md`
  Explica control del proceso Antigravity, tray y auto-start.
- `docs/documentacion-repo/automatizacion-y-backup.md`
  Documenta el sistema de auto-backup Git/GitHub del repo.
- `docs/documentacion-repo/hallazgos-y-riesgos.md`
  Variante ampliada de hallazgos practicos y deuda tecnica.
- `docs/documentacion-repo/ipc-orpc-y-api-interna.md`
  Version alternativa/previa del mapa de IPC interno.
- `docs/documentacion-repo/build-test-release.md`
  Variante previa de la documentacion de build y release.

## Conclusiones rapidas

- El nucleo real del producto esta en `src/main.ts`, `src/ipc/database/cloudHandler.ts`, `src/services/GoogleAPIService.ts`, `src/server/modules/proxy/*` y `src/ipc/device/handler.ts`.
- La autenticacion principal es Google OAuth; no hay un sistema clasico de usuarios propios del producto.
- Los "saldos" que maneja el repo son cuotas por modelo y disponibilidad de cuenta, no balances financieros.
- El repo tiene buenas piezas de cifrado y masking, pero tambien varios riesgos practicos que conviene conocer antes de ampliar el sistema.

## Referencias de codigo base

- `src/main.ts`
- `src/preload.ts`
- `src/renderer.ts`
- `src/App.tsx`
- `src/ipc/router.ts`
- `src/ipc/database/cloudHandler.ts`
- `src/services/GoogleAPIService.ts`
- `src/server/main.ts`
- `src/server/modules/proxy/token-manager.service.ts`
- `src/ipc/device/handler.ts`
