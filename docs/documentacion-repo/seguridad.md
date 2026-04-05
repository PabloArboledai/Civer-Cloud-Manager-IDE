# Seguridad

Resumen: el repo tiene buenas bases de seguridad local para una app desktop de este tipo, especialmente en cifrado de secretos y masking de logs. Aun asi, tambien presenta varios riesgos concretos que otros agentes deberian conocer antes de ampliar o confiar ciegamente en ciertos flujos.

## Fortalezas observadas

### Cifrado de datos sensibles

- `token_json` y `quota_json` se cifran con AES-256-GCM.
- Existe migracion desde formatos legacy/plaintext.
- Hay soporte de varias fuentes de master key:
  - `safeStorage`
  - `keytar`
  - fallback en archivo `.mk`

### Manejo cuidadoso de escrituras

- escrituras atomicas en varios puntos
- backups antes de mutar `state.vscdb`
- snapshots y rollback para device identity

### Masking de logs

- masking de tokens y API keys
- `safeStringifyPacket()` para ORPC packet logging
- buffer de logs recientes pensado para reportes de error

## Riesgos y observaciones importantes

### 1. Credenciales OAuth hardcodeadas

Se observan `CLIENT_ID` y `CLIENT_SECRET` de Google hardcodeados en:

- `src/services/GoogleAPIService.ts`
- `src/ipc/cloud/handler.ts`
- `cli/core.py`

### 2. Flujo OAuth sin `state`

No vi parametro `state` en la construccion de la URL OAuth.

Impacto:

- menor proteccion frente a CSRF o callbacks cruzados
- el callback local confia practicamente en recibir un `code` valido

### 3. `BrowserWindow` con `nodeIntegration: true`

En `src/main.ts`:

- `contextIsolation: true`
- `nodeIntegration: true`

Eso reduce el aislamiento que normalmente se busca en una app Electron endurecida.

### 4. Proxy escuchando en `0.0.0.0`

`src/server/main.ts` hace `listen(port, '0.0.0.0')` y habilita CORS.

Si ademas `api_key` esta vacia, el servicio puede quedar expuesto mas ampliamente de lo deseado.

### 5. Proxy en modo abierto si no hay API key

`ProxyGuard` devuelve `true` si no hay API key configurada.

Eso es un comportamiento funcional intencional, pero desde seguridad requiere que el operador sepa exactamente que esta publicando.

### 6. Fallback de master key en archivo

Cuando `safeStorage` y `keytar` fallan, el sistema cae a `.mk`.

Es un compromiso pragmatico, pero claramente menos fuerte que keychain/credential manager nativo.

### 7. Packet logs siguen siendo sensibles

Aunque haya masking, `orpc_packets.log` puede seguir conteniendo metadatos operativos delicados.

### 8. Fallback de `project_id`

`TokenManagerService` usa `silver-orbit-5m7qc` como fallback si no resuelve proyecto.

No es un bug de seguridad clasico, pero si un comportamiento implicito que conviene auditar.

## Recomendaciones operativas

- No asumir que dejar `api_key` vacia es inocuo.
- Tratar `orpc_packets.log`, `app logs` y `.mk` como artefactos sensibles.
- Revisar cualquier cambio en preload/renderer con cuidado por la combinacion `contextIsolation + nodeIntegration`.
- Si se endurece seguridad, priorizar:
  - mover secretos OAuth fuera del repo
  - agregar `state` al flujo OAuth
  - evaluar reducir exposicion del proxy

## Referencias de codigo

- `src/utils/security.ts`
- `src/utils/sensitiveDataMasking.ts`
- `src/main.ts`
- `src/server/main.ts`
- `src/server/modules/proxy/proxy.guard.ts`
- `src/services/GoogleAPIService.ts`
- `src/ipc/cloud/handler.ts`
- `cli/core.py`
