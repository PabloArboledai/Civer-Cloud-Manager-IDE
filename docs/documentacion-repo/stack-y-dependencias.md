# Stack y dependencias

Resumen:
- runtime principal: Electron + Node.js
- frontend: React 19 + TypeScript
- backend embebido: NestJS + Fastify
- persistencia: Better-SQLite3 + Drizzle
- IPC: ORPC sobre `MessagePort`
- gateway de modelos: compatibilidad OpenAI, Anthropic y Gemini sobre APIs de Google

Stack de UI:
- `react`, `react-dom`
- `@tanstack/react-router`
- `@tanstack/react-query`
- `react-i18next`, `i18next`
- Tailwind CSS v4
- Radix UI
- `lucide-react`
- `class-variance-authority`, `clsx`, `tailwind-merge`

Stack de desktop:
- `electron`
- `update-electron-app`
- `keytar`
- `better-sqlite3`
- `winston`, `winston-daily-rotate-file`
- `uuid`

Stack de backend embebido:
- `@nestjs/common`, `@nestjs/core`
- `@nestjs/platform-fastify`
- `fastify`
- `axios`
- `undici`
- `zod`
- `lodash-es`

Stack de datos y transporte:
- `better-sqlite3`
- `drizzle-orm`
- `@orpc/client`, `@orpc/server`
- `@grpc/grpc-js`, `@grpc/proto-loader`

Stack de testing:
- `vitest`
- `@testing-library/react`
- `happy-dom`
- `playwright`
- `electron-playwright-helpers`

Tooling de build y release:
- `electron-forge`
- `vite`
- `@electron/fuses`
- `semantic-release`
- `@electron-forge/publisher-github`

Dependencias con impacto tecnico importante:
- `keytar`:
  almacenamiento del master key cuando `safeStorage` no sirve.
- `undici.ProxyAgent`:
  proxy HTTP saliente para Google APIs.
- `axios`:
  cliente usado por `GeminiClient`, sobre todo para `stream` y failover.
- `better-sqlite3`:
  acceso sincronico y simple para el estado local y DB del IDE.

Toolchain observada:
- `.nvmrc` fija `22.17.1`.
- CI de lint y tests usa Node `22`.
- workflow de publish usa Node `20`.
- `package.json` usa `npm` y no hay indicios de `pnpm` o `yarn`.

Notas operativas:
- `node` y `npm` no estan accesibles en el `PATH` de esta maquina, por eso esta documentacion se apoya en inspeccion estatica.
- el repo si contiene `node_modules`, asi que el workspace ya fue instalado por otra via o en otro contexto.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\package.json`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\.nvmrc`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\forge.config.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\vitest.config.mjs`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\playwright.config.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\.github\workflows\testing.yaml`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\.github\workflows\publish.yaml`
