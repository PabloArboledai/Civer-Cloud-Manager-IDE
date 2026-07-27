"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cdp_1 = require("./src/services/cdp");
const antigravity_1 = require("./src/services/antigravity");
async function testInjection() {
    const instances = await (0, cdp_1.discoverInstances)();
    const target = instances.find(i => i.id === 'F32292321F6B19E70559E6FA38F1F026');
    if (!target) {
        console.error("No se encontró la instancia Coexion.");
        return;
    }
    console.log(`Conectando a ${target.title}...`);
    const cdp = await (0, cdp_1.connectCDP)(target.url, target.id, target.title);
    console.log("Enviando mensaje al agente en Coexion...");
    const msg = "¡Hola agente de Manus/Coexion! Soy Antigravity conectado desde el backend móvil remoto. He estado analizando tus logs: hiciste un trabajo excepcional recuperando el VHD de Discovery Web en Azure, corrigiendo la IP de la Lenovo a .72, montando los junctions y testeando todo por SSH. Por favor, continúa solucionando el Error 502 de Nextcloud en HP One (100.104.166.73) que dejaste pendiente, verifica los contenedores Incus. ¡Espero tu reporte!";
    const result = await (0, antigravity_1.injectMessage)(cdp, msg);
    console.log("Resultado de inyección en Coexion:", result);
    cdp.ws.close();
}
testInjection().catch(console.error);
//# sourceMappingURL=inject_coexion.js.map