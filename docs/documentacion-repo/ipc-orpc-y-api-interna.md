# IPC, ORPC y API interna

Resumen:
- el renderer no habla con Node directamente; usa un cliente ORPC montado sobre `MessagePort`
- la superficie de procedimientos vive en `src/ipc/router.ts`
- las operaciones mas sensibles corren en main: DB, switching, auth, control del IDE y gateway

Canal tecnico:
- `src/ipc/manager.ts` crea `port1/port2`.
- `port2` se envia al preload mediante `window.postMessage`.
- preload lo reenvia a `ipcMain`.
- main conecta `rpcHandler` al puerto.

Forma del mensaje:
- request:
  `{"i":"1","p":{"u":"orpc://localhost/cloud/listCloudAccounts","b":{"json":...}}}`
- response:
  ORPC devuelve `payload.b.json` o un error serializado.
- timeout:
  el cliente del renderer vence la promesa a los `60000 ms`.

Routers principales expuestos:
- `ping`
- `theme`
- `window`
- `app`
- `database`
- `proc`
- `account`
- `cloud`
- `config`
- `gateway`
- `system`

Router `theme`:
- leer tema actual
- alternar tema
- fijar `light`, `dark` o `system`

Router `window`:
- minimizar
- maximizar / restaurar
- cerrar ventana

Router `app`:
- devolver plataforma actual
- devolver version de la app

Router `proc`:
- detectar si Antigravity IDE esta corriendo
- cerrar Antigravity
- arrancar Antigravity

Router `database`:
- hacer backup de claves del IDE
- restaurar backup al IDE
- leer cuenta actual inferida desde `ItemTable`

Router `account`:
- listar snapshots locales
- agregar snapshot del IDE actual
- switch local por restauracion de backup
- bind, aplicar, restaurar y borrar perfiles de identidad

Router `cloud`:
- agregar cuenta Google via auth code
- listar, borrar, refrescar y cambiar cuenta cloud
- consultar y cambiar `auto_switch_enabled`
- forzar polling del monitor
- iniciar OAuth
- sync desde IDE
- exponer snapshot de switch metrics y hardening
- bind, restaurar y borrar perfiles de identidad cloud

Router `config`:
- cargar config
- guardar config y propagar cambios secundarios como auto start y `serverConfig`

Router `gateway`:
- iniciar servidor NestJS
- detener servidor NestJS
- consultar estado del proxy
- generar API key

Router `system`:
- listar IPs LAN locales
- abrir carpeta de logs del agente

Instrumentacion del canal:
- `src/ipc/router.ts` envuelve todas las llamadas con middleware de logging.
- `src/main.ts` ademas escribe paquetes ORPC sanitizados a `orpc_packets.log`.
- `src/ipc/manager.ts` mantiene un snapshot de debug del lado renderer.

Notas importantes:
- ORPC es el verdadero API interno del producto.
- mucha logica de negocio no vive en el renderer, solo sus disparadores.
- `gateway.generateKey` es un caso especial: actualiza `gui_config.json` pero no refresca el `serverConfig` en memoria, a diferencia de `config.saveConfig`.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\router.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\manager.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\cloud\router.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\account\router.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\gateway\router.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\config\handlers.ts`
