# UI y rutas

Resumen:
- la UI vive en React 19 con TanStack Router
- las rutas principales son home, proxy y settings
- casi toda la logica real la dispara ORPC hacia main, no el renderer por si mismo

Entradas del renderer:
- `src/renderer.ts`
- `src/App.tsx`
- `src/routeTree.gen.ts`

Ruta `/`
- archivo:
  `src/routes/index.tsx`
- componente principal:
  `CloudAccountList`
- responsabilidades:
  listar cuentas cloud
  refrescar cuotas
  borrar cuentas
  iniciar OAuth
  sync desde el IDE
  activar auto switch
  abrir dialogos de identidad
  exponer estado de switching y hardening

Componentes principales del home:
- `src/components/CloudAccountList.tsx`
- `src/components/CloudAccountCard.tsx`
- `src/components/IdentityProfileDialog.tsx`
- `src/components/ProviderGroup.tsx`
- `src/components/ModelVisibilitySettings.tsx`

Capacidades visibles del home:
- grid/list layout para tarjetas
- provider grouping
- quota summary por cuenta
- refresh individual
- acciones de identidad:
  preview
  capture
  generate
  restore revision
  restore baseline
  delete revision

Ruta `/proxy`
- archivo:
  `src/routes/proxy.tsx`
- responsabilidades:
  iniciar y detener el gateway
  editar puerto y timeout
  mostrar y regenerar API key
  configurar `auto_start`
  editar mapping Anthropic
  mostrar ejemplos de uso OpenAI y Anthropic
  mostrar IP LAN local para acceso desde otros dispositivos

Notas importantes del panel proxy:
- usa `system.get_local_ips()` para mostrar IPs locales.
- si el proxy esta activo y no hay API key, avisa que el servicio esta abierto.
- la regeneracion de API key usa `gateway.generateKey()`, que hoy no actualiza `serverConfig` vivo.

Ruta `/settings`
- archivo:
  `src/routes/settings.tsx`
- tabs:
  `general`
  `models`
  `proxy`
- capacidades:
  theme
  idioma
  auto refresh
  auto sync
  auto startup
  privacy / error reporting
  apertura de carpeta de logs
  model visibility
  upstream proxy

Internacionalizacion:
- idiomas visibles:
  `en`
  `zh-CN`
  `ru`
- el idioma cambia por ORPC y ademas se sincroniza con el tray.

Patron de datos:
- hooks:
  `useAppConfig`
  `useCloudAccounts`
  `useProviderGrouping`
- los datos se leen desde ORPC usando `ipc.client.*`.

Riesgos o limitaciones observadas:
- parte del copy UI esta en ingles incluso con conversaciones de trabajo en espanol.
- el renderer tiene `nodeIntegration: true`, asi que la frontera de seguridad depende mucho del preload y del codigo que se monte.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\App.tsx`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\renderer.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\routes\index.tsx`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\routes\proxy.tsx`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\routes\settings.tsx`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\components\CloudAccountList.tsx`
