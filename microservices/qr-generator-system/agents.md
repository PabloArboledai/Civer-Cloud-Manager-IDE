# Configuración de Agentes para qr-generator-system

Este archivo contiene las directrices para que los Agentes de IA interactúen con el microservicio qr-generator-system.

## Propósito
Gestionar y mantener el sitio `qr-generator-system` asegurando que sea compatible con todos los lenguajes, frameworks, diseños y estructuras (distintos o iguales a Node.js).

## Entorno y Despliegue
- **Túnel y Dominio:** Debe lanzarse bajo el dominio `qr-generator-system.civer.cloud` (su nombre de dominio original).
- **Puerto Asignado:** 3007
- **Compatibilidad:** Soporte universal (Python, PHP, Estáticos, Node).
- **Credenciales:** Ver `README.md` o los manejadores de secretos del ecosistema Civer Cloud.

## Tareas
- Mantener compatibilidad con Civer-Cloud-Manager-IDE.
- Orquestación automática vía `orchestrator.cjs`.
