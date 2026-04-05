# Stack y dependencias

Resumen: el proyecto es una app Electron con frontend React y backend interno NestJS para proxy/gateway. Usa SQLite local para cuentas y estado, y un IPC tipado via ORPC entre renderer y main.

Frontend:
- React 19 + TypeScript
- Tailwind CSS v4 y utilidades `clsx`, `tailwind-merge`, `tailwindcss-animate`
- TanStack Router y TanStack Query
- i18n con `react-i18next`
- UI con Radix Primitives y Lucide React

Backend en Electron:
- Electron main/preload/renderer
- NestJS + Fastify como servidor interno
- ORPC para IPC tipado
- Better-SQLite3 + Drizzle ORM
- Winston + rotacion diaria de logs

Testing:
- Vitest
- Playwright

Herramientas de build:
- Electron Forge + Vite

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\package.json`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\forge.config.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\renderer.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\main.ts`
