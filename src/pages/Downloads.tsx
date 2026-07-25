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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Release Download Card - Windows */}
                <div className="bg-surface border border-indigo-500/50 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-indigo-400 transition-all flex flex-col h-full">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Terminal className="w-24 h-24 text-indigo-500" />
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-2 gap-2">
                        <h2 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
                            <ShieldCheck className="w-6 h-6 text-green-400 shrink-0" />
                            Windows (.msi)
                        </h2>
                        <span className="bg-indigo-500/20 text-indigo-300 text-[10px] sm:text-xs px-2 py-1 rounded-full border border-indigo-500/30 whitespace-nowrap">
                            Auto-Updater
                        </span>
                    </div>
                    <p className="text-content-subtle mb-4 flex-grow text-sm md:text-base">
                        Instalador oficial para Windows con motor de actualizaciones en tiempo real integrado.
                    </p>
                    <a 
                        href={`${API_BASE}/downloads/github_msi`}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all hover:scale-105 shadow-lg shadow-indigo-500/25 w-full text-sm sm:text-base"
                    >
                        <Download className="w-5 h-5 shrink-0" />
                        Descargar Windows
                    </a>
                </div>

                {/* Release Download Card - Linux */}
                <div className="bg-surface border border-orange-500/50 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-orange-400 transition-all flex flex-col h-full">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Terminal className="w-24 h-24 text-orange-500" />
                    </div>
                    <div className="flex justify-between items-start mb-2">
                        <h2 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
                            Linux (.AppImage)
                        </h2>
                    </div>
                    <p className="text-content-subtle mb-4 flex-grow text-sm md:text-base">
                        Versión portátil para distribuciones de Linux (Ubuntu, Debian, Fedora, Arch).
                    </p>
                    <a 
                        href={`${API_BASE}/downloads/linux`}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-xl transition-all hover:scale-105 shadow-lg shadow-orange-500/25 w-full text-sm sm:text-base"
                    >
                        <Download className="w-5 h-5 shrink-0" />
                        Descargar Linux
                    </a>
                </div>

                {/* Release Download Card - Android */}
                <div className="bg-surface border border-green-500/50 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-green-400 transition-all flex flex-col h-full">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Terminal className="w-24 h-24 text-green-500" />
                    </div>
                    <div className="flex justify-between items-start mb-2">
                        <h2 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
                            Android (.apk)
                        </h2>
                    </div>
                    <p className="text-content-subtle mb-4 flex-grow text-sm md:text-base">
                        Aplicación móvil para supervisar el ecosistema desde tu dispositivo Android.
                    </p>
                    <a 
                        href={`${API_BASE}/downloads/android`}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl transition-all hover:scale-105 shadow-lg shadow-green-500/25 w-full text-sm sm:text-base"
                    >
                        <Download className="w-5 h-5 shrink-0" />
                        Descargar Android
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
