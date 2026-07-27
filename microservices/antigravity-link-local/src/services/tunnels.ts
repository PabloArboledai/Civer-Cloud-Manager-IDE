import { spawn } from 'child_process';
import localtunnel from 'localtunnel';
// @ts-ignore
import ngrok from '@ngrok/ngrok';
// @ts-ignore
import { bin } from 'cloudflared';

export type TunnelProvider = 'auto' | 'localtunnel' | 'ngrok' | 'cloudflared';

export interface TunnelConfig {
    provider: TunnelProvider;
    port: number;
    useHttps?: boolean;
    ngrokToken?: string;
    cloudflaredToken?: string;
    cloudflaredHostname?: string;
}

export interface TunnelResult {
    url: string;
    close: () => Promise<void>;
}

const activeChildProcesses = new Set<any>();

export class TunnelManager {
    static async connect(config: TunnelConfig, log?: (msg: string) => void): Promise<TunnelResult> {
        const providers: TunnelProvider[] = config.provider === 'auto'
            ? ['ngrok', 'cloudflared', 'localtunnel']
            : [config.provider];

        if (log) log(`[TunnelManager] Initializing tunnel for port ${config.port} via [${providers.join(', ')}]`);

        let lastError: Error | null = null;

        for (const p of providers) {
            try {
                if (p === 'ngrok') {
                    if (!config.ngrokToken) throw new Error('Ngrok token missing');
                    if (log) log(`[TunnelManager] Attempting ngrok...`);
                    const url = await this.startNgrok(config.port, config.ngrokToken);
                    if (log) log(`[TunnelManager] Ngrok success: ${url}`);
                    return { url, close: async () => { await ngrok.disconnect(); } };
                }
                else if (p === 'cloudflared') {
                    if (log) log(`[TunnelManager] Attempting cloudflared...`);
                    const result = await this.startCloudflared(config, log);
                    if (log) log(`[TunnelManager] Cloudflared success: ${result.url}`);
                    return result;
                }
                else if (p === 'localtunnel') {
                    if (log) log(`[TunnelManager] Attempting localtunnel...`);
                    const tunnel = await this.startLocaltunnel(config.port, !!config.useHttps);
                    if (log) log(`[TunnelManager] Localtunnel success: ${tunnel.url}`);
                    return { url: tunnel.url, close: async () => { tunnel.close(); } };
                }
            } catch (e) {
                lastError = e as Error;
                if (log) log(`[TunnelManager] Provider ${p} failed: ${lastError.message}`);
                console.warn(`[TunnelManager] Provider ${p} failed:`, e);
            }
        }

        throw new Error(`All tunnel providers failed. Last error: ${lastError?.message}`);
    }

    static async killAllTunnels(log?: (msg: string) => void) {
        if (log) log(`[TunnelManager] Cleaning up ${activeChildProcesses.size} active child processes...`);
        for (const child of activeChildProcesses) {
            try {
                child.kill();
            } catch (e) {
                if (log) log(`[TunnelManager] Failed to kill process: ${e}`);
            }
        }
        activeChildProcesses.clear();
    }

    private static async startLocaltunnel(port: number, useHttps: boolean): Promise<localtunnel.Tunnel> {
        return await Promise.race([
            localtunnel({ port, local_https: useHttps, allow_invalid_cert: useHttps }),
            new Promise<localtunnel.Tunnel>((_, reject) =>
                setTimeout(() => reject(new Error('Localtunnel allocation timed out')), 5000)
            )
        ]);
    }

    private static async startNgrok(port: number, token: string): Promise<string> {
        await ngrok.authtoken(token);
        const connectPromise = ngrok.connect({ addr: port });
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Ngrok connection timed out (10s)')), 10000)
        );
        const listener = await Promise.race([connectPromise, timeoutPromise]) as any;
        return listener.url()!;
    }

    private static async startCloudflared(config: TunnelConfig, log?: (msg: string) => void): Promise<TunnelResult> {
        return new Promise((resolve, reject) => {
            let resolved = false;
            let url = '';
            
            const useHttps = !!config.useHttps;
            const port = config.port;
            let args: string[];

            if (config.cloudflaredToken) {
                args = ['tunnel', '--no-autoupdate', 'run', '--protocol', 'http2', '--token', config.cloudflaredToken];
                url = config.cloudflaredHostname ? `https://${config.cloudflaredHostname}` : 'https://[custom-domain]';
            } else {
                const localUrl = `${useHttps ? 'https' : 'http'}://localhost:${port}`;
                args = ['tunnel', '--url', localUrl];
                if (useHttps) {
                    args.push('--no-tls-verify');
                }
            }

            if (log) log(`[TunnelManager] Spawning cloudflared with args: ${args.join(' ')}`);

            // The 'cloudflared' package exports { bin: string } which is the path to the binary.
            const child = spawn(bin, args);
            activeChildProcesses.add(child);

            const cleanup = () => {
                activeChildProcesses.delete(child);
                try { child.kill(); } catch { }
            };

            child.stderr.on('data', (data) => {
                const out = data.toString();
                if (log) log(`[Cloudflared Debug] ${out}`);

                // Handle URL resolution depending on auth mode
                if (config.cloudflaredToken) {
                    if (out.includes('Registered tunnel') || out.includes('Connection') || out.includes('INF Connection')) {
                        if (!resolved) {
                            resolved = true;
                            resolve({ url, close: async () => cleanup() });
                        }
                    }
                } else {
                    // Match anonymous trycloudflare URL
                    const match = out.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
                    if (match && !resolved) {
                        resolved = true;
                        url = match[0];
                        resolve({ url, close: async () => cleanup() });
                    }
                }

                // Log tunnel registration
                if (log && (out.includes('Registered tunnel') || out.includes('Connection'))) {
                    log(`[Cloudflared Status] ${out.trim()}`);
                }
            });

            child.on('error', (err) => {
                if (log) log(`[Cloudflared] Process error: ${err.message}`);
                activeChildProcesses.delete(child);
                if (!resolved) {
                    resolved = true;
                    reject(err);
                }
            });

            child.on('close', (code) => {
                if (log) log(`[Cloudflared] Process closed with code ${code}`);
                activeChildProcesses.delete(child);
                if (!resolved) {
                    resolved = true;
                    reject(new Error(`Cloudflared exited with code ${code}`));
                }
            });

            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    if (log) log(`[Cloudflared] Timeout (15s) reached while waiting for URL.`);
                    cleanup();
                    reject(new Error('Cloudflared timed out allocating url (15s)'));
                }
            }, 15000);
        });
    }
}
