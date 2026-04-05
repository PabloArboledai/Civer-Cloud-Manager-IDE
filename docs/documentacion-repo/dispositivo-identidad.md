# Dispositivo e identidad

Resumen: el sistema permite capturar, generar y aplicar perfiles de identidad del IDE. Manipula valores en `storage.json` y sincroniza `storage.serviceMachineId` dentro de la DB del IDE. Incluye backups y modo seguro.

Elementos de identidad:
- `machineId`, `macMachineId`, `devDeviceId`, `sqmId` en `storage.json`.
- `storage.serviceMachineId` en `state.vscdb`.

Operaciones:
- Generar perfil desde estado actual.
- Aplicar perfil con backup y verificacion.
- Guardar historial por cuenta.
- Modo seguro tras fallos consecutivos al aplicar identidad.

Backups y seguridad:
- Se guarda el ultimo perfil aplicado por cuenta.
- Hay backup del estado previo para rollback.
- Se valida que los archivos existan antes de aplicar.

Flags y control:
- Habilitacion via `CRACK_IDENTITY_PROFILE_APPLY_ENABLED` o `CRACK_DEVICE_FINGERPRINT_ENABLED`.
- Temporizador de bloqueo para evitar loops de fallos.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\device\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\database\cloudHandler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\paths.ts`
