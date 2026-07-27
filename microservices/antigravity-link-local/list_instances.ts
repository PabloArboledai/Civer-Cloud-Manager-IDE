import { discoverInstances } from './src/services/cdp';

async function listAll() {
    const instances = await discoverInstances();
    console.log("Instancias abiertas en VS Code (CDP):");
    instances.forEach(i => console.log(`- ID: ${i.id} | Title: ${i.title}`));
}
listAll().catch(console.error);
