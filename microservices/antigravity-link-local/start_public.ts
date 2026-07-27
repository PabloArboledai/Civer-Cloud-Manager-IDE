import { AntigravityServer } from './src/server/index';
import { TunnelManager } from './src/services/tunnels';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function main() {
    process.env.AG_STRICT_WORKBENCH_ONLY = 'false';
    console.log("🚀 Iniciando AntigravityServer en backend aislado sin HTTPS local (para evitar error de clave)...");
    // Inicializar servidor en 3002, false para useHttps
    const server = new AntigravityServer(3002, __dirname, process.cwd(), false, '');
    const { localUrl, token } = await server.start();
    console.log("✅ Servidor HTTP local iniciado correctamente:", localUrl);
    
    // Guardar el token de acceso para pasarlo fácilmente si es necesario
    const authUrl = `${localUrl}/?token=${token}`;
    console.log("🔐 Token cargado:", token);
    
    let cloudflaredToken = undefined;
    let cloudflaredHostname = undefined;
    try {
        const credsFile = path.resolve(__dirname, '..', '..', 'Respaldos-y-Sync', 'mesh-shared-vault', 'secrets', 'CREDENTIALS_DB.json');
        if (fs.existsSync(credsFile)) {
            const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
            if (creds.cloudflare_tunnels?.openclaw_tunnel?.token) {
                cloudflaredToken = creds.cloudflare_tunnels.openclaw_tunnel.token;
                cloudflaredHostname = creds.cloudflare_tunnels.openclaw_tunnel.hostname;
                console.log("🔐 Credenciales de Cloudflare encontradas. Iniciando túnel autenticado hacia " + cloudflaredHostname);
            }
        }
    } catch (e) {
        console.log("⚠️ No se pudieron leer las credenciales de Cloudflare, usando túnel anónimo.", (e as Error).message);
    }

    console.log("🌐 Configuración pública administrada externamente. Iniciando localtunnel como fallback de desarrollo...");
    try {
        const tunnel = await TunnelManager.connect({
            provider: 'localtunnel',
            port: 3002,
            useHttps: false
        }, (msg) => console.log(msg));
        
        const publicUrl = `${tunnel.url}/?token=${token}`;
        
        console.log("\n========================================================");
        console.log("🟢 SERVIDOR PUBLICADO EXITOSAMENTE!");
        console.log("Cualquier dispositivo en cualquier parte del mundo puede conectarse aquí:");
        console.log("\n👉 " + publicUrl + " 👈\n");
        console.log("========================================================\n");
        
        fs.writeFileSync(path.join(__dirname, 'public_url.txt'), publicUrl);
        
    } catch (e) {
        console.error("❌ Error al iniciar el túnel público:", e);
        console.log("Intentando fallback a localtunnel...");
        try {
            const tunnelFallback = await TunnelManager.connect({
                provider: 'localtunnel',
                port: 3002,
                useHttps: false
            }, (msg) => console.log(msg));
            const publicUrlFallback = `${tunnelFallback.url}/?token=${token}`;
            console.log("\n👉 URL Pública (Localtunnel): " + publicUrlFallback + " 👈\n");
            fs.writeFileSync(path.join(__dirname, 'public_url.txt'), publicUrlFallback);
        } catch (e2) {
            console.error("❌ Ambos túneles fallaron:", e2);
        }
    }
}

main().catch(err => {
    console.error("Error fatal en el servidor:", err);
});
