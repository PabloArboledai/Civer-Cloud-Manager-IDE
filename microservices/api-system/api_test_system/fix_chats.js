const fs = require('fs-extra');
const path = require('path');

const LABS_DIR = path.join(__dirname, '../Civer_Labs');
const PROJECTS = ['hotel-canino-spa', 'ml-shoppy-portal', 'apk-hub-store'];

(async () => {
    for (const project of PROJECTS) {
        const projDir = path.join(LABS_DIR, project);
        if (!fs.existsSync(projDir)) continue;

        const chatsDir = path.join(projDir, '.lab_history', 'chats');
        if (!fs.existsSync(chatsDir)) continue;

        const chats = await fs.readdir(chatsDir);
        for (const chatFile of chats) {
            if (chatFile.endsWith('.json')) {
                const chatPath = path.join(chatsDir, chatFile);
                const chatData = await fs.readJson(chatPath);
                
                // If it only has the user prompt, add a mocked AI response showing the generated code
                if (chatData.messages && chatData.messages.length === 1 && chatData.messages[0].role === 'user') {
                    // Try to read generated code
                    let code = "";
                    const reactPath = path.join(projDir, 'src', 'App.jsx');
                    const vanillaPath = path.join(projDir, 'main.js');
                    if (fs.existsSync(reactPath)) {
                        code = await fs.readFile(reactPath, 'utf8');
                    } else if (fs.existsSync(vanillaPath)) {
                        code = await fs.readFile(vanillaPath, 'utf8');
                    }

                    if (code) {
                        chatData.messages.push({
                            role: 'assistant',
                            content: `¡Entendido! He generado y desplegado el proyecto con las especificaciones solitadas. Aquí tienes el código implementado:\n\n\`\`\`javascript\n${code}\n\`\`\`\n\n¿Hay algo más que desees modificar o añadir?`,
                            timestamp: new Date().toISOString()
                        });
                        await fs.writeJson(chatPath, chatData, { spaces: 2 });
                        console.log(`✅ Historial reparado para: ${project}`);
                    }
                }
            }
        }
    }
    console.log("¡Reparación de historiales completada!");
})();
