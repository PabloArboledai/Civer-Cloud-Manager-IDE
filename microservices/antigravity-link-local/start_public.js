"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./src/server/index");
const tunnels_1 = require("./src/services/tunnels");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function main() {
    console.log("🚀 Iniciando AntigravityServer en backend aislado sin HTTPS local (para evitar error de clave)...");
    // Inicializar servidor en 3000, false para useHttps
    const server = new index_1.AntigravityServer(3000, __dirname, process.cwd(), false, '');
    const { localUrl, token } = await server.start();
    console.log("✅ Servidor HTTP local iniciado correctamente:", localUrl);
    // Guardar el token de acceso para pasarlo fácilmente si es necesario
    const authUrl = `${localUrl}/?token=${token}`;
    console.log("🔐 Token cargado:", token);
    console.log("🌐 Conectando túnel Cloudflared para acceso global público (con HTTPS oficial)...");
    try {
        const tunnel = await tunnels_1.TunnelManager.connect({
            provider: 'cloudflared',
            port: 3000,
            useHttps: false // No https localmente
        }, (msg) => console.log(msg));
        const publicUrl = `${tunnel.url}/?token=${token}`;
        console.log("\n========================================================");
        console.log("🟢 SERVIDOR PUBLICADO EXITOSAMENTE!");
        console.log("Cualquier dispositivo en cualquier parte del mundo puede conectarse aquí:");
        console.log("\n👉 " + publicUrl + " 👈\n");
        console.log("========================================================\n");
        fs.writeFileSync(path.join(__dirname, 'public_url.txt'), publicUrl);
    }
    catch (e) {
        console.error("❌ Error al iniciar el túnel público:", e);
        console.log("Intentando fallback a localtunnel...");
        try {
            const tunnelFallback = await tunnels_1.TunnelManager.connect({
                provider: 'localtunnel',
                port: 3000,
                useHttps: false
            }, (msg) => console.log(msg));
            const publicUrlFallback = `${tunnelFallback.url}/?token=${token}`;
            console.log("\n👉 URL Pública (Localtunnel): " + publicUrlFallback + " 👈\n");
            fs.writeFileSync(path.join(__dirname, 'public_url.txt'), publicUrlFallback);
        }
        catch (e2) {
            console.error("❌ Ambos túneles fallaron:", e2);
        }
    }
}
main().catch(err => {
    console.error("Error fatal en el servidor:", err);
});
//# sourceMappingURL=start_public.js.map