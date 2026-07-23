# Investigacion del Repo AntigravityManager

Este conjunto de documentos describe de forma completa el funcionamiento del repo, su stack, sus conexiones y llamadas externas, el sistema de autenticacion (tokens, cuotas, identidad), y los flujos internos. La intencion es que cualquier agente pueda entender el sistema sin abrir todo el codigo.

Resumen rapido:
- Es una app Electron (main/preload/renderer) con UI React.
- Ejecuta un servidor NestJS embebido que actua como proxy/gateway hacia modelos.
- Administra cuentas "cloud" con OAuth de Google, guarda tokens cifrados y escribe tokens en el almacenamiento del IDE.
- Tiene un sistema de auto-cambio de cuentas basado en cuotas.
- Incluye CLI en Python para operar la base local.

Indice:
- 01-resumen-y-stack.md
- 02-arquitectura-y-flujos.md
- 03-auth-tokens-identidad.md
- 04-almacenamiento-db-y-cifrado.md
- 05-ipc-orpc-y-api-interna.md
- 06-proxy-y-modelos.md
- 07-integraciones-externas.md
- 08-cli-y-herramientas.md
- 09-operaciones-y-observabilidad.md
- 10-riesgos-y-notas.md

Nota de referencias: cuando se cite codigo, se usan rutas completas como `src/main.ts`.
