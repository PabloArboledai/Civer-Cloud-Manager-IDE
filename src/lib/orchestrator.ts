import { invoke } from '@tauri-apps/api/core';

export interface ProcessStatus {
    name: string;
    pid: string | number;
    status: string;
    memory?: string;
    cpu?: string;
}

export async function runCommand(cmd: string, args: string[], cwd?: string): Promise<string> {
    try {
        const result = await invoke<string>('exec_command', {
            command: cmd,
            args,
            cwd
        });
        return result;
    } catch (e: any) {
        console.error(`Command failed: ${cmd} ${args.join(' ')}`, e);
        throw e;
    }
}

export async function getPM2Status(): Promise<ProcessStatus[]> {
    try {
        const output = await runCommand('cmd', ['/c', 'pm2', 'jlist']);
        const parsed = JSON.parse(output);
        return parsed.map((p: any) => ({
            name: p.name,
            pid: p.pid,
            status: p.pm2_env.status,
            memory: (p.monit.memory / 1024 / 1024).toFixed(1) + ' MB',
            cpu: p.monit.cpu + '%'
        }));
    } catch (e) {
        console.warn('Failed to parse PM2 status', e);
        return [];
    }
}

export async function startPM2App(name: string, cwd: string, port: string): Promise<void> {
    await runCommand('cmd', ['/c', 'pm2', 'start', 'npm', '--name', name, '--', 'run', 'dev', '--', '-p', port], cwd);
    await runCommand('cmd', ['/c', 'pm2', 'save']);
}

export async function stopPM2App(name: string): Promise<void> {
    await runCommand('cmd', ['/c', 'pm2', 'stop', name]);
}

export async function restartPM2App(name: string): Promise<void> {
    await runCommand('cmd', ['/c', 'pm2', 'restart', name]);
}

export async function deletePM2App(name: string): Promise<void> {
    await runCommand('cmd', ['/c', 'pm2', 'delete', name]);
    await runCommand('cmd', ['/c', 'pm2', 'save']);
}

export async function getCloudflaredStatus(): Promise<any> {
    try {
        const output = await runCommand('cmd', ['/c', 'tasklist', '/FI', 'IMAGENAME eq cloudflared.exe', '/FO', 'CSV']);
        if (output.includes('cloudflared.exe')) {
            return { running: true };
        }
        return { running: false };
    } catch {
        return { running: false };
    }
}

export async function routeCloudflareTunnel(tunnelName: string, domain: string): Promise<void> {
    await runCommand('cmd', ['/c', 'cloudflared', 'tunnel', 'route', 'dns', tunnelName, domain]);
}

export async function startCloudflareTunnel(tunnelName: string): Promise<void> {
    // Wrap cloudflared tunnel in PM2 to keep it alive
    await runCommand('cmd', ['/c', 'pm2', 'start', 'cloudflared', '--name', `tunnel-${tunnelName}`, '--', 'tunnel', 'run', tunnelName]);
    await runCommand('cmd', ['/c', 'pm2', 'save']);
}
