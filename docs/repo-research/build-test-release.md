# Build, test y release

Scripts principales (npm)

- Desarrollo: `npm start`
- Lint: `npm run lint`
- Format: `npm run format`, `npm run format:write`
- Type check: `npm run type-check`
- Tests: `npm test`, `npm run test:unit`, `npm run test:e2e`, `npm run test:all`
- Build: `npm run package`, `npm run make`, `npm run publish`
- Referencia: `package.json`

Tooling de build

- Electron Forge + Vite
- Builder y actualizaciones con `update-electron-app`
- Referencias: `forge.config.ts`, `package.json`, `src/main.ts`

Sentry

- Se habilita por config local y variables de entorno.
- Referencias: `src/instrument.ts`, `src/renderer.ts`

Notas de test

- Vitest para unit/integration, Playwright para E2E.
- Referencias: `package.json`, `src/tests/*`

