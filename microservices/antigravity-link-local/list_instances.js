"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cdp_1 = require("./src/services/cdp");
async function listAll() {
    const instances = await (0, cdp_1.discoverInstances)();
    console.log("Instancias abiertas en VS Code (CDP):");
    instances.forEach(i => console.log(`- ID: ${i.id} | Title: ${i.title}`));
}
listAll().catch(console.error);
//# sourceMappingURL=list_instances.js.map