# Build, test y release

Resumen:
- el repo usa `npm`
- build y empaquetado pasan por Electron Forge + Vite
- hay unit tests con Vitest y E2E con Playwright
- el pipeline de publish genera artefactos multi plataforma

Scripts principales:
- `npm start`
- `npm run lint`
- `npm run format`
- `npm run type-check`
- `npm test`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run make`
- `npm run publish`

Vitest:
- archivo:
  `vitest.config.mjs`
- entorno:
  `happy-dom`
- incluye:
  `src/tests/unit/**/*.test.ts`
- mocks importantes:
  `keytar`
  `better-sqlite3`

Implicacion:
- hay buena cobertura de logica pura y controllers simulados
- pero no es una validacion real del almacenamiento nativo ni del keychain

Playwright:
- archivo:
  `playwright.config.ts`
- directorio:
  `src/tests/e2e`
- reporter:
  `html`

CI observado:
- `testing.yaml`:
  corre solo unit tests con Node 22
- `lint.yaml`:
  corre lint con Node 22
- `release.yml`:
  semantic release con Node 22
- `publish.yaml`:
  build de instaladores con Node 20 en Windows, macOS y Linux

Gap relevante:
- `testing.yaml` deja fuera E2E por depender de entorno grafico.
- `src/tests/AntigravityCoreFeatures.test.ts` no entra en el glob de Vitest configurado.

Forge y empaquetado:
- copia assets a `resources/assets`
- fuerza inclusion de modulos nativos como `better-sqlite3` y `keytar`
- genera nombres de artefacto y checksums
- publica drafts en GitHub
- usa fuses para endurecer la app empaquetada

Versiones de Node:
- `.nvmrc`:
  `22.17.1`
- testing/lint/release:
  `22`
- publish:
  `20`

Validacion realizada en esta investigacion:
- no se pudieron ejecutar `npm run type-check` ni `npm run test:unit` porque `node` y `npm` no estan en el `PATH` de esta maquina.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\package.json`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\forge.config.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\vitest.config.mjs`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\playwright.config.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\.github\workflows\testing.yaml`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\.github\workflows\lint.yaml`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\.github\workflows\publish.yaml`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\.github\workflows\release.yml`
