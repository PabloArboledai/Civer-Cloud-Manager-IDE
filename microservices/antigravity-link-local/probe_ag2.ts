import { connectCDP, discoverInstances } from './src/services/cdp';

async function main() {
    process.env.AG_STRICT_WORKBENCH_ONLY = 'false';
    const instances = await discoverInstances();
    console.log("Found instances:", instances.map(i => `${i.port}: ${i.title}`));

    const ag2 = instances.find(i => i.port === 63140 || i.title.includes('Antigravity'));
    if (!ag2) {
        console.log("Antigravity 2.0 instance not found!");
        return;
    }

    console.log("Connecting to:", ag2.title, ag2.url);
    const conn = await connectCDP(ag2.url, ag2.id, ag2.title);

    const script = `(() => {
        const textareas = Array.from(document.querySelectorAll('textarea'));
        const contenteditables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
        const buttons = Array.from(document.querySelectorAll('button'));
        
        return {
            textareas: textareas.map(t => ({ id: t.id, class: t.className, placeholder: t.placeholder })),
            contenteditables: contenteditables.map(c => ({ id: c.id, class: c.className, role: c.getAttribute('role') })),
            buttons: buttons.map(b => ({ id: b.id, class: b.className, text: b.textContent, aria: b.getAttribute('aria-label') })).filter(b => b.text && b.text.toLowerCase().includes('send') || (b.aria && b.aria.toLowerCase().includes('send')))
        };
    })()`;

    for (const ctx of conn.contexts) {
        const res = await conn.call("Runtime.evaluate", {
            expression: script,
            returnByValue: true,
            contextId: ctx.id
        });
        console.log(`Context ${ctx.id}:`, JSON.stringify(res.result?.value, null, 2));
    }

    const res = await conn.call("Runtime.evaluate", {
        expression: script,
        returnByValue: true
    });
    console.log(`Main context:`, JSON.stringify(res.result?.value, null, 2));

    conn.ws.close();
}

main().catch(console.error);
