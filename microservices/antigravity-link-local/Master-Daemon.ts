import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { discoverInstances } from './src/services/cdp';

// Known workspaces map for auto-launching
const WORKSPACE_MAP: Record<string, string> = {
    'Coexion': 'C:\\Users\\Usuario\\Desktop\\Coexion',
    'DiscoveryWeb': 'C:\\Users\\Usuario\\Desktop\\Coexion\\DiscoveryWeb',
    'Extensiones': 'C:\\Users\\Usuario\\Desktop\\Proyectos\\Extensiones',
    'AutoGravity': 'C:\\Users\\Usuario\\Desktop\\Proyectos\\Extensiones\\autogravity',
    'FengIsland': 'C:\\Users\\Usuario\\Desktop\\Proyectos\\FengIsland' // example
};

const busDir = path.join(os.homedir(), '.gemini', 'antigravity', 'bus');

console.log("🔥 Master Orchestrator Daemon Iniciado");
console.log(`Vigilando bus: ${busDir}`);

setInterval(async () => {
    try {
        if (!fs.existsSync(busDir)) return;
        const files = fs.readdirSync(busDir);
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            const filePath = path.join(busDir, file);
            let content;
            try {
                content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch { continue; }

            const target = content.targetWorkspace;
            if (!target || target === '*') continue;

            // Check if workspace is actively running via CDP
            const instances = await discoverInstances();
            
            // Just assume if any instance is alive, we let the extension handle it.
            // But we can't easily map a CDP instance to a workspace name without asking the extension.
            // However, we can check if the telemetry file is fresh!
            const telemetryFile = path.join(os.homedir(), '.gemini', 'antigravity', 'telemetry', `${target}.json`);
            
            let isAlive = false;
            if (fs.existsSync(telemetryFile)) {
                const stat = fs.statSync(telemetryFile);
                if (Date.now() - stat.mtimeMs < 10000) { // Updated in the last 10 seconds
                    isAlive = true;
                }
            }

            if (!isAlive && WORKSPACE_MAP[target]) {
                console.log(`[Auto-Launch] Workspace '${target}' is asleep or closed. Lanzando IDE...`);
                
                // Prevent infinite launching loop by touching the file to update its mtime
                if (!fs.existsSync(path.dirname(telemetryFile))) {
                    fs.mkdirSync(path.dirname(telemetryFile), { recursive: true });
                }
                fs.writeFileSync(telemetryFile, JSON.stringify({ status: 'launching', timestamp: Date.now() }));
                
                // Attempt to launch with CDP for the Orchestrator
                exec(`antigravity "${WORKSPACE_MAP[target]}" --remote-debugging-port=9004`, (error) => {
                    if (error) console.error(`Error launching ${target}:`, error);
                    else console.log(`[Auto-Launch] ${target} launched successfully.`);
                });
                
                // Wait for the IDE to open and the extension to process the file
                // The file stays in the bus/ folder until the extension wakes up and deletes it!
            }
        }
    } catch (e) {
        console.error("Daemon error:", e);
    }
}, 3000);
