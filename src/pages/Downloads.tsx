import { Download, Terminal, Server, ArrowRight, ShieldCheck, Github } from 'lucide-react';

import { isTauri } from '../utils/env';

export default function Downloads() {
    const API_BASE = isTauri() ? "http://127.0.0.1:8045/api" : "/api";

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-8 animate-fade-in">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent flex items-center gap-3">
                        <Server className="w-8 h-8 text-indigo-400" />
                        Centro de Distribución
                    </h1>
                    <p className="text-content-subtle mt-2 text-lg">
                        Descarga el motor principal de Antigravity Manager y mantén tu ecosistema sincronizado.
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Release Download Card */}
                <div className="bg-surface border border-indigo-500/50 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-indigo-400 transition-all">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Terminal className="w-32 h-32 text-indigo-500" />
                    </div>
                    <div className="flex justify-between items-start mb-2">
                        <h2 className="text-2xl font-semibold flex items-center gap-2">
                            <ShieldCheck className="w-6 h-6 text-green-400" />
                            Instalador Inteligente (.msi)
                        </h2>
                        <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-1 rounded-full border border-indigo-500/30">
                            Recomendado
                        </span>
                    </div>
                    <p className="text-content-subtle mb-4">
                        Descarga el instalador oficial para Windows. <b>Nunca tendrás que volver a descargarlo manualmente:</b> el motor cuenta con Auto-Updater en tiempo real integrado.
                    </p>
                    <a 
                        href="https://github.com/PabloArboledai/draculabo-antigravity-manager-private-backup/releases/latest/download/Antigravity_Manager_4.4.7_x64_en-US.msi"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all hover:scale-105 shadow-lg shadow-indigo-500/25"
                    >
                        <Download className="w-5 h-5" />
                        Descargar Instalador (MSI)
                    </a>
                </div>

                {/* Source Code Download Card */}
                <div className="bg-surface border border-border/50 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-purple-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Github className="w-32 h-32 text-purple-500" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
                        Código Fuente
                    </h2>
                    <p className="text-content-subtle mb-6">
                        Descarga todo el proyecto comprimido en tiempo real. Excluye dependencias pesadas (node_modules/target) para una descarga ultrarrápida.
                    </p>
                    <a 
                        href={`${API_BASE}/downloads/source`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-all hover:scale-105 shadow-lg shadow-purple-500/25"
                    >
                        <Download className="w-5 h-5" />
                        Descargar Código (.zip)
                    </a>
                </div>
            </div>

            {/* Webhook Instructions */}
            <div className="mt-8 bg-surface-hover/30 border border-indigo-500/20 rounded-2xl p-8 shadow-inner">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-indigo-300">
                    <RefreshCw className="w-6 h-6" />
                    Actualización Continua (CI/CD Webhook)
                </h3>
                <p className="text-content-subtle mb-4">
                    Puedes automatizar las actualizaciones del Manager conectándolo con Gitea o GitHub. 
                    Cuando hagas un <code className="bg-black/30 px-2 py-1 rounded text-purple-300">git push</code>, el servidor detectará el evento, descargará el nuevo código y se recompilará solo.
                </p>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 font-mono text-sm space-y-2">
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-400">Endpoint URL (POST):</span>
                        <span className="text-green-400 select-all">https://antigravity.civer.cloud/api/webhook/update</span>
                    </div>
                    <div className="flex flex-col gap-1 mt-4">
                        <span className="text-gray-400">Secret Header:</span>
                        <span className="text-blue-400 select-all">x-update-token: civer_antigravity_secret_2026</span>
                    </div>
                </div>
                <button className="mt-6 flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
                    Ver documentación técnica <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

// Para usar RefreshCw:
import { RefreshCw } from 'lucide-react';
