import { connectCDP, discoverInstances } from './src/services/cdp';
import { injectMessage } from './src/services/antigravity';

async function testInjection() {
    console.log("Descubriendo instancias de VS Code (puerto 9004)...");
    const instances = await discoverInstances();
    if (instances.length === 0) {
        console.error("No se encontró ninguna instancia de VS Code con CDP habilitado.");
        return;
    }
    const target = instances.find(i => i.title.includes('Antigravity') || i.title.includes('Extension')) || instances[0];
    console.log(`Conectando a ${target.title}...`);
    const cdp = await connectCDP(target.url, target.id, target.title);
    
    console.log("Enviando mensaje al agente...");
    const msg = "Mensaje automático desde tu asistente: Acabo de comprobar que mi acceso de sistema 'webhook' funciona impecablemente. He verificado los logs de las conversaciones de Discovery Web, Manus Agent SSH, y tu conexión Android. Todo está bajo mi control y fluyendo correctamente en tiempo real.";
    const result = await injectMessage(cdp, msg);
    console.log("Resultado de inyección:", result);
    cdp.ws.close();
}

testInjection().catch(console.error);
