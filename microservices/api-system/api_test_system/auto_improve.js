const axios = require('axios');
const io = require('socket.io-client');
const fs = require('fs-extra');
const path = require('path');

const CONFIG = {
    API_BASE: 'http://localhost:5223/api',
    WS_BASE: 'http://localhost:5223',
    PROJECT_ID: 'apk-hub-store'
};

const PROMPT = "Agrega mocks hermosos de muchas aplicaciones de diferentes estilos y categorías (Juegos, Utilidades, Productividad, etc.) igual que en las tiendas reales, y por favor dale un diseño de interfaz de usuario espectacular inspirado puramente en la App Store de Apple (tarjetas de recomendación grandes de 'Hoy', scroll horizontal fluido, sombras suaves, y diseño cristalino/glassmorphism). Quiero que se vea extremadamente premium.";

async function autoImprove() {
    console.log(`\n--- 🚀 INICIANDO AUTO-MEJORA: ${CONFIG.PROJECT_ID} ---`);
    const socket = io(CONFIG.WS_BASE);

    socket.on('connect', () => console.log('✅ Sincronizado para monitoreo WebSocket...'));

    let isThinking = false;
    socket.on('ai_stream_token', (data) => {
        if (data.versionId === CONFIG.PROJECT_ID) {
            let token = data.token;
            if (token.includes('<think>')) {
                isThinking = true;
                process.stdout.write('\n[PENSANDO]: ');
                token = token.replace('<think>', '');
            }
            if (token.includes('</think>')) {
                isThinking = false;
                token = token.replace('</think>', '');
                process.stdout.write('\n[RESPOSICIÓN]: ');
            }
            process.stdout.write(token);
        }
    });

    try {
        console.log('Obteniendo historial y preparando prompt (Timeout: 10m)...');
        
        const chatsDir = path.join(__dirname, '../Civer_Labs', CONFIG.PROJECT_ID, '.lab_history', 'chats');
        let latestThreadId = `auto-improve-${Date.now()}`;
        let msgList = [];
        let title = 'Mejoras visuales automáticas';

        if (fs.existsSync(chatsDir)) {
            const files = fs.readdirSync(chatsDir);
            if (files.length > 0) {
               // Tomar el archivo de chat más nuevo
               const sortedFiles = files.map(f => ({ name: f, time: fs.statSync(path.join(chatsDir, f)).mtime.getTime() }))
                                        .sort((a, b) => b.time - a.time);
               latestThreadId = sortedFiles[0].name.replace('.json', '');
               
               const oldData = fs.readJsonSync(path.join(chatsDir, sortedFiles[0].name));
               msgList = oldData.messages || [];
               title = oldData.title || title;
            }
        }

        // Agregar envío de usuario al JSON
        msgList.push({ role: 'user', content: PROMPT, timestamp: new Date().toISOString() });
        
        await axios.post(`${CONFIG.API_BASE}/chat/${CONFIG.PROJECT_ID}`, {
            id: latestThreadId,
            title: title,
            messages: msgList
        });

        console.log('Disparando IA Generator...');
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('IA Timeout')), 600000);
            axios({
                url: `${CONFIG.API_BASE}/ai/make/stream`,
                method: 'POST',
                data: {
                    versionId: CONFIG.PROJECT_ID,
                    id: latestThreadId,
                    prompt: PROMPT,
                    model: 'gemini-3-flash',
                    mode: 'make',
                    reasoning: 'Max'
                },
                responseType: 'stream'
            }).then(response => {
                response.data.on('data', chunk => { /* Streaming manejado por WS listener arriba */ });
                response.data.on('end', () => {
                    clearTimeout(timeout);
                    console.log('\n\n✅ IA completó la generación de MEJORA.');
                    resolve();
                });
            }).catch(e => {
                clearTimeout(timeout);
                reject(e);
            });
        });

    } catch (err) {
        console.error(`\n❌ ERROR EN MEJORA:`, err.message);
    }

    setTimeout(() => {
        socket.disconnect();
        process.exit(0);
    }, 5000);
}

autoImprove();
