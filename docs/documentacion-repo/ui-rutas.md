# UI y rutas

Resumen: la UI del repo es compacta pero cubre casi todo el valor visible del producto. El renderer React consume ORPC y expone principalmente gestion de cuentas cloud, estado/configuracion del proxy, ajustes generales y controles del proceso Antigravity.

## Estructura general del renderer

Archivos de entrada:

- `src/renderer.ts`
- `src/App.tsx`

La app monta:

- i18n
- tema
- TanStack Router
- TanStack Query

## Rutas visibles

### `/`

Componente principal:

- `src/routes/index.tsx`

Contenido destacado:

- `CloudAccountList`
- tarjetas de cuentas cloud
- acciones de agregar, refrescar, borrar y cambiar cuenta
- dialogos de identidad para cuentas cloud
- estado de cuotas y estado activo

### `/proxy`

Componente principal:

- `src/routes/proxy.tsx`

Contenido destacado:

- encendido/apagado del gateway
- estado del servicio
- puerto
- API key
- scheduling mode
- timeout
- upstream proxy
- model mapping/custom mapping
- opciones de parity/shadow

### `/settings`

Componente principal:

- `src/routes/settings.tsx`

Contenido destacado:

- idioma
- tema
- auto-startup
- error reporting
- ajustes de cuenta
- model visibility
- provider grouping
- layout de grid/lista
- toggles `auto_refresh` y `auto_sync`

## Layout y componentes transversales

- `src/layouts/MainLayout.tsx`
  Sidebar, navegacion y contenedor principal.
- `src/components/StatusBar.tsx`
  Estado del proceso Antigravity y acciones rapidas.
- `src/components/IdentityProfileDialog.tsx`
  Gestion de identidad ligada a cuentas.
- `src/components/ModelVisibilitySettings.tsx`
  Preferencias de visibilidad por modelo/proveedor.

## Hooks y actions importantes

- `src/hooks/useCloudAccounts.ts`
  Hook principal para listar cuentas, mutaciones y auth flow.
- `src/actions/cloud.ts`
  Wrappers ORPC del dominio cloud.
- `src/actions/account.ts`
  Wrappers ORPC del dominio account.
- `src/actions/database.ts`
  Wrappers ORPC para backup/restore local.

## Observaciones de UI

- La UI principal visible esta muy orientada a cuentas cloud; el subsistema de snapshots locales existe en backend, pero no parece tener la misma prominencia en el arbol de rutas actual.
- `routeTree.gen.ts` muestra esencialmente solo tres vistas principales: home, proxy y settings.
- La identidad de dispositivo ya esta bastante integrada en la experiencia de cuentas cloud gracias a `IdentityProfileDialog`.

## Referencias de codigo

- `src/renderer.ts`
- `src/App.tsx`
- `src/routeTree.gen.ts`
- `src/routes/index.tsx`
- `src/routes/proxy.tsx`
- `src/routes/settings.tsx`
- `src/layouts/MainLayout.tsx`
- `src/components/CloudAccountList.tsx`
- `src/components/IdentityProfileDialog.tsx`
- `src/components/StatusBar.tsx`
- `src/hooks/useCloudAccounts.ts`
