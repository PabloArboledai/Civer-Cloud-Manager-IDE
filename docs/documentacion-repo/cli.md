# CLI

Resumen: existe un CLI en Python que puede leer la DB local, refrescar tokens y aplicar switching en el IDE. Comparte la logica de cifrado y endpoints con la app principal.

Funciones principales:
- Listar cuentas desde la DB local.
- Refrescar tokens y cuotas.
- Inyectar token en `state.vscdb`.
- Cambiar cuenta activa sin UI.

Notas de cifrado:
- Usa la misma master key y fallback local.
- Lee la DB `cloud_accounts.db`.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\cli\README.md`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\cli\main.py`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\cli\core.py`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\cli\proto_utils.py`
