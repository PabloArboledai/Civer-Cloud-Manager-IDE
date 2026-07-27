import * as vscode from 'vscode';
import { AntigravityServer } from './server/index';
import { getActiveCascadeIdFromLs } from './services/ls-discovery';
import qrcode from 'qrcode';
import os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { discoverInstances, connectCDP } from './services/cdp';
import { clickElement } from './services/antigravity';

let server: AntigravityServer | null = null;
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

// Global Context
let globalContext: vscode.ExtensionContext;

export async function activate(context: vscode.ExtensionContext) {
    globalContext = context;
    outputChannel = vscode.window.createOutputChannel("Antigravity Link");
    outputChannel.appendLine("🚀 Antigravity Link: Activating...");
    
    // Start the Orchestrator Message Bus Listener
    startBusListener();

    // Status Bar Item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = "antigravity-link.showQR";
    context.subscriptions.push(statusBarItem);

    // Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-link.start', async () => {
            await startServer(context);
        }),
        vscode.commands.registerCommand('antigravity-link.stop', async () => {
            await stopServer();
        }),
        vscode.commands.registerCommand('antigravity-link.showQR', async () => {
            await showQR();
        }),
        vscode.commands.registerCommand('antigravity-link.selectNetworkInterface', async () => {
            const interfaces = os.networkInterfaces();
            const candidates: { label: string; addr: string }[] = [];
            for (const [name, addrs] of Object.entries(interfaces)) {
                for (const addr of addrs || []) {
                    if (!addr.internal && addr.family === 'IPv4') {
                        candidates.push({ label: `${name} — ${addr.address}`, addr: addr.address });
                    }
                }
            }
            if (candidates.length === 0) {
                vscode.window.showWarningMessage('No external IPv4 interfaces found.');
                return;
            }
            const pick = await vscode.window.showQuickPick(candidates.map(c => ({ label: c.addr, description: c.label })), {
                placeHolder: 'Select the network interface to advertise in the QR code'
            });
            if (pick) {
                await vscode.workspace.getConfiguration('antigravityLink').update('preferredHost', pick.label, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Network interface set to ${pick.label}. Restart the server to apply.`);
            }
        })
    );

    // Check Auto-Start (Legacy feature)
    const config = vscode.workspace.getConfiguration('antigravityLink');
    if (config.get('autoStart', false)) {
        await startServer(context);
    } else {
        updateStatusBar(false);
    }
}

async function startServer(context: vscode.ExtensionContext) {
    if (server) {
        vscode.window.showInformationMessage("Antigravity Link server is already running.");
        return;
    }

    const config = vscode.workspace.getConfiguration('antigravityLink');
    const port = config.get<number>('port', 3000);
    const useHttps = config.get<boolean>('useHttps', true);
    const preferredHost = config.get<string>('preferredHost', '').trim();
    const strictWorkbenchOnly = config.get<boolean>('strictWorkbenchOnly', true);
    const includeFallbackTargets = config.get<boolean>('includeFallbackTargets', false);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    process.env.AG_STRICT_WORKBENCH_ONLY = strictWorkbenchOnly ? 'true' : 'false';
    process.env.AG_INCLUDE_FALLBACK_TARGETS = includeFallbackTargets ? 'true' : 'false';

    // Create primary send function using VS Code commands (more reliable than CDP DOM injection)
    const primarySendFn = async (message: string): Promise<boolean> => {
        try {
            // Try sendTextToChat first, then sendPromptToAgentPanel as secondary
            await vscode.commands.executeCommand('antigravity.sendTextToChat', message);
            return true;
        } catch {
            try {
                await vscode.commands.executeCommand('antigravity.sendPromptToAgentPanel', message);
                return true;
            } catch {
                return false;
            }
        }
    };

    // Resolve the active cascade ID. Try the VS Code getDiagnostics command first
    // (fastest — returns googleAgentId which maps to cascadeId), then fall back to
    // querying the LS RPC directly via GetAllCascadeTrajectories.
    const getActiveCascadeIdFn = async (): Promise<string> => {
        try {
            const raw = await vscode.commands.executeCommand<string>('antigravity.getDiagnostics');
            if (raw && typeof raw === 'string') {
                const diag = JSON.parse(raw);
                const id: string = diag?.recentTrajectories?.[0]?.googleAgentId ?? '';
                if (id) return id;
            }
        } catch { /* fall through */ }
        return getActiveCascadeIdFromLs();
    };

    // Start the server
    const newServer = new AntigravityServer(port, context.extensionPath, workspaceRoot, useHttps, preferredHost, primarySendFn, getActiveCascadeIdFn);

    try {
        const urls = await newServer.start();
        server = newServer; // Only assign global server AFTER it has successfully started and has URLs

        console.log(`[Extension] Server started: ${urls.localUrl}`);
        console.log(`[Extension] Secure URL: ${urls.secureUrl}`);

        outputChannel.appendLine(`✅ Server running!`);
        outputChannel.appendLine(`   Local:  ${urls.localUrl}`);
        outputChannel.appendLine(`   Secure: ${urls.secureUrl}`);

        // Store URLs for QR generation
        context.workspaceState.update('ag_urls', urls);

        updateStatusBar(true, port);

        // Auto-open QR code
        await showQR();
    } catch (e) {
        server = null;
        outputChannel.appendLine(`❌ Failed to start server: ${e}`);
        vscode.window.showErrorMessage(`Antigravity Link failed to start: ${e}`);
        updateStatusBar(false);
    }
}

async function stopServer() {
    if (!server) {
        vscode.window.showInformationMessage("Antigravity Link server is not running.");
        return;
    }

    try {
        server.stop();
        server = null;
        outputChannel.appendLine("🛑 Server stopped.");
        vscode.window.showInformationMessage("Antigravity Link server stopped.");
        updateStatusBar(false);
    } catch (e) {
        vscode.window.showErrorMessage(`Failed to stop server: ${e}`);
    }
}

async function showQR() {
    if (!server) {
        const selection = await vscode.window.showWarningMessage("Server is not running.", "Start Server");
        if (selection === "Start Server") {
            await startServer(globalContext);
        }
        return;
    }

    try {
        const secureUrl = server.secureUrl;
        const localUrl = server.localUrl;
        const token = server.token || '';

        console.log(`[Extension] showQR: secureUrl="${secureUrl}", localUrl="${localUrl}"`);
        outputChannel.appendLine(`[Extension] Generating QR for: ${secureUrl || localUrl}`);

        const displayUrl = secureUrl || localUrl;
        if (!displayUrl || displayUrl === 'https://:' || displayUrl === 'http://:') {
            vscode.window.showErrorMessage("No valid server URL available for QR generation. Please wait or restart the server.");
            return;
        }

        // Generate QR Data URL
        const qrDataUrl = await qrcode.toDataURL(displayUrl);

        // Create Webview Panel
        const panel = vscode.window.createWebviewPanel(
            'antigravityLinkQR',
            'Antigravity Link QR',
            vscode.ViewColumn.One,
            {}
        );

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #1a1a1a; color: white; font-family: sans-serif; }
                    h1 { font-size: 1.5rem; margin-bottom: 20px; }
                    img { background: white; padding: 10px; border-radius: 8px; }
                    p { margin-top: 20px; opacity: 0.8; }
                    .url { font-family: monospace; background: #333; padding: 4px 8px; border-radius: 4px; }
                </style>
            </head>
            <body>
                <h1>📱 Scan to Connect</h1>
                <img src="${qrDataUrl}" width="300" height="300" />
                <p>Connect your mobile device to control Antigravity.</p>
                <p>URL: <span class="url">${displayUrl}</span></p>
                <p>Token: <span class="url">${token}</span></p>
            </body>
            </html>
        `;

    } catch (e) {
        vscode.window.showErrorMessage(`Failed to generate QR: ${e}`);
    }
}

function updateStatusBar(running: boolean, port?: number) {
    if (running) {
        statusBarItem.text = `$(broadcast) Link: ${port}`;
        statusBarItem.tooltip = "Antigravity Link Server Running - Click to Show QR";
        statusBarItem.command = "antigravity-link.showQR";
        statusBarItem.show();
    } else {
        statusBarItem.text = `$(broadcast) Link: Off`;
        statusBarItem.tooltip = "Antigravity Link Server Stopped - Click to Start";
        statusBarItem.command = "antigravity-link.start";
        statusBarItem.show();
    }
}

export function deactivate() {
    if (server) {
        server.stop();
    }
}

function startBusListener() {
    const busDir = path.join(os.homedir(), '.gemini', 'antigravity', 'bus');
    if (!fs.existsSync(busDir)) {
        try { fs.mkdirSync(busDir, { recursive: true }); } catch {}
    }

    const workspaceName = vscode.workspace.name;
    if (!workspaceName) return;
    
    if (outputChannel) {
        outputChannel.appendLine(`[Bus] Listening for orchestrator messages targeting: ${workspaceName}`);
    }

    let cdpConnection: any = null;

    setInterval(async () => {
        try {
            if (!fs.existsSync(busDir)) return;
            const files = fs.readdirSync(busDir);
            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                const filePath = path.join(busDir, file);
                try {
                    const raw = fs.readFileSync(filePath, 'utf8');
                    const content = JSON.parse(raw);
                    if (content.targetWorkspace === workspaceName || content.targetWorkspace === '*') {
                        if (outputChannel) {
                            outputChannel.appendLine(`[Bus] Received command ${content.type || 'chat'} from ${content.source}`);
                        }
                        
                        const msgType = content.type || 'chat';
                        
                        if (msgType === 'chat') {
                            vscode.commands.executeCommand('antigravity.sendTextToChat', content.message).then(
                                () => { if (outputChannel) outputChannel.appendLine(`[Bus] Injected chat message`); },
                                () => { vscode.commands.executeCommand('antigravity.sendPromptToAgentPanel', content.message); }
                            );
                        } else if (msgType === 'stop') {
                            vscode.commands.executeCommand('antigravity.stopGeneration').then(undefined, async () => {
                                // Fallback: click the stop button via CDP
                                try {
                                    if (!cdpConnection) {
                                        const instances = await discoverInstances();
                                        if (instances.length > 0) {
                                            cdpConnection = await connectCDP(`http://127.0.0.1:${instances[0].port}`, '1');
                                        }
                                    }
                                    if (cdpConnection) {
                                        await clickElement(cdpConnection, undefined, undefined, undefined, undefined, '[data-tooltip-id="input-send-button-cancel-tooltip"]');
                                    }
                                } catch(e){}
                            });
                        } else if (msgType === 'open_conversation') {
                            try {
                                if (!cdpConnection) {
                                    const instances = await discoverInstances();
                                    if (instances.length > 0) {
                                        cdpConnection = await connectCDP(`http://127.0.0.1:${instances[0].port}`, '1');
                                    }
                                }
                                if (cdpConnection) {
                                    await cdpConnection.call("Runtime.evaluate", {
                                        expression: `(() => {
                                            const link = document.querySelector('a[href*="${content.conversationId}"], [id*="${content.conversationId}"]');
                                            if (link) {
                                                link.click();
                                            } else {
                                                window.location.hash = '${content.conversationId}';
                                            }
                                        })()`,
                                        returnByValue: true
                                    });
                                    if (outputChannel) outputChannel.appendLine(`[Bus] Forzando apertura de conversacion cruzada: ${content.conversationId}`);
                                }
                            } catch(e) {}
                        }
                        
                        fs.unlinkSync(filePath);
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }, 1000);

    // Telemetry Poller
    const telemetryDir = path.join(os.homedir(), '.gemini', 'antigravity', 'telemetry');
    if (!fs.existsSync(telemetryDir)) {
        try { fs.mkdirSync(telemetryDir, { recursive: true }); } catch {}
    }

    setInterval(async () => {
        try {
            if (!cdpConnection) {
                const instances = await discoverInstances();
                if (instances.length > 0) {
                    cdpConnection = await connectCDP(`http://127.0.0.1:${instances[0].port}`, '1');
                }
            }
            if (cdpConnection) {
                const res = await cdpConnection.call("Runtime.evaluate", {
                    expression: `(() => {
                        const cascade = document.querySelector('#cascade') || document.body;
                        const msgs = Array.from(cascade.querySelectorAll('[data-message-id], [class*="message"]'));
                        const lastMsg = msgs[msgs.length - 1];
                        const text = lastMsg ? (lastMsg.innerText || lastMsg.textContent) : '';
                        const stopBtn = document.querySelector('[data-tooltip-id="input-send-button-cancel-tooltip"]');
                        return { 
                            lastMessage: text.substring(text.length - 500), 
                            isGenerating: !!(stopBtn && stopBtn.offsetParent !== null),
                            timestamp: Date.now()
                        };
                    })()`,
                    returnByValue: true
                });
                if (res?.result?.value) {
                    const file = path.join(telemetryDir, `${workspaceName}.json`);
                    fs.writeFileSync(file, JSON.stringify(res.result.value, null, 2));
                }
            }
        } catch (e) {
            cdpConnection = null; // Reconnect on failure
        }
    }, 2000);
}
