# Operaciones y Observabilidad

## Logs

El sistema usa `winston` con rotacion diaria para logs del proxy y servicios. Referencias: `src/server/logging/logger.ts`, `src/server/logging/rotate.ts`.

## Bandeja (tray)

La app expone acciones rapidas en el tray:
- ver cuenta activa y cuotas,
- switch a siguiente cuenta,
- refrescar cuotas,
- salir.

Referencia: `src/ipc/tray/handler.ts`.

## Monitor de cuentas

`CloudMonitorService`:
- refresca tokens cerca del vencimiento,
- consulta cuotas,
- dispara auto-switch.

Referencia: `src/services/CloudMonitorService.ts`.

## Auto-switch

`AutoSwitchService`:
- evalua porcentajes de cuota,
- evita cuentas rate-limited,
- selecciona mejor cuenta disponible.

Referencia: `src/services/AutoSwitchService.ts`.
