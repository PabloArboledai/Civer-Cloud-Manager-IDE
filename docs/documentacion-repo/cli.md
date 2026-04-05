# CLI

Resumen:
- el repo incluye una CLI Python que replica una parte importante del manager de escritorio
- puede listar, refrescar, validar, cambiar y exportar cuentas
- trabaja sobre la misma DB local y la misma DB del IDE

Archivos principales:
- `cli/main.py`
- `cli/core.py`
- `cli/proto_utils.py`
- `cli/README.md`

Superficie funcional:
- listado de cuentas
- info detallada por cuenta
- switch de cuenta
- refresh individual y masivo
- validacion y refresh de tokens
- comparacion CLI <-> IDE
- borrado de cuentas
- aliases
- export / import
- auto switch
- watch
- doctor
- setup PATH

Capas del CLI:
- `main.py`:
  Typer, Rich e interfaz interactiva.
- `core.py`:
  descubrimiento de paths, cifrado, lectura de DB, APIs Google, inyeccion al IDE, procesos.
- `proto_utils.py`:
  helpers protobuf.

Fuentes de datos del CLI:
- `cloud_accounts.db`
- `state.vscdb`
- alias file
- ejecutable Antigravity

Solapamiento con la app TS:
- comparte ideas de:
  cifrado local
  fetch de quota
  refresh de token
  inyeccion de token al IDE
  proceso de switch
- pero no comparte codigo; es una implementacion paralela

Hallazgo fuerte:
- `cli/core.py` trata `expiry_timestamp` como milisegundos.
- el codigo TypeScript lo usa en segundos.
- el CLI incluso reescribe `expiry_timestamp` en milisegundos al refrescar.
- esto puede dejar estados mezclados entre GUI y CLI.

Otras observaciones:
- el README del CLI esta orientado a Windows.
- el CLI habla de "same as the IDE" para el cifrado, pero en la practica esta reflejando el mismo modelo local del manager.
- no se aprecia una suite de tests dedicada al CLI.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\cli\README.md`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\cli\main.py`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\cli\core.py`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\cli\proto_utils.py`
