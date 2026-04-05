# Arquitectura

Resumen: la app se divide en tres procesos Electron (main, preload, renderer) mas un servidor interno NestJS que actua como proxy/gateway. El renderer habla con main via ORPC (MessagePort). Main gestiona cuentas, tokens, estado local y arranque de servicios. El servidor proxy habla con APIs externas usando tokens gestionados por el main.

Componentes principales:
- Electron Main: orquesta ventanas, auth local, DB local, control del IDE externo, servicio de monitoreo y arranque del proxy.
- Electron Preload: expone API segura al renderer y prepara el canal ORPC.
- Renderer (React): UI para cuentas, proxy, configuracion y operaciones.
- NestJS Proxy: servidor HTTP interno con endpoints tipo OpenAI/Claude/Gemini.

Flujos de datos principales:
- Renderer -> ORPC -> Main para operaciones de cuentas, switching, config, proxy y device identity.
- Main -> SQLite local (cuentas y settings) con cifrado de tokens.
- Main -> IDE DB (state.vscdb) para inyectar tokens.
- Proxy -> TokenManagerService -> GeminiClient -> APIs externas.

Routers ORPC (alto nivel):
- `theme`, `window`, `app`, `database`, `proc`
- `account`, `cloud`, `config`, `gateway`, `system`

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\main.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\preload.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\renderer.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\router.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\app.module.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\proxy\proxy.module.ts`
