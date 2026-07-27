import { connectCDP, discoverInstances } from './src/services/cdp';

async function main() {
    process.env.AG_STRICT_WORKBENCH_ONLY = 'false';
    const instances = await discoverInstances();
    const ag2 = instances.find(i => i.port === 63140 || i.title.includes('Antigravity'));
    if (!ag2) return;

    const conn = await connectCDP(ag2.url, ag2.id, ag2.title);
    const script = `(() => {
        const containers = [];
        let cur = document.querySelector('[contenteditable="true"]');
        while(cur) {
            containers.push({ tag: cur.tagName, id: cur.id, class: cur.className });
            cur = cur.parentElement;
        }
        return containers;
    })()`;
    const res = await conn.call("Runtime.evaluate", { expression: script, returnByValue: true });
    console.log("Hierarchy:", JSON.stringify(res.result?.value, null, 2));
    conn.ws.close();
}

main().catch(console.error);
