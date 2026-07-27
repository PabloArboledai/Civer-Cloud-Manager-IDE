const http = require('http');
const WebSocket = require('ws');

async function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function test() {
    try {
        const version = await getJson('http://127.0.0.1:9004/json/version');
        console.log("Browser Target:", version.webSocketDebuggerUrl);

        const pages = await getJson('http://127.0.0.1:9004/json/list');
        const workbench = pages.find(p => p.title.includes('Visual Studio Code') || p.url.includes('workbench'));
        console.log("Page TargetId:", workbench.id);

        if (!version.webSocketDebuggerUrl) {
            console.log("No browser target available.");
            return;
        }

        const ws = new WebSocket(version.webSocketDebuggerUrl);
        ws.on('open', () => {
            console.log("Connected to browser.");
            ws.send(JSON.stringify({
                id: 1,
                method: 'Target.attachToTarget',
                params: { targetId: workbench.id, flatten: true }
            }));
        });

        ws.on('message', (msg) => {
            console.log("Received:", msg.toString());
            const data = JSON.parse(msg.toString());
            if (data.id === 1) {
                console.log("Attached to session:", data.result.sessionId);
                ws.close();
            }
        });

    } catch (e) {
        console.error(e);
    }
}
test();
