# Switching y monitoreo

Resumen: el switching de cuentas se hace de forma segura con backups, cierre del IDE, aplicacion de identidad y reinicio. El monitor actualiza tokens y cuotas y puede activar auto-switch segun reglas.

Switching cloud:
- Refresca token si esta proximo a expirar.
- Hace backup de DB del IDE.
- Inyecta token OAuth en el IDE.
- Actualiza cuenta activa y estado de tray.

Switching local:
- Usa backups historicos en JSON y DB.
- Restaura claves y estado de auth en el IDE.

Auto-switch:
- Monitor periodico de cuotas y salud.
- Auto-switch elige cuentas con cuota suficiente y estado activo.

Guardas:
- `switchGuard` serializa operaciones de switch.
- `switchMetrics` guarda duraciones y estados.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\cloud\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\account\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\switchFlow.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\services\cloudMonitorService.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\services\autoSwitchService.ts`
