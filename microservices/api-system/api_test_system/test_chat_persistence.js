const axios = require('axios');

const CONFIG = {
    API_BASE: 'http://127.0.0.1:3050/api',
    PROJECT_ID: 'hola'
};

async function testPersistence() {
    const threadId = `term-test-${Date.now()}`;
    const messages = [
        { role: 'user', content: 'Prueba de persistencia desde script', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Respuesta persistida correctamente', timestamp: new Date().toISOString() }
    ];

    console.log(`Enviando chat con ID: ${threadId}`);
    
    try {
        const res = await axios.post(`${CONFIG.API_BASE}/chat/${CONFIG.PROJECT_ID}`, {
            id: threadId,
            title: 'Test Persistencia Terminal',
            messages: messages
        });

        if (res.data.success) {
            console.log('✅ Chat persistido con éxito.');
            
            // Verificar si aparece en la lista
            const listRes = await axios.get(`${CONFIG.API_BASE}/chat/${CONFIG.PROJECT_ID}`);
            const found = listRes.data.find(c => c.id === threadId);
            if (found) {
                console.log('✅ Chat encontrado en la lista de conversaciones.');
            } else {
                console.error('❌ Chat NO encontrado en la lista.');
            }
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

testPersistence();
