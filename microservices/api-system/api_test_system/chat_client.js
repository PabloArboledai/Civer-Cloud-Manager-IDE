const io = require('socket.io-client');
const axios = require('axios');
const readline = require('readline');
const fs = require('fs-extra');
const path = require('path');

const CONFIG = {
    API_BASE: 'http://127.0.0.1:3050/api',
    WS_BASE: 'http://127.0.0.1:3050',
    PROJECT_ID: 'hola'
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const threadId = `term-${Date.now()}`;
let messages = [];
let currentModel = 'gemini-3-flash';
let currentReasoning = 'Max';
let attachments = [];
let isAiThinking = false;

// Mock de chalk para compatibilidad total
const style = {
    blue: (t) => `\x1b[34m${t}\x1b[0m`,
    green: (t) => `\x1b[32m${t}\x1b[0m`,
    yellow: (t) => `\x1b[33m${t}\x1b[0m`,
    magenta: (t) => `\x1b[35m${t}\x1b[0m`,
    cyan: (t) => `\x1b[36m${t}\x1b[0m`,
    gray: (t) => `\x1b[90m${t}\x1b[0m`,
    bold: (t) => `\x1b[1m${t}\x1b[0m`
};

async function saveChat() {
    try {
        await axios.post(`${CONFIG.API_BASE}/chat/${CONFIG.PROJECT_ID}`, {
            id: threadId,
            title: messages[0]?.content?.substring(0, 30) || 'Chat desde Terminal',
            messages: messages
        });
    } catch (err) {
        // Silencioso para no romper el flujo de la terminal
    }
}

async function startChat() {
    console.log(style.magenta(style.bold('\n--- 🚀 SUPER-AGENTE TERMINAL (BIDIRECCIONAL) ---')));
    console.log(style.cyan(`Sesión Activa: ${threadId}`));
    console.log(style.gray('Comandos: /model [nombre], /reasoning [max|med|low], /attach [path], /clear, exit\n'));
    
    const socket = io(CONFIG.WS_BASE);

    socket.on('connect', () => {
        console.log(style.green('✅ Sincronizado con el Dashboard Web'));
        askUser();
    });

    // LISTENER: Tokens de la IA (pueden venir de la terminal o de la web)
    socket.on('ai_stream_token', (data) => {
        if (data.versionId === CONFIG.PROJECT_ID && data.threadId === threadId) {
            let token = data.token;
            
            // Lógica de razonamiento
            if (token.includes('<think>')) {
                isAiThinking = true;
                process.stdout.write(style.gray('\n[PENSANDO]: '));
                token = token.replace('<think>', '');
            }
            if (token.includes('</think>')) {
                isAiThinking = false;
                token = token.replace('</think>', '');
                process.stdout.write('\n' + style.magenta('[RESPUESTA]: '));
            }

            if (isAiThinking) {
                process.stdout.write(style.gray(token));
            } else {
                process.stdout.write(token);
            }
        }
    });

    // LISTENER: Mensajes de usuario (desde el dashboard)
    socket.on('chat_user_message', (data) => {
        if (data.versionId === CONFIG.PROJECT_ID && data.threadId === threadId) {
            // Si el último mensaje NO es el que acabamos de enviar (evitar eco infinito)
            const lastMsg = data.lastMessage;
            if (lastMsg && lastMsg.role === 'user' && !messages.find(m => m.timestamp === lastMsg.timestamp)) {
                console.log(style.blue(`\n\n[WEB]: ${lastMsg.content}`));
                messages = data.messages; // Sincronizar historial local
            }
        }
    });

    async function handleCommand(cmd, args) {
        switch (cmd) {
            case '/model':
                currentModel = args[0] || currentModel;
                console.log(style.yellow(`Modo: Modelo cambiado a ${currentModel}`));
                break;
            case '/reasoning':
                currentReasoning = args[0] || currentReasoning;
                console.log(style.yellow(`Modo: Razonamiento cambiado a ${currentReasoning}`));
                break;
            case '/attach':
                const filePath = args[0];
                if (fs.existsSync(filePath)) {
                    const data = fs.readFileSync(filePath);
                    const mime = path.extname(filePath) === '.png' ? 'image/png' : 'image/jpeg';
                    attachments.push({
                        name: path.basename(filePath),
                        type: mime,
                        data: `data:${mime};base64,${data.toString('base64')}`
                    });
                    console.log(style.green(`Relacionado: Archivo '${path.basename(filePath)}' adjuntado.`));
                } else {
                    console.log(style.red(`Error: Archivo no encontrado en ${filePath}`));
                }
                break;
            case '/clear':
                attachments = [];
                console.log(style.yellow('Limpieza: Adjuntos eliminados.'));
                break;
            default:
                console.log(style.red('Comando no reconocido.'));
        }
    }

    function askUser() {
        rl.question(style.bold('\n> '), async (input) => {
            if (input.toLowerCase() === 'exit') {
                socket.disconnect();
                rl.close();
                process.exit(0);
            }

            if (input.startsWith('/')) {
                const parts = input.split(' ');
                await handleCommand(parts[0], parts.slice(1));
                return askUser();
            }

            // Guardar localmente
            const userMsg = { role: 'user', content: input, timestamp: new Date().toISOString() };
            messages.push(userMsg);
            
            // Persistir y notificar (vía broadcast en el servidor)
            await saveChat();

            console.log(style.magenta('\n🤖 Agente reaccionando...'));
            
            try {
                await axios.post(`${CONFIG.API_BASE}/ai/make/stream`, {
                    versionId: CONFIG.PROJECT_ID,
                    id: threadId,
                    prompt: input,
                    model: currentModel,
                    reasoning: currentReasoning,
                    mode: 'make',
                    attachments: attachments
                });
                
                // Reiniciar adjuntos después de enviar
                attachments = [];
                // La terminal no imprime nada aquí porque los tokens llegan por socket
            } catch (err) {
                console.error(style.red('\n❌ Error de red:'), err.message);
                askUser();
            }
        });
    }
}

startChat();
