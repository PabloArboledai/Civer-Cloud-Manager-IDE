# CLI

Resumen: el repo incluye un CLI Python que replica parte del valor del manager Electron desde terminal. No es solo un wrapper cosmetico; interactua con la DB cifrada, refresca cuotas, valida tokens, maneja aliases y puede inyectar credenciales en el IDE.

## Estructura

- `cli/main.py`
  Comandos Typer + Rich + modo interactivo opcional con Questionary.
- `cli/core.py`
  Logica real de DB, cifrado, refresh de tokens y escritura al IDE.
- `cli/proto_utils.py`
  Helpers protobuf para el formato OAuth del IDE.
- `cli/README.md`
  Guia de uso para humanos.

## Capacidades observadas

- listar cuentas
- mostrar cuotas
- refrescar una o todas las cuentas
- validar tokens
- cambiar a la mejor cuenta
- exportar/importar backup
- aliases
- watch de cuotas
- doctor/diagnostics
- setup PATH

## Relacion con la app principal

El CLI:

- lee `cloud_accounts.db`
- intenta obtener la misma master key
- descifra `token_json` y `quota_json`
- puede escribir `antigravityUnifiedStateSync.oauthToken` y otros campos en `state.vscdb`

En la practica, es una ruta paralela al UI desktop para operar el mismo ecosistema de datos.

## Diferencias y caveats

- El CLI esta claramente mas sesgado a Windows en varias rutas y supuestos.
- Duplica `CLIENT_ID` y `CLIENT_SECRET` de Google.
- Implementa su propia busqueda de `.mk`, `Local State` y DPAPI.
- Sus heuristicas de paths no siempre coinciden exactamente con `src/utils/paths.ts`.

Eso significa que es util para diagnostico y operaciones rapidas, pero puede divergir del comportamiento del runtime TypeScript si uno evoluciona y el otro no.

## Uso operativo recomendado

Bueno para:

- auditoria rapida de cuentas/cuotas
- diagnostico en terminal
- refresh masivo
- scripting local

Menos bueno para:

- asumir que refleja al 100 por ciento la logica mas actual del main process
- usarlo como unica fuente de verdad de paths o estrategias de cifrado

## Referencias de codigo

- `cli/README.md`
- `cli/main.py`
- `cli/core.py`
- `cli/proto_utils.py`
