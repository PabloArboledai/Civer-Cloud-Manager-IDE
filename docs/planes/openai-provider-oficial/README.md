# Roadmap: proveedor oficial OpenAI/Codex

## Conclusión ejecutiva

Lo pendiente **no** debe resolverse capturando callbacks del navegador ni reutilizando sesiones de ChatGPT/Codex como si fueran API keys. La ruta segura y mantenible es añadir un **pool oficial de credenciales OpenAI API** detrás del proxy local, y mantener el panel Codex como superficie de diagnóstico/estado del entorno local.

## Estado actual

- Ya existe un panel `Codex` que detecta instalación y estado local de `~/.codex`.
- Ya existe un proxy local con scheduling, stickiness y rate-limit tracking.
- Ya existe almacenamiento cifrado reutilizable para secretos y estado.
- Ya existe un modelo dedicado para credenciales oficiales OpenAI API, persistido de forma cifrada.
- Ya existe un backend OpenAI real detrás del proxy local, con scheduler/failover multi-credencial.
- Ya existe una superficie de gestión dentro de `Proxy > Pool oficial OpenAI API`.
- Sigue pendiente la validación manual con 2+ credenciales reales y endurecer tests automáticos de scheduler.

## Gap confirmado

- No hay servidor OAuth propio para OpenAI/Codex en `localhost:1455`.
- No hay captura automática de callbacks OpenAI/Codex para persistir cuentas.
- No hay pool multi-cuenta OpenAI dentro del modelo persistente legacy.
- No hay smoke test cerrado con 2+ credenciales OpenAI API reales.
- No hay todavía una batería automática dedicada al scheduler OpenAI.

## Decisión de arquitectura

### Sí implementar

- Soporte para **múltiples credenciales oficiales OpenAI API**:
  - API keys por proyecto
  - metadatos de proyecto/organización
  - estado de uso/coste/errores
  - rotación por salud/presupuesto/rate-limit
  - exposición mediante el proxy local con una sola API key del proxy

### No implementar como base del sistema

- Captura de `id_token` de `auth.openai.com` desde callbacks de navegador.
- Proxy de sesiones ChatGPT/Codex de consumo como si fueran API credentials universales.
- Rotación “transparente” para herramientas que **no** usen el proxy local de Antigravity.

## Resultado esperado

1. El usuario registra una o varias credenciales oficiales OpenAI API.
2. Antigravity las cifra y las almacena en un pool separado.
3. El proxy local usa una sola API key propia de Antigravity hacia los clientes.
4. Internamente Antigravity enruta cada request a la mejor credencial OpenAI disponible.
5. Si una credencial entra en rate-limit, presupuesto agotado o fallo repetido, rota a otra sin reiniciar al cliente **siempre que el cliente use el proxy**.

## Estado funcional actual

Hoy ya se puede:

- Registrar credenciales oficiales OpenAI API desde la UI del proxy.
- Refrescar modelos y estado operativo de cada credencial.
- Exponer modelos OpenAI conocidos en `GET /v1/models`.
- Enrutar `POST /v1/chat/completions` de modelos `gpt-*`, `o*` y `codex*` hacia el pool oficial OpenAI.
- Rotar entre credenciales saludables dentro del proxy local sin reiniciar el cliente que consume el proxy.

Limitaciones actuales:

- El detalle de coste/usage completo depende de que la credencial tenga acceso a endpoints administrativos de OpenAI.
- La rotación transparente **no** aplica a clientes que usan la API key oficial directamente fuera del proxy.
- Falta una pasada de smoke test manual con 2+ credenciales reales para cerrar la fase operativa.

## Planes detallados

- `docs/planes/openai-provider-oficial/estado-actual-y-gap.md`
- `docs/planes/openai-provider-oficial/plan-de-fases-y-subagentes.md`
- `openspec/changes/add-official-openai-provider-pool/proposal.md`
- `openspec/changes/add-official-openai-provider-pool/design.md`
- `openspec/changes/add-official-openai-provider-pool/tasks.md`

## Referencias

- OpenAI quickstart/pricing: https://platform.openai.com/docs/quickstart/pricing
- OpenAI projects API reference: https://platform.openai.com/docs/api-reference/projects
