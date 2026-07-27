import * as vscode from 'vscode';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _isRunning: boolean;
  private _isStarting: boolean = false;
  private _url: string = '';
  private _qrDataUrl: string = '';
  private _publicDir: string = '';
  private _token: string = '';
  private _instances: any[] = [];
  private _activeTargetId: string = '';

  public static createOrShow(extensionUri: vscode.Uri, isRunning: boolean = false, url: string = '', qrDataUrl: string = '', isStarting: boolean = false, publicDir: string = '', token: string = '') {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      // Refresh state when re-revealing
      DashboardPanel.currentPanel._isRunning = isRunning;
      DashboardPanel.currentPanel._isStarting = isStarting;
      DashboardPanel.currentPanel._url = url;
      DashboardPanel.currentPanel._qrDataUrl = qrDataUrl;
      DashboardPanel.currentPanel._publicDir = publicDir;
      DashboardPanel.currentPanel._token = token;
      DashboardPanel.currentPanel._update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'antigravityDashboard',
      'Antigravity Link',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, isRunning, url, qrDataUrl, isStarting, publicDir, token);
  }

  public updateServerState(isRunning: boolean, url: string, qrDataUrl: string, isStarting: boolean = false, publicDir?: string, token?: string, instances?: any[], activeTargetId?: string) {
    this._isRunning = isRunning;
    this._url = url;
    this._qrDataUrl = qrDataUrl;
    this._isStarting = isStarting;
    if (publicDir !== undefined) {
      this._publicDir = publicDir;
    }
    if (token !== undefined) {
      this._token = token;
    }
    if (instances !== undefined) {
      this._instances = instances;
    }
    if (activeTargetId !== undefined) {
      this._activeTargetId = activeTargetId;
    }
    this._update();
  }

  public pushInstances(instances: any[]) {
    this._instances = instances;
    this._update();
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, isRunning: boolean, url: string, qrDataUrl: string, isStarting: boolean, publicDir: string, token: string) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._isRunning = isRunning;
    this._url = url;
    this._qrDataUrl = qrDataUrl;
    this._isStarting = isStarting;
    this._publicDir = publicDir;
    this._token = token;

    this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        const config = vscode.workspace.getConfiguration('antigravityLink');
        switch (message.command) {
          case 'selectFolder':
            const folders = await vscode.window.showOpenDialog({
              canSelectFiles: false,
              canSelectFolders: true,
              canSelectMany: false,
              title: 'Select Root Public Directory'
            });
            if (folders && folders.length > 0) {
              this._panel.webview.postMessage({ command: 'folderSelected', path: folders[0].fsPath });
            }
            break;
          case 'saveConfig':
            await config.update('tunnelProvider', message.provider, vscode.ConfigurationTarget.Global);
            if (message.ngrokToken !== undefined) {
              await config.update('ngrokToken', message.ngrokToken, vscode.ConfigurationTarget.Global);
            }
            if (message.port !== undefined) {
              await config.update('port', message.port, vscode.ConfigurationTarget.Global);
            }
            if (message.publicDir !== undefined) {
              await config.update('publicDir', message.publicDir, vscode.ConfigurationTarget.Global);
            }
            if (message.autoOpenQR !== undefined) {
              await config.update('autoOpenQR', message.autoOpenQR, vscode.ConfigurationTarget.Global);
            }
            this._panel.webview.postMessage({ command: 'saveResult', ok: true });
            vscode.window.showInformationMessage('✅ Settings saved! Restart the server to apply changes.');
            break;
          case 'startServer':
            await vscode.commands.executeCommand('antigravity-link.start');
            break;
          case 'stopServer':
            await vscode.commands.executeCommand('antigravity-link.stop');
            break;
          case 'restartServer':
            await vscode.commands.executeCommand('antigravity-link.stop');
            setTimeout(() => vscode.commands.executeCommand('antigravity-link.start'), 1200);
            break;
          case 'showQR':
            await vscode.commands.executeCommand('antigravity-link.showQR');
            break;
          case 'showLogs':
            await vscode.commands.executeCommand('antigravity-link.showOutputChannel');
            break;
          case 'openInBrowser':
            if (this._url) {
              vscode.env.openExternal(vscode.Uri.parse(this._url));
            }
            break;
          case 'refreshInstances':
            await vscode.commands.executeCommand('antigravity-link.refreshInstances');
            break;
          case 'switchInstance':
            if (message.targetId) {
              await vscode.commands.executeCommand('antigravity-link.switchInstance', message.targetId);
            }
            break;
          case 'testConnection':
            if (this._url) {
              try {
                const http = await import('http');
                const https = await import('https');
                const u = new URL(this._url);
                const lib = u.protocol === 'https:' ? https : http;
                const start = Date.now();
                lib.get({
                  hostname: u.hostname,
                  path: '/health',
                  port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80),
                  rejectUnauthorized: false,
                  headers: {
                    'Authorization': `Bearer ${this._token}`
                  }
                }, (res) => {
                  const ms = Date.now() - start;
                  this._panel.webview.postMessage({ command: 'testResult', ok: res.statusCode === 200, statusCode: res.statusCode, ms });
                }).on('error', (e: any) => {
                  let errMsg = e.message;
                  if (e.code === 'ENOTFOUND') {
                    errMsg = 'DNS Propagation Error: The tunnel URL is too fresh. Wait 10-20s for Cloudflare DNS to update.';
                  }
                  this._panel.webview.postMessage({ command: 'testResult', ok: false, error: errMsg });
                });
              } catch (e: any) {
                this._panel.webview.postMessage({ command: 'testResult', ok: false, error: e.message });
              }
            } else {
              this._panel.webview.postMessage({ command: 'testResult', ok: false, error: 'Server is not running.' });
            }
            break;
          case 'openLogs':
            await vscode.commands.executeCommand('antigravity-link.showOutputChannel');
            break;
          case 'refresh':
            // Re-render the webview with the latest state from the extension
            this._update();
            break;
        }
      },
      null,
      this._disposables
    );

    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('antigravityLink')) {
        this._update();
      }
    }, null, this._disposables);
  }

  public dispose() {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) { x.dispose(); }
    }
  }

  private _update() {
    this._panel.title = this._isStarting ? 'Antigravity Link (Starting...)' : 'Antigravity Link';
    this._panel.webview.html = this._getHtml();

    // Ensure the webview has the latest state once HTML is loaded
    // Small delay to ensure the listener is ready
    setTimeout(() => {
      if (this._panel) {
        this._panel.webview.postMessage({
          command: 'serverState',
          isRunning: this._isRunning,
          url: this._url,
          qrDataUrl: this._qrDataUrl,
          isStarting: this._isStarting,
          instances: this._instances,
          activeTargetId: this._activeTargetId
        });
      }
    }, 100);
  }

  private _getHtml() {
    const cfg = vscode.workspace.getConfiguration('antigravityLink');
    const provider = cfg.get<string>('tunnelProvider', 'auto');
    const token = cfg.get<string>('ngrokToken', '');
    const port = cfg.get<number>('port', 3000);
    const autoOpenQR = cfg.get<boolean>('autoOpenQR', false);
    const running = this._isRunning;
    const starting = this._isStarting;
    const url = this._url || '';
    const qr = this._qrDataUrl || '';
    const showNgrok = ['auto', 'ngrok'].includes(provider);

    let statusText = 'Offline';
    let statusColor = '#f85149';
    if (running) {
      statusText = 'Online';
      statusColor = '#3fb950';
    } else if (starting) {
      statusText = 'Starting...';
      statusColor = '#d29922';
    }

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Antigravity Link Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-font-family), "Segoe UI", system-ui, sans-serif;
    font-size: 13px;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Top Bar ── */
  .topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: var(--vscode-titleBar-activeBackground, #1e1e2e);
    border-bottom: 1px solid var(--vscode-widget-border);
    flex-shrink: 0;
  }
  .topbar-title {
    font-size: 15px;
    font-weight: 600;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .status-dot {
    width: 9px; height: 9px;
    border-radius: 50%;
    background: ${statusColor};
    box-shadow: 0 0 0 2px ${statusColor}44;
    flex-shrink: 0;
    ${starting ? 'animation: blink 1s infinite;' : ''}
  }
  @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
  .status-label {
    font-size: 11px;
    font-weight: 600;
    color: ${statusColor};
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── Tab Bar ── */
  .tabs {
    display: flex;
    gap: 2px;
    padding: 4px 16px 0;
    border-bottom: 1px solid var(--vscode-widget-border);
    background: var(--vscode-tab-inactiveBackground);
    flex-shrink: 0;
  }
  .tab {
    padding: 7px 14px;
    font-size: 12px;
    cursor: pointer;
    border-radius: 4px 4px 0 0;
    border: 1px solid transparent;
    border-bottom: none;
    background: none;
    color: var(--vscode-tab-inactiveForeground);
    transition: all 0.15s;
    white-space: nowrap;
  }
  .tab:hover { color: var(--vscode-foreground); background: var(--vscode-tab-hoverBackground); }
  .tab.active {
    background: var(--vscode-editor-background);
    color: var(--vscode-tab-activeForeground);
    border-color: var(--vscode-widget-border);
    font-weight: 600;
    margin-bottom: -1px;
  }

  /* ── Scroll area ── */
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 20px;
  }

  .pane { display: none; }
  .pane.active { display: block; }

  /* ── Cards ── */
  .card {
    background: var(--vscode-sideBar-background);
    border: 1px solid var(--vscode-widget-border);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
  }
  .card-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 12px;
  }

  /* ── Buttons ── */
  .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
  button {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px;
    border-radius: 5px;
    border: none;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: filter 0.15s;
  }
  button:hover { filter: brightness(1.12); }
  button:active { filter: brightness(0.88); }
  .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .btn-danger { background: #f8514922; color: #f85149; border: 1px solid #f8514944; }
  .btn-success { background: #3fb95022; color: #3fb950; border: 1px solid #3fb95044; }
  .btn-warning { background: #d29922; color: #000; }
  button:disabled { opacity: 0.4; cursor: not-allowed; filter: none; }

  /* ── URL bar ── */
  .url-bar {
    display: flex;
    gap: 8px;
    align-items: center;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border);
    border-radius: 6px;
    padding: 6px 10px;
    font-family: monospace;
    font-size: 12px;
    word-break: break-all;
    color: var(--vscode-input-foreground);
  }
  .url-bar .url-text { flex: 1; }

  /* ── QR ── */
  .qr-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .qr-img {
    width: 200px; height: 200px;
    border-radius: 8px;
    background: white;
    padding: 8px;
    display: ${qr ? 'block' : 'none'};
  }
  .qr-empty {
    width: 200px; height: 200px;
    border-radius: 8px;
    background: var(--vscode-input-background);
    border: 2px dashed var(--vscode-widget-border);
    display: ${qr ? 'none' : 'flex'};
    align-items: center;
    justify-content: center;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
    text-align: center;
    padding: 20px;
  }

  /* ── Preview iframe ── */
  .preview-toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 10px;
  }
  #preview-url-input {
    flex: 1;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 5px;
    padding: 6px 10px;
    font-size: 12px;
    font-family: monospace;
    outline: none;
  }
  #preview-url-input:focus { border-color: var(--vscode-focusBorder); }
  .preview-frame-wrap {
    border: 1px solid var(--vscode-widget-border);
    border-radius: 8px;
    overflow: hidden;
    height: 420px;
    background: white;
  }
  iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }
  .preview-toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
    align-items: center;
  }
  .browser-nav {
    display: flex;
    gap: 4px;
  }
  .browser-nav button {
    padding: 4px 8px;
    font-size: 14px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  .browser-nav button:hover { background: var(--vscode-button-secondaryHoverBackground); }

  /* ── Test result ── */
  #test-result {
    margin-top: 10px;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 12px;
    display: none;
    font-weight: 500;
  }

  /* ── Settings fields ── */
  .field { margin-bottom: 14px; }
  .field label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px; }
  .field select, .field input {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 5px;
    padding: 8px 10px;
    font-size: 13px;
    outline: none;
  }
  .field select:focus, .field input:focus { border-color: var(--vscode-focusBorder); }
  .field .hint { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 4px; }

  /* ── Debug logs ── */
  #log-box {
    background: var(--vscode-terminal-background, #1a1a2e);
    color: var(--vscode-terminal-foreground, #cdd6f4);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    border-radius: 6px;
    padding: 12px;
    height: 200px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  #log-box .log-ts { color: #585b70; }
  #log-box .log-ok { color: #a6e3a1; }
  #log-box .log-err { color: #f38ba8; }
  #log-box .log-info { color: #89b4fa; }

  /* ── Command grid ── */
  .cmd-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
  }
  .cmd-card {
    background: var(--vscode-sideBar-background);
    border: 1px solid var(--vscode-widget-border);
    border-radius: 8px;
    padding: 12px 14px;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cmd-card:hover { border-color: var(--vscode-focusBorder); background: var(--vscode-list-hoverBackground); }
  .cmd-icon { font-size: 18px; }
  .cmd-name { font-size: 12px; font-weight: 600; }
  .cmd-desc { font-size: 11px; color: var(--vscode-descriptionForeground); }
  /* ── Instance List ── */
  .instance-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .instance-badge { font-size: 10px; opacity: 0.8; padding: 2px 6px; border-radius: 4px; border: 1px solid currentColor; }

  /* ── Toggle Switch ── */
  .switch {
    position: relative;
    display: inline-block;
    width: 34px;
    height: 18px;
    flex-shrink: 0;
  }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: var(--vscode-settings-checkboxBackground, #3c3c3c);
    transition: .3s;
    border-radius: 34px;
    border: 1px solid var(--vscode-settings-checkboxBorder, #6b6b6b);
  }
  .slider:before {
    position: absolute;
    content: "";
    height: 12px;
    width: 12px;
    left: 2px;
    bottom: 2px;
    background-color: var(--vscode-settings-checkboxForeground, white);
    transition: .3s;
    border-radius: 50%;
  }
  input:checked + .slider { background-color: var(--vscode-button-background); border-color: var(--vscode-button-background); }
  input:focus + .slider { box-shadow: 0 0 1px var(--vscode-button-background); }
  input:checked + .slider:before { transform: translateX(16px); }
  input:checked + .slider:before { transform: translateX(16px); }

  /* ── Toast ── */
  #toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: var(--vscode-notifications-background, #252526);
    color: var(--vscode-notifications-foreground, #ffffff);
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 1000;
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--vscode-widget-border);
  }
  #toast.show { transform: translateX(-50%) translateY(0); }
</style>
</head>
<body>
<div id="toast"></div>

<div class="topbar">
  <div class="topbar-title">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    Antigravity Link
  </div>
  <span class="status-dot" id="dot"></span>
  <span class="status-label" id="status-label">${statusText}</span>
  <button class="btn-secondary" style="padding:4px 10px;font-size:11px;margin-left:auto" onclick="refreshDash()" title="Reload dashboard state">↻ Reload</button>
</div>

<div class="tabs">
  <button class="tab active" data-tab="overview">📡 Overview</button>
  <button class="tab" data-tab="preview">🌐 Preview</button>
  <button class="tab" data-tab="commands">⚡ Commands</button>
  <button class="tab" data-tab="settings">⚙️ Settings</button>
  <button class="tab" data-tab="debug">🐛 Debug</button>
</div>

<div class="content">

  <!-- ─── Overview ─── -->
  <div class="pane active" id="tab-overview">

    <div class="card">
      <div class="card-title">Server Controls</div>
      <div class="btn-row">
        <button class="btn-success" id="btn-start" onclick="cmd('startServer')" ${(running || starting) ? 'disabled' : ''}>${starting ? 'Starting...' : '▶ Start'}</button>
        <button class="btn-danger" id="btn-stop" onclick="cmd('stopServer')" ${running ? '' : 'disabled'}>■ Stop</button>
        <button class="btn-warning" onclick="cmd('restartServer')" ${starting ? 'disabled' : ''}>↺ Restart</button>
        <button class="btn-secondary" onclick="cmd('showQR')">🔳 Show QR (window)</button>
        <button class="btn-secondary" onclick="cmd('showLogs')">📑 Show Logs</button>
      </div>
    </div>

    <div class="card" ${running ? '' : 'style="opacity:0.5;pointer-events:none"'}>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div class="card-title" style="margin-bottom:0">Active Sessions</div>
        <button class="btn-secondary" style="padding:4px 8px; font-size:11px" onclick="cmd('refreshInstances')" ${running ? '' : 'disabled'}>↻ Refresh</button>
      </div>
      <div id="instances-list" class="instance-list">
        <!-- Injected -->
      </div>
    </div>

    <div class="card" ${running ? '' : 'style="opacity:0.5;pointer-events:none"'}>
      <div class="card-title">Connection URL</div>
      <div class="url-bar">
        <span class="url-text" id="url-text">${url || '—'}</span>
        <button class="btn-secondary" style="padding:4px 8px;font-size:11px" onclick="copyUrl()">Copy</button>
      </div>
    </div>

    <div class="card" ${running ? '' : 'style="opacity:0.5;pointer-events:none"'}>
      <div class="card-title">QR Code — Scan to connect on mobile</div>
      <div class="qr-wrapper">
        <img id="qr-img" class="qr-img" src="${qr}" alt="QR Code">
        <div id="qr-empty" class="qr-empty">${running ? 'Generating QR…' : 'Start the server to generate a QR code'}</div>
        <div class="btn-row">
          <button class="btn-primary" onclick="cmd('regenerateQR')" ${running ? '' : 'disabled'}>↻ Regenerate QR</button>
          <button class="btn-secondary" onclick="saveQR()" ${qr ? '' : 'disabled'}>💾 Save QR Image</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Connection Test</div>
      <div class="btn-row">
        <button class="btn-primary" onclick="testConn()" ${running ? '' : 'disabled'}>🔍 Test Connection</button>
        <button class="btn-secondary" onclick="cmd('openInBrowser')" ${running ? '' : 'disabled'}>↗ Open in Browser</button>
      </div>
      <div id="test-result"></div>
    </div>

  </div>

  <!-- ─── Preview ─── -->
  <div class="pane" id="tab-preview">
    <div class="preview-toolbar">
      <div class="browser-nav">
        <button onclick="backPreview()" title="Back">⟵</button>
        <button onclick="forwardPreview()" title="Forward">⟶</button>
        <button onclick="refreshPreview()" title="Refresh">↻</button>
      </div>
      <input id="preview-url-input" value="${url}" placeholder="Enter URL to preview…">
      <button class="btn-primary" onclick="navigatePreview()">Go</button>
    </div>
    <div class="preview-frame-wrap">
      <iframe id="preview-frame" name="preview-frame" src="${url || 'about:blank'}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
    </div>
  </div>

  <!-- ─── Commands ─── -->
  <div class="pane" id="tab-commands">
    <div class="cmd-grid">
      <div class="cmd-card" onclick="cmd('startServer')"><span class="cmd-icon">▶️</span><span class="cmd-name">Start Server</span><span class="cmd-desc">Inicia el servidor local y el túnel</span></div>
      <div class="cmd-card" onclick="cmd('stopServer')"><span class="cmd-icon">⏹️</span><span class="cmd-name">Stop Server</span><span class="cmd-desc">Detiene el servidor y cierra el túnel</span></div>
      <div class="cmd-card" onclick="cmd('restartServer')"><span class="cmd-icon">🔄</span><span class="cmd-name">Restart Server</span><span class="cmd-desc">Stop + Start completo</span></div>
      <div class="cmd-card" onclick="cmd('showQR')"><span class="cmd-icon">🔳</span><span class="cmd-name">Show QR Code</span><span class="cmd-desc">Abre el panel de código QR</span></div>
      <div class="cmd-card" onclick="switchTab('preview')"><span class="cmd-icon">🌐</span><span class="cmd-name">Live Preview</span><span class="cmd-desc">Previsualiza el sitio aquí mismo</span></div>
      <div class="cmd-card" onclick="testConn()"><span class="cmd-icon">🔍</span><span class="cmd-name">Test Connection</span><span class="cmd-desc">Verifica la conectividad del túnel</span></div>
      <div class="cmd-card" onclick="cmd('openInBrowser')"><span class="cmd-icon">↗️</span><span class="cmd-name">Open in Browser</span><span class="cmd-desc">Abre la URL del portal en el navegador</span></div>
      <div class="cmd-card" onclick="copyUrl()"><span class="cmd-icon">📋</span><span class="cmd-name">Copy URL</span><span class="cmd-desc">Copia la URL del túnel al portapapeles</span></div>
      <div class="cmd-card" onclick="switchTab('settings')"><span class="cmd-icon">⚙️</span><span class="cmd-name">Settings</span><span class="cmd-desc">Configura proveedor y tokens</span></div>
      <div class="cmd-card" onclick="switchTab('debug')"><span class="cmd-icon">🐛</span><span class="cmd-name">Debug Log</span><span class="cmd-desc">Panel de diagnóstico local</span></div>
    </div>
  </div>

  <!-- ─── Settings ─── -->
  <div class="pane" id="tab-settings">
    <div class="card">
      <div class="card-title">Tunnel Provider</div>
      <div class="field">
        <label>Provider</label>
        <select id="sel-provider">
          <option value="auto" ${provider === 'auto' ? 'selected' : ''}>Auto (Fallback: Ngrok → Cloudflare → LocalTunnel)</option>
          <option value="cloudflared" ${provider === 'cloudflared' ? 'selected' : ''}>Cloudflare Tunnels (Sin auth, sin límite)</option>
          <option value="ngrok" ${provider === 'ngrok' ? 'selected' : ''}>Ngrok (Rápido, requiere Token)</option>
          <option value="localtunnel" ${provider === 'localtunnel' ? 'selected' : ''}>LocalTunnel (Legado)</option>
        </select>
        <div class="hint">Recomendado: <b>Auto</b> o <b>Cloudflare Tunnels</b>.</div>
      </div>
      <div class="field" id="ngrok-field" style="display:${showNgrok ? 'block' : 'none'}">
        <label>Ngrok Auth Token</label>
        <input type="password" id="inp-token" value="${token}" placeholder="Obtén tu token en ngrok.com/dashboard">
        <div class="hint">Requerido si el proveedor usa Ngrok. Déjalo vacío si usas solo Cloudflare.</div>
      </div>
      <div class="field">
        <label>Port</label>
        <input type="number" id="inp-port" value="${port}" min="1024" max="65535">
        <div class="hint">Puerto local donde el servidor escucha. Default: 3000.</div>
      </div>
      <div class="field">
        <label>Root Project Directory (Live Server)</label>
        <div style="display:flex;gap:6px">
          <input type="text" id="inp-dir" value="${this._publicDir || ''}" placeholder="Carpeta para servir (Live Server)...">
          <button class="btn-secondary" style="width:auto" onclick="selectFolder()">Browse</button>
        </div>
        <div class="hint">Carpeta que se servirá públicamente.</div>
      </div>
      <div class="field">
        <label>Startup Behavior</label>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--vscode-input-background);border-radius:6px;border:1px solid var(--vscode-widget-border)">
          <span>Auto-open QR tab on server start</span>
          <label class="switch">
            <input type="checkbox" id="chk-auto-open" ${autoOpenQR ? 'checked' : ''} onchange="saveConfig()">
            <span class="slider"></span>
          </label>
        </div>
        <div class="hint">Abre automáticamente la ventana del QR al iniciar el servidor para facilitar la conexión móvil.</div>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn-primary" onclick="saveConfig()">💾 Save Settings</button>
      <button class="btn-warning" onclick="cmd('restartServer')">↺ Save & Restart</button>
    </div>
  </div>

  <!-- ─── Debug ─── -->
  <div class="pane" id="tab-debug">
    <div class="card">
      <div class="card-title">Estado del Sistema</div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:12px;align-items:center;">
        <span style="color:var(--vscode-descriptionForeground)">Server Status</span>
        <b id="dbg-status" style="color:${running ? '#3fb950' : '#f85149'}">${running ? '✅ Running' : '❌ Stopped'}</b>
        <span style="color:var(--vscode-descriptionForeground)">Tunnel URL</span>
        <code id="dbg-url" style="font-size:11px">${url || '—'}</code>
        <span style="color:var(--vscode-descriptionForeground)">Tunnel Provider</span>
        <b>${provider}</b>
        <span style="color:var(--vscode-descriptionForeground)">Local Port</span>
        <b>${port}</b>
      </div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div class="card-title" style="margin-bottom:0">Activity Log</div>
        <div class="btn-row">
          <button class="btn-secondary" onclick="clearLog()" style="padding:3px 8px;font-size:11px">Clear</button>
        </div>
      </div>
      <div id="log-box"><span class="log-ts">[Dashboard Ready]</span> Dashboard initialized.</div>
    </div>
  </div>

</div><!-- /content -->

<script>
  const vscode = acquireVsCodeApi();
  let currentUrl = ${JSON.stringify(url)};
  let isRunning = ${running};
  let currentQr = ${JSON.stringify(qr)};

  // ─ Tab switching ─
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  }
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  // ─ Refresh dashboard ─
  function refreshDash() {
    logEntry('info', 'Refreshing dashboard…');
    vscode.postMessage({ command: 'refresh' });
  }

  // ─ Commands ─
  function cmd(c, args = {}) {
    logEntry('info', '→ ' + c + (args.targetId ? ' (' + args.targetId + ')' : ''));
    vscode.postMessage({ command: c, ...args });
  }

  // ─ Copy URL ─
  function copyUrl() {
    if (currentUrl) {
      navigator.clipboard.writeText(currentUrl).then(() => logEntry('ok', 'URL copiada: ' + currentUrl));
    }
  }

  // ─ Test connection ─
  function testConn() {
    logEntry('info', 'Testing connection…');
    document.getElementById('test-result').style.display = 'none';
    vscode.postMessage({ command: 'testConnection' });
  }

  // ─ Save QR ─
  function saveQR() {
    const img = document.getElementById('qr-img');
    if (!img.src || img.src === window.location.href) return;
    const a = document.createElement('a');
    a.href = img.src;
    a.download = 'antigravity-qr.png';
    a.click();
  }

  // ─ Preview navigation ─
  function navigatePreview() {
    let url = document.getElementById('preview-url-input').value;
    if (url && !url.startsWith('http')) {
      url = currentUrl.split('?')[0] + url; 
    }
    document.getElementById('preview-frame').src = url;
  }
  function refreshPreview() {
    const f = document.getElementById('preview-frame');
    f.src = f.src;
  }
  function backPreview() { window.frames['preview-frame'].history.back(); }
  function forwardPreview() { window.frames['preview-frame'].history.forward(); }

  function selectFolder() {
    vscode.postMessage({ command: 'selectFolder' });
  }

  // ─ Save config ─
  function saveConfig() {
    vscode.postMessage({
      command: 'saveConfig',
      provider: document.getElementById('sel-provider').value,
      ngrokToken: document.getElementById('inp-token').value,
      port: parseInt(document.getElementById('inp-port').value),
      publicDir: document.getElementById('inp-dir').value,
      autoOpenQR: document.getElementById('chk-auto-open').checked
    });
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // ─ Ngrok token field toggle ─
  document.getElementById('sel-provider').addEventListener('change', function() {
    const show = this.value === 'ngrok' || this.value === 'auto';
    document.getElementById('ngrok-field').style.display = show ? 'block' : 'none';
  });

  // ─ Log helper ─
  function logEntry(type, msg) {
    const box = document.getElementById('log-box');
    const ts = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.innerHTML = \`<span class="log-ts">[\${ts}]</span> <span class="log-\${type}">\${msg}</span>\`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }
  function clearLog() {
    document.getElementById('log-box').innerHTML = '';
  }

  // ─ Messages from extension ─
  window.addEventListener('message', e => {
    const m = e.data;
    if (m.command === 'serverState') {
      isRunning = m.isRunning;
      currentUrl = m.url || '';
      currentQr = m.qrDataUrl || '';

      // Update status badge
      const dot = document.getElementById('dot');
      const label = document.getElementById('status-label');
      dot.style.background = isRunning ? '#3fb950' : '#f85149';
      label.style.color = isRunning ? '#3fb950' : '#f85149';
      label.textContent = isRunning ? 'Online' : 'Offline';

      // Update URL box
      document.getElementById('url-text').textContent = currentUrl || '—';

      // Update QR
      const qrImg = document.getElementById('qr-img');
      const qrEmpty = document.getElementById('qr-empty');
      if (currentQr) {
        qrImg.src = currentQr;
        qrImg.style.display = 'block';
        qrEmpty.style.display = 'none';
      } else {
        qrImg.style.display = 'none';
        qrEmpty.style.display = 'flex';
      }

      // Update preview input
      if (currentUrl) document.getElementById('preview-url-input').value = currentUrl;

      // Update instances list
      const instancesList = document.getElementById('instances-list');
      if (instancesList && m.instances) {
        if (m.instances.length === 0) {
          instancesList.innerHTML = '<div style="text-align:center;color:var(--vscode-descriptionForeground);padding:10px;">No active sessions found.</div>';
        } else {
          instancesList.innerHTML = '';
          m.instances.forEach(inst => {
            const isActive = inst.id === m.activeTargetId;
            const item = document.createElement('div');
            item.className = 'instance-item' + (isActive ? ' active' : '');
            
            const nameEl = document.createElement('span');
            nameEl.className = 'instance-name';
            nameEl.textContent = inst.title || 'Untitled Session';
            item.appendChild(nameEl);
            
            if (isActive) {
              const badge = document.createElement('span');
              badge.className = 'instance-badge';
              badge.textContent = 'Active';
              item.appendChild(badge);
            } else {
              item.onclick = () => cmd('switchInstance', { targetId: inst.id });
            }
            
            instancesList.appendChild(item);
          });
        }
      }

      logEntry(isRunning ? 'ok' : 'err', 'Server state: ' + (isRunning ? 'Online – ' + currentUrl : 'Offline'));

      // Update debug tab
      document.getElementById('dbg-status').textContent = isRunning ? '✅ Running' : '❌ Stopped';
      document.getElementById('dbg-status').style.color = isRunning ? '#3fb950' : '#f85149';
      document.getElementById('dbg-url').textContent = currentUrl || '—';

      // Enable / disable buttons
      document.getElementById('btn-start').disabled = isRunning;
      document.getElementById('btn-stop').disabled = !isRunning;
    }

    if (m.command === 'folderSelected') {
      document.getElementById('inp-dir').value = m.path;
      logEntry('info', 'Carpeta seleccionada: ' + m.path);
    }

    if (m.command === 'testResult') {
      const el = document.getElementById('test-result');
      el.style.display = 'block';
      if (m.ok) {
        el.style.background = '#3fb95022';
        el.style.color = '#3fb950';
        el.style.border = '1px solid #3fb95044';
        el.textContent = \`✅ Connection OK — HTTP \${m.statusCode} — \${m.ms}ms\`;
        logEntry('ok', \`Connection test OK (\${m.ms}ms)\`);
      } else {
        el.style.background = '#f8514922';
        el.style.color = '#f85149';
        el.style.border = '1px solid #f8514944';
        el.textContent = \`❌ Connection Failed — \${m.error || 'HTTP ' + m.statusCode}\`;
        logEntry('err', 'Connection test failed: ' + (m.error || m.statusCode));
      }
    }

    if (m.command === 'saveResult') {
      if (m.ok) {
        showToast('✅ Configuración guardada');
      }
    }
  });
</script>
</body>
</html>`;
  }
}
