# visual-md5-viewer - Documentación

Este microservicio forma parte del ecosistema unificado de Civer Cloud y ahora está gestionado por el `Civer-Cloud-Manager-IDE`.

## 1. Funcionamiento General
`visual-md5-viewer` es un componente integral diseñado para funcionar dentro de nuestra arquitectura distribuida. Todo el sitio está estructurado para operar bajo sus tecnologías nativas (sea Python, PHP, Node.js o contenido estático).

## 2. Dominios y Túneles
Anteriormente, cada sitio tenía su propio nombre de dominio. Para mantener esta estructura:
- **Dominio de Producción:** `visual-md5-viewer.civer.cloud`
- **Túnel de Redirección Local:** `localhost:3011`
- **Lanzamiento:** Integrado y administrado automáticamente por el Civer Cloud Manager IDE en `npm run dev`.

## 3. Credenciales
Las credenciales, bases de datos o secretos que este sitio necesite están integrados con la bóveda de credenciales centralizada. Si el servicio requiere credenciales externas, deben manejarse inyectando las variables de entorno necesarias o mediante el archivo `.env` seguro en este directorio.

## 4. Ejecución
Para arrancar este sitio:
No se requiere ejecución aislada; el orquestador universal inicia este servicio usando su propio entorno nativo.
