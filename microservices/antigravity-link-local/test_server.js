const http = require('http');
const fs = require('fs');

const TOKEN = 'f4dwv9fs5lcy89y9lgc558';
const URL = `http://127.0.0.1:3000/snapshot?token=${TOKEN}`;

http.get(URL, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const parsedData = JSON.parse(rawData);
            if (parsedData.error) {
                console.log("Error del servidor:", parsedData.error);
                return;
            }
            
            console.log("--- METADATOS DEL SNAPSHOT ---");
            console.log("Longitud HTML:", parsedData.html ? parsedData.html.length : 0);
            console.log("Señales de Superficie:", JSON.stringify(parsedData.surfaceSignals, null, 2));
            console.log("Meta de Controles:", JSON.stringify(parsedData.controlsMeta, null, 2));
            
            // Extraer el texto de los mensajes si es posible, buscando data-message-id o similar
            console.log("\n--- ÚLTIMOS MENSAJES EN PANTALLA ---");
            const html = parsedData.html || '';
            const messageRegex = /<[^>]+class="[^"]*message[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/g;
            let match;
            let count = 0;
            while ((match = messageRegex.exec(html)) !== null && count < 5) {
                // simple strip tags
                let text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                if (text.length > 200) text = text.substring(0, 200) + '...';
                console.log(`[Mensaje ${++count}]:`, text);
            }
            if (count === 0) {
                 // Try another heuristic for Cline/Roo text
                 const pRegex = /<p>([\s\S]*?)<\/p>/g;
                 let textCount = 0;
                 while ((match = pRegex.exec(html)) !== null && textCount < 3) {
                     let text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                     if (text.length > 30) {
                         console.log(`[Texto ${++textCount}]:`, text);
                     }
                 }
            }
            
            console.log("\n✅ Prueba de lectura completada con éxito.");
        } catch (e) {
            console.error(e.message);
        }
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
