# Build, test y release

Resumen: el repo usa Electron Forge + Vite para desarrollo y empaquetado, Vitest/Playwright para pruebas y Semantic Release para versionado/publicacion. La configuracion de packaging es bastante completa y contempla Windows, macOS y Linux.

## Build local

Scripts principales:

- `npm start`
  Desarrollo con Electron Forge.
- `npm run package`
  Empaquetado local sin instaladores finales.
- `npm run make`
  Genera artefactos distribuibles.
- `npm run publish`
  Publicacion via Forge publishers.

## Vite

Configuraciones separadas:

- `vite.main.config.mts`
- `vite.preload.config.mts`
- `vite.renderer.config.mts`

Esto refleja la arquitectura Electron real:

- build del proceso main
- build del preload
- build del renderer

## Electron Forge

`forge.config.ts` muestra:

- makers para Squirrel, WiX, ZIP, DMG, DEB, RPM y AppImage
- copia de assets a `resources/assets`
- unpack/copia de modulos nativos como `better-sqlite3` y `keytar`
- filtros de archivos ignorados
- soporte de auto-update metadata

## CI

Workflows observados:

- `.github/workflows/testing.yaml`
- `.github/workflows/lint.yaml`
- `.github/workflows/format.yaml`
- `.github/workflows/release.yml`
- `.github/workflows/publish.yaml`

`testing.yaml` actualmente:

- corre unit tests en Ubuntu
- usa Node 22
- no corre E2E en CI por limitaciones de entorno grafico

## Testing local

- `npm test`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test:all`
- `npm run type-check`
- `npm run lint`
- `npm run format`

Areas de pruebas observadas:

- security migration
- cloud monitor
- cloud handler sync
- protobuf
- token manager scheduling
- proxy controller/retries
- account/device switching

## Release

`release.config.cjs` usa:

- conventional commits
- changelog automatico
- GitHub release
- reglas personalizadas para determinar major/minor/patch

Observacion:

- los cambios solo de docs, salvo ciertos scopes concretos, no disparan release.

## Referencias de codigo

- `package.json`
- `forge.config.ts`
- `release.config.cjs`
- `vite.main.config.mts`
- `vite.preload.config.mts`
- `vite.renderer.config.mts`
- `vitest.config.mjs`
- `playwright.config.ts`
- `.github/workflows/testing.yaml`
- `.github/workflows/release.yml`
- `.github/workflows/publish.yaml`
