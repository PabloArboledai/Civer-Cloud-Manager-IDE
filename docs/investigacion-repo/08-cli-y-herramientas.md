# CLI y herramientas

## CLI Python

El repo incluye un CLI en Python para:
- listar cuentas,
- refrescar cuotas,
- cambiar cuenta activa,
- exportar/importar cuentas de DB.

Referencias:
- CLI principal: `cli/cli.py`
- Docs: `cli/README.md`

## Diferencias clave con la app

- El CLI lee la misma DB `cloud_accounts.db` y usa el mismo cifrado (DPAPI / key derivation).
- Opera sin UI y sin Electron.
- Reutiliza endpoints OAuth y APIs de Google.

Referencias: `cli/cli.py`, `cli/antigravity.py`.

## Scripts de soporte

Scripts adicionales viven en `scripts/` y pueden ayudar con diagnosticos o tareas internas. Referencia: `scripts`.
