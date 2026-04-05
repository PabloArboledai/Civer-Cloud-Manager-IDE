# Seguridad

Resumen:
- el repo si tiene controles de seguridad reales, sobre todo en cifrado de tokens y sanitizacion de logs
- tambien arrastra decisiones de riesgo en Electron, OAuth y exposicion del proxy

Controles de seguridad positivos:
- cifrado AES-256-GCM para `token_json` y `quota_json`
- jerarquia de clave maestra:
  `safeStorage`
  `keytar`
  `file` fallback
- migracion automatica cuando una fila se descifra con key fallback
- sanitizacion de objetos para logs y paquetes ORPC
- fuses de Electron en empaquetado

Jerarquia de claves:
- preferido:
  `safeStorage` de Electron
- fallback:
  `keytar`
- ultimo recurso:
  archivo `.mk`

Datos protegidos:
- access tokens
- refresh tokens
- quota blobs
- objetos complejos que pasan por logger

Proteccion de logs:
- `sanitizeObject()` y `safeStringifyPacket()` intentan ocultar secretos antes de persistir.
- `logger.ts` tambien captura `recentLogs` para Sentry si esta habilitado.

Postura Electron:
- `contextIsolation: true`
- `nodeIntegration: true`
- fuses de empaquetado:
  `RunAsNode = false`
  `EnableCookieEncryption = true`
  `EnableNodeOptionsEnvironmentVariable = false`
  `EnableNodeCliInspectArguments = false`
  `EnableEmbeddedAsarIntegrityValidation = true`
  `OnlyLoadAppFromAsar = true`

Proxy local:
- la API key se valida en `ProxyGuard`.
- si la API key esta vacia, el proxy queda sin auth.
- como el servidor escucha en `0.0.0.0`, el riesgo no es solo local si el host tiene red abierta.

Riesgos concretos detectados:
- `nodeIntegration: true` ensancha la superficie del renderer.
- `CLIENT_SECRET` de Google esta hardcodeado.
- el OAuth no usa `state`.
- `AuthServer` usa puerto fijo `8888`.
- `gateway.generateKey` no sincroniza config viva del proxy ya corriendo.

Notas sobre secretos:
- no se detectaron variables de entorno obligatorias para el funcionamiento normal de auth Google; gran parte de esa identidad viene embebida.
- Sentry si depende de `SENTRY_DSN` para un despliegue real.

Referencias:
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\security.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\utils\sensitiveDataMasking.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\main.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\instrument.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\src\server\modules\proxy\proxy.guard.ts`
- `C:\Users\Afrodita\Desktop\DraculaboAntigravityManager\forge.config.ts`
