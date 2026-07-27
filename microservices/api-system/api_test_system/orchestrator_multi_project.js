const io = require('socket.io-client');
const axios = require('axios');

const CONFIG = {
    API_BASE: 'http://127.0.0.1:3050/api',
    WS_BASE: 'http://127.0.0.1:3050'
};

const PROJECTS = [
    {
        name: 'hotel-canino-spa',
        template: 'react-vite-tailwind',
        prompt: 'Una pagina de Casa de cuidado de perros, es como su hotel y spa donde se les darán todos los placeres caninos existentes masajes, jugar con ellos, pasearlos, asearlos, etc... Diseño ultra premium, con Tailwind, animaciones suaves de entrada y un sistema de reserva interactivo ficticio. Usa un esquema de colores cálido (marrón suave, crema y verde bosque). Usa Lucide React para iconos.',
        port: 5401
    },
    {
        name: 'ml-shoppy-portal',
        template: 'vanilla-vite',
        prompt: 'Un sitio de tienda en linea. Los usuarios pueden pegar URLs de sus carritos de Mercado Libre. Debe simular la carga de productos con descripción, precio y enlace. Característica clave: Ofrecer un 20% de descuento total automático sobre el precio de ML. Flujo de pago: Botón de "Pagar 50% Anticipo" y aviso de "50% restante al recibir en domicilio". Diseño limpio inspirado en Mercado Libre (Amarillo y Azul).',
        port: 5402
    },
    {
        name: 'apk-hub-store',
        template: 'react-vite',
        prompt: 'Un portal de descargas de APKs estilo App Store. Secciones: Registro de Desarrolladores, Subida de APKs (con campos de descripción e imagen), Sección de Auditoría Antivirus (muestra status de "Seguro" tras tests simulados). Sección de Testers: Lista de testers con comentarios y calificación por estrellas (1-5). Usa CSS Modules o CSS estándar para un diseño futurista oscuro con acentos neón.',
        port: 5403
    }
];

async function runOrchestration() {
    console.log('\n--- 🏗️ ORQUESTADOR DE MACRO-PROYECTOS CIVER V2 (Robust) ---');
    
    const socket = io(CONFIG.WS_BASE);
    
    socket.on('connect', () => console.log('✅ Sincronizado para monitoreo de logs...'));
    socket.on('log', (log) => {
        if (log.type === 'error') console.log(`[SV-LOG][${log.versionId}] ❌ ${log.text}`);
        else if (log.type === 'success') console.log(`[SV-LOG][${log.versionId}] ✅ ${log.text}`);
    });

    for (const project of PROJECTS) {
        try {
            console.log(`\n\n>>> 🛠️ PROCESANDO: ${project.name.toUpperCase()}`);

            // 1. CREAR PROYECTO
            console.log('- Creando desde template...');
            await axios.post(`${CONFIG.API_BASE}/create`, {
                name: project.name,
                template: project.template
            });

            // 2. INICIALIZAR CHAT (Persistencia)
            const threadId = `auto-${project.name}-${Date.now()}`;
            console.log(`- Registro de hilo: ${threadId}`);
            await axios.post(`${CONFIG.API_BASE}/chat/${project.name}`, {
                id: threadId,
                title: `Auto-Creación: ${project.name}`,
                messages: [{ role: 'user', content: project.prompt, timestamp: new Date().toISOString() }]
            });

            // 3. GENERAR CÓDIGO VÍA IA (STREAMING)
            console.log('- Generando código IA (Timeout: 10m)...');
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('IA Timeout')), 600000);
                axios({
                    url: `${CONFIG.API_BASE}/ai/make/stream`,
                    method: 'POST',
                    data: {
                        versionId: project.name,
                        id: threadId,
                        prompt: project.prompt,
                        model: 'gemini-3-flash',
                        mode: 'make',
                        reasoning: 'Max'
                    },
                    responseType: 'stream',
                    timeout: 600000
                }).then(response => {
                    response.data.on('data', chunk => { /* Streaming... */ });
                    response.data.on('end', () => {
                        clearTimeout(timeout);
                        console.log('  ✅ IA completó la generación.');
                        resolve();
                    });
                }).catch(e => {
                    clearTimeout(timeout);
                    reject(e);
                });
            });

            // 4. INICIALIZAR GIT
            console.log('- Git Init & Commit...');
            await axios.post(`${CONFIG.API_BASE}/git/init`, { versionId: project.name });
            await axios.post(`${CONFIG.API_BASE}/git/commit`, { 
                versionId: project.name, 
                message: 'initial: Automated deployment' 
            });

            // 5. LANZAR SERVIDOR
            console.log(`- Lanzando puerto ${project.port}...`);
            await axios.post(`${CONFIG.API_BASE}/start`, {
                version: project.name,
                port: project.port
            });

            // 6. SNAPSHOT
            console.log('- Creando Snapshot de seguridad...');
            await axios.post(`${CONFIG.API_BASE}/ai/snapshot`, {
                versionId: project.name,
                message: 'V1.0 Stable'
            });

            console.log(`\n✅ ${project.name.toUpperCase()} LISTO.`);

        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            console.error(`\n❌ ERROR EN ${project.name}:`, msg);
            if (msg.includes('already exists')) {
                console.log('--- Saltando creación por existir ya el directorio ---');
            }
        }
    }

    console.log('\n--- 🏁 MACRO-DESPLIEGUE FINALIZADO ---');
    setTimeout(() => {
        socket.disconnect();
        process.exit(0);
    }, 5000);
}

runOrchestration();
