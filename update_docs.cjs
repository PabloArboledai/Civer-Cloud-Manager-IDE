const fs = require('fs');
const path = require('path');

const microservicesDir = path.join(__dirname, 'microservices');
const services = fs.readdirSync(microservicesDir).filter(f => fs.statSync(path.join(microservicesDir, f)).isDirectory());

const defaultPorts = {
  'Nodriza-Core': 3010,
  'antigravity-link-local': 3002,
  'api-system': 3001,
  'boveda-credenciales': 5000,
  'gpt-5.4-mini-lab': 3008,
  'omni-drive-dashboard': 3006,
  'omniverso-hypervisor': 3000,
  'profeonline': 3012,
  'qr-generator-system': 3007,
  'sitio-descarga': 4000,
  'status.civer.cloud': 3009,
  'streamit-flutter_v1.4.0': 8000,
  'visual-md5-viewer': 3011,
  'vps-manager-project': 3014
};

services.forEach(service => {
  const servicePath = path.join(microservicesDir, service);
  const agentsPath = path.join(servicePath, 'agents.md');
  const readmePath = path.join(servicePath, 'README.md');
  const port = defaultPorts[service] || 3000;
  const domain = `${service}.civer.cloud`;

  const agentsContent = `# Configuración de Agentes para ${service}

Este archivo contiene las directrices para que los Agentes de IA interactúen con el microservicio ${service}.

## Propósito
Gestionar y mantener el sitio \`${service}\` asegurando que sea compatible con todos los lenguajes, frameworks, diseños y estructuras (distintos o iguales a Node.js).

## Entorno y Despliegue
- **Túnel y Dominio:** Debe lanzarse bajo el dominio \`${domain}\` (su nombre de dominio original).
- **Puerto Asignado:** ${port}
- **Compatibilidad:** Soporte universal (Python, PHP, Estáticos, Node).
- **Credenciales:** Ver \`README.md\` o los manejadores de secretos del ecosistema Civer Cloud.

## Tareas
- Mantener compatibilidad con Civer-Cloud-Manager-IDE.
- Orquestación automática vía \`orchestrator.cjs\`.
`;

  const readmeContent = `# ${service} - Documentación

Este microservicio forma parte del ecosistema unificado de Civer Cloud y ahora está gestionado por el \`Civer-Cloud-Manager-IDE\`.

## 1. Funcionamiento General
\`${service}\` es un componente integral diseñado para funcionar dentro de nuestra arquitectura distribuida. Todo el sitio está estructurado para operar bajo sus tecnologías nativas (sea Python, PHP, Node.js o contenido estático).

## 2. Dominios y Túneles
Anteriormente, cada sitio tenía su propio nombre de dominio. Para mantener esta estructura:
- **Dominio de Producción:** \`${domain}\`
- **Túnel de Redirección Local:** \`localhost:${port}\`
- **Lanzamiento:** Integrado y administrado automáticamente por el Civer Cloud Manager IDE en \`npm run dev\`.

## 3. Credenciales
Las credenciales, bases de datos o secretos que este sitio necesite están integrados con la bóveda de credenciales centralizada. Si el servicio requiere credenciales externas, deben manejarse inyectando las variables de entorno necesarias o mediante el archivo \`.env\` seguro en este directorio.

## 4. Ejecución
Para arrancar este sitio:
No se requiere ejecución aislada; el orquestador universal inicia este servicio usando su propio entorno nativo.
`;

  // Escribir los archivos
  fs.writeFileSync(agentsPath, agentsContent);
  fs.writeFileSync(readmePath, readmeContent);
  console.log(`Documentación actualizada para: ${service}`);
});
