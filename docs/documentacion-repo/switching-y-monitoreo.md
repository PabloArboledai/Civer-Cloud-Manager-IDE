# Switching y monitoreo

Resumen:
- el repo tiene dos familias de switch: local snapshot y cloud token
- ambos pasan por guardas para serializar operaciones
- el switching cloud puede aplicar perfil de identidad, inyectar token y reiniciar el IDE
- el monitoreo periodico refresca cuotas y puede disparar auto switch

Componentes:
- `switchGuard`
- `switchFlow`
- `switchMetrics`
- `CloudMonitorService`
- `AutoSwitchService`

Switch cloud:
- entrada:
  `cloud.switchCloudAccount(accountId)`
- pasos:
  `runWithSwitchGuard('cloud-account-switch', ...)`
  `ensureGlobalOriginalFromCurrentStorage()`
  preparar refresh de token en paralelo
  `executeSwitchFlow(...)`
  backup de `state.vscdb`
  `CloudAccountRepo.injectCloudToken(account)`
  `CloudAccountRepo.setActive(account.id)`
  `startAntigravity()`

Switch local:
- entrada:
  `account.switchAccount(accountId)`
- idea:
  restaurar backup JSON del IDE y opcionalmente identidad
- utiliza el mismo marco de guard y flujo de cierre / arranque del IDE

`executeSwitchFlow()` estandariza etapas:
- `close`
- `apply`
- `switch`
- `start`

Guard de concurrencia:
- `switchGuard` mantiene una cola en memoria.
- duele menos que dos switches compitan entre si sobre `state.vscdb` o `storage.json`.
- expone snapshot con `activeOwner`, `pendingOwners` y `pendingCount`.

Metricas:
- por scope `local` y `cloud`
- cuenta:
  `switchSuccess`
  `switchFailure`
  `rollbackAttempt`
  `rollbackSuccess`
  `rollbackFailure`
  `failureReasons`
  `lastFailure`

Observacion tecnica:
- `recordSwitchRollback()` existe pero no aparece conectado al flujo real observado; por eso las metricas de rollback pueden quedarse en cero incluso si hay recuperaciones parciales en otras capas.

Monitor cloud:
- corre cada 5 minutos.
- al enfocar la ventana puede disparar poll inmediato con debounce de 10 segundos.
- por cuenta:
  refresca token si falta poco para expirar
  consulta cuotas
  guarda cuota y `last_used`
- al final llama `AutoSwitchService.checkAndSwitchIfNeeded()`.

Heuristica de auto switch:
- solo corre si `auto_switch_enabled` esta activo en `cloud_accounts.db`.
- toma la cuenta activa.
- considera "depleted" una cuenta si algun modelo baja de 5 por ciento.
- busca otra cuenta `active`, no actual, con quota disponible y mejor promedio.

Observaciones:
- la heuristica actual es simple; no esta alineada con la riqueza del `TokenManagerService`.
- una cuenta puede verse castigada por un solo modelo bajo aunque otro modelo clave siga sano.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\switchFlow.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\switchGuard.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\switchMetrics.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\services\CloudMonitorService.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\services\AutoSwitchService.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\cloud\handler.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\ipc\account\handler.ts`
