import fs from 'fs';
import { createHash, randomUUID } from 'crypto';
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { promisify } from 'util';
import { shell } from 'electron';
import {
  type CodexAuthStatus,
  type CodexCallbackDiagnostics,
  type CodexConfigSnapshot,
  type CodexExecEvent,
  type CodexExecRequest,
  type CodexExecRequestResolved,
  type CodexExecRunSnapshot,
  type CodexExecRunSummary,
  type CodexInstallation,
  type CodexStatusSnapshot,
} from '../../types/codex';
import {
  getCodexAuthFilePath,
  getCodexConfigFilePath,
  getCodexExecutableCandidates,
  getCodexHomeDir,
  getCodexSessionIndexFilePath,
  getCodexStateFilePath,
} from '../../utils/codexPaths';
import { sanitizeObject } from '../../utils/sensitiveDataMasking';
import { logger } from '../../utils/logger';
import { ipcContext } from '../context';
import { IPC_CHANNELS } from '../../constants';

const execFileAsync = promisify(execFile);
const MAX_RUN_EVENTS = 200;
const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const SENSITIVE_QUERY_KEYS = new Set([
  'id_token',
  'access_token',
  'refresh_token',
  'token',
  'sid',
  'session_id',
  'cap_sid',
]);

interface ActiveRunState {
  child: ChildProcessWithoutNullStreams;
  stdoutBuffer: string;
  stderrBuffer: string;
  cancelRequested: boolean;
}

function maskAccountId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const digest = createHash('sha256').update(value).digest('hex');
  return `acct_${digest.slice(0, 12)}`;
}

function safeIsoFromEpoch(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value * 1000).toISOString();
}

function decodeJwtSegment(segment: string): Record<string, unknown> | null {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    const json = Buffer.from(`${normalized}${padding}`, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function parseCodexConfig(content: string): CodexConfigSnapshot {
  const lines = content.split(/\r?\n/);
  let currentSection = '';
  let model: string | null = null;
  let modelReasoningEffort: string | null = null;
  let profile: string | null = null;
  let sandboxMode: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    const keyValueMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*"?(.*?)"?$/);
    if (!keyValueMatch) {
      continue;
    }

    const [, key, value] = keyValueMatch;
    if (!currentSection) {
      if (key === 'model') {
        model = value;
      } else if (key === 'model_reasoning_effort') {
        modelReasoningEffort = value;
      } else if (key === 'profile') {
        profile = value;
      } else if (key === 'sandbox') {
        sandboxMode = value;
      }
      continue;
    }

    if (currentSection === 'windows' && key === 'sandbox') {
      sandboxMode = value;
    }
  }

  return {
    model,
    modelReasoningEffort,
    profile,
    sandboxMode,
  };
}

function readCodexConfigSnapshot(): CodexConfigSnapshot {
  const configPath = getCodexConfigFilePath();
  if (!fs.existsSync(configPath)) {
    return {
      model: null,
      modelReasoningEffort: null,
      profile: null,
      sandboxMode: null,
    };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return parseCodexConfig(content);
  } catch (error) {
    logger.warn('No se pudo leer la configuracion de Codex', error);
    return {
      model: null,
      modelReasoningEffort: null,
      profile: null,
      sandboxMode: null,
    };
  }
}

function deriveLoginLabel(
  authMode: string | null,
  hasApiKey: boolean,
  isAuthenticated: boolean,
): string {
  if (!isAuthenticated) {
    return 'No autenticado';
  }

  if (authMode?.toLowerCase().includes('chatgpt')) {
    return 'Autenticado con ChatGPT';
  }

  if (authMode?.toLowerCase().includes('api') || hasApiKey) {
    return 'Autenticado con API key';
  }

  return 'Autenticado';
}

function readCodexAuthStatus(): CodexAuthStatus {
  const authPath = getCodexAuthFilePath();
  if (!fs.existsSync(authPath)) {
    return {
      isAuthenticated: false,
      authMode: null,
      loginLabel: 'No autenticado',
      accountIdMasked: null,
      lastRefresh: null,
      hasAccessToken: false,
      hasRefreshToken: false,
      hasIdToken: false,
      hasApiKey: false,
    };
  }

  try {
    const content = fs.readFileSync(authPath, 'utf-8');
    const raw = JSON.parse(content) as {
      auth_mode?: string;
      OPENAI_API_KEY?: string | null;
      last_refresh?: string;
      tokens?: {
        access_token?: string;
        refresh_token?: string;
        id_token?: string;
        account_id?: string;
      };
    };

    const hasAccessToken = Boolean(raw.tokens?.access_token);
    const hasRefreshToken = Boolean(raw.tokens?.refresh_token);
    const hasIdToken = Boolean(raw.tokens?.id_token);
    const hasApiKey = Boolean(raw.OPENAI_API_KEY);
    const isAuthenticated = hasAccessToken || hasRefreshToken || hasIdToken || hasApiKey;
    const authMode = raw.auth_mode ?? null;

    return {
      isAuthenticated,
      authMode,
      loginLabel: deriveLoginLabel(authMode, hasApiKey, isAuthenticated),
      accountIdMasked: maskAccountId(raw.tokens?.account_id),
      lastRefresh: raw.last_refresh ?? null,
      hasAccessToken,
      hasRefreshToken,
      hasIdToken,
      hasApiKey,
    };
  } catch (error) {
    logger.warn('No se pudo leer el estado de autenticacion de Codex', error);
    return {
      isAuthenticated: false,
      authMode: null,
      loginLabel: 'Estado invalido',
      accountIdMasked: null,
      lastRefresh: null,
      hasAccessToken: false,
      hasRefreshToken: false,
      hasIdToken: false,
      hasApiKey: false,
    };
  }
}

async function readCodexVersion(executablePath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(executablePath, ['--version'], {
      windowsHide: true,
      timeout: 10_000,
    });
    const version = stdout.trim();
    return version.length > 0 ? version : null;
  } catch (error) {
    logger.warn('No se pudo leer la version de Codex', error);
    return null;
  }
}

export async function detectCodexInstallation(): Promise<CodexInstallation> {
  const candidates = getCodexExecutableCandidates();
  const selected = candidates[0];
  const executablePath = selected?.path ?? null;
  const version = executablePath ? await readCodexVersion(executablePath) : null;

  return {
    available: Boolean(executablePath),
    executablePath,
    source: selected?.source ?? 'not-found',
    version,
    codexHome: getCodexHomeDir(),
    authFileExists: fs.existsSync(getCodexAuthFilePath()),
    configFileExists: fs.existsSync(getCodexConfigFilePath()),
    stateFileExists: fs.existsSync(getCodexStateFilePath()),
    sessionIndexExists: fs.existsSync(getCodexSessionIndexFilePath()),
    detectedAt: new Date().toISOString(),
  };
}

function buildQueryDiagnostics(url: URL) {
  const parameterNames = Array.from(url.searchParams.keys());
  const sensitiveParams = parameterNames.filter((key) => SENSITIVE_QUERY_KEYS.has(key));
  const normalizedUrl = new URL(url.toString());
  const isLocalhostCallback = LOCALHOST_HOSTS.has(url.hostname) && url.pathname === '/success';
  const isAuthorizeUrl =
    url.hostname === 'auth.openai.com' && url.pathname.startsWith('/oauth/authorize');
  const flowType: CodexCallbackDiagnostics['queryFlags']['flowType'] = isLocalhostCallback
    ? 'localhost-callback'
    : isAuthorizeUrl
      ? 'authorize-url'
      : 'unknown';

  for (const key of sensitiveParams) {
    normalizedUrl.searchParams.set(key, '[REDACTED]');
  }

  const platformUrl = url.searchParams.get('platform_url');
  let platformUrlHost: string | null = null;
  if (platformUrl) {
    try {
      platformUrlHost = new URL(platformUrl).host;
    } catch {
      platformUrlHost = null;
    }
  }

  const redirectUri = url.searchParams.get('redirect_uri');
  let redirectUriHost: string | null = null;
  if (redirectUri) {
    try {
      redirectUriHost = new URL(redirectUri).host;
    } catch {
      redirectUriHost = null;
    }
  }

  return {
    parameterNames,
    sensitiveParams,
    normalizedUrl: normalizedUrl.toString(),
    queryFlags: {
      flowType,
      needsSetup: url.searchParams.has('needs_setup')
        ? url.searchParams.get('needs_setup') === 'true'
        : null,
      planType: url.searchParams.get('plan_type'),
      hasOrgId: Boolean(url.searchParams.get('org_id')),
      hasProjectId: Boolean(url.searchParams.get('project_id')),
      platformUrlHost,
      redirectUriHost,
      hasState: Boolean(url.searchParams.get('state')),
      hasCodeChallenge: Boolean(url.searchParams.get('code_challenge')),
      originator: url.searchParams.get('originator'),
    },
  };
}

function extractTokenMetadata(idToken: string | null) {
  if (!idToken) {
    return null;
  }

  const [headerSegment, claimsSegment] = idToken.split('.');
  if (!headerSegment || !claimsSegment) {
    return null;
  }

  const header = decodeJwtSegment(headerSegment);
  const claims = decodeJwtSegment(claimsSegment);
  const authInfo =
    claims && typeof claims['https://api.openai.com/auth'] === 'object'
      ? (claims['https://api.openai.com/auth'] as Record<string, unknown>)
      : null;

  const audienceValue = claims?.aud;
  const audienceCount = Array.isArray(audienceValue)
    ? audienceValue.length
    : audienceValue
      ? 1
      : null;
  const organizationsValue = authInfo?.organizations;
  const organizationCount = Array.isArray(organizationsValue) ? organizationsValue.length : null;
  const platformUrlValue =
    typeof authInfo?.platform_url === 'string'
      ? authInfo.platform_url
      : typeof claims?.platform_url === 'string'
        ? claims.platform_url
        : null;
  let platformUrlHost: string | null = null;
  if (platformUrlValue) {
    try {
      platformUrlHost = new URL(platformUrlValue).host;
    } catch {
      platformUrlHost = null;
    }
  }

  return {
    header: {
      alg: typeof header?.alg === 'string' ? header.alg : null,
      typ: typeof header?.typ === 'string' ? header.typ : null,
      kid: typeof header?.kid === 'string' ? header.kid : null,
    },
    claims: {
      issuer: typeof claims?.iss === 'string' ? claims.iss : null,
      audienceCount,
      issuedAt: safeIsoFromEpoch(claims?.iat),
      expiresAt: safeIsoFromEpoch(claims?.exp),
      authProvider:
        typeof claims?.auth_provider === 'string'
          ? claims.auth_provider
          : typeof authInfo?.auth_provider === 'string'
            ? String(authInfo.auth_provider)
            : null,
      planType: typeof authInfo?.chatgpt_plan_type === 'string' ? authInfo.chatgpt_plan_type : null,
      localhost: typeof authInfo?.localhost === 'boolean' ? authInfo.localhost : null,
      organizationCount,
      projectIdPresent: Boolean(authInfo?.project_id),
      platformUrlHost,
    },
  };
}

export function analyzeCodexCallback(input: string): CodexCallbackDiagnostics {
  const warnings: string[] = [];
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return {
      valid: false,
      normalizedUrl: null,
      host: null,
      port: null,
      path: null,
      parameterNames: [],
      sensitiveParams: [],
      warnings: ['No se recibio ningun callback para analizar.'],
      queryFlags: {
        flowType: 'unknown',
        needsSetup: null,
        planType: null,
        hasOrgId: false,
        hasProjectId: false,
        platformUrlHost: null,
        redirectUriHost: null,
        hasState: false,
        hasCodeChallenge: false,
        originator: null,
      },
      tokenMetadata: null,
    };
  }

  const rawUrl = trimmedInput.startsWith('http')
    ? trimmedInput
    : trimmedInput.startsWith('?')
      ? `http://localhost:1455/success${trimmedInput}`
      : `http://localhost:1455/success?${trimmedInput}`;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return {
      valid: false,
      normalizedUrl: null,
      host: null,
      port: null,
      path: null,
      parameterNames: [],
      sensitiveParams: [],
      warnings: ['El callback no tiene un formato de URL valido.'],
      queryFlags: {
        flowType: 'unknown',
        needsSetup: null,
        planType: null,
        hasOrgId: false,
        hasProjectId: false,
        platformUrlHost: null,
        redirectUriHost: null,
        hasState: false,
        hasCodeChallenge: false,
        originator: null,
      },
      tokenMetadata: null,
    };
  }

  const queryDiagnostics = buildQueryDiagnostics(url);
  if (queryDiagnostics.queryFlags.flowType === 'localhost-callback') {
    if (!url.searchParams.get('id_token')) {
      warnings.push('No se detecto id_token en el callback.');
    }
  } else if (queryDiagnostics.queryFlags.flowType === 'authorize-url') {
    if (!queryDiagnostics.queryFlags.redirectUriHost) {
      warnings.push('No se detecto un redirect_uri valido en la URL de autorizacion.');
    }
    if (!queryDiagnostics.queryFlags.hasState) {
      warnings.push('La URL de autorizacion no incluye state.');
    }
    if (!queryDiagnostics.queryFlags.hasCodeChallenge) {
      warnings.push('La URL de autorizacion no incluye code_challenge.');
    }
  } else {
    warnings.push(
      'La URL no coincide con un callback localhost ni con una URL oficial de autorizacion.',
    );
  }

  return {
    valid: warnings.length === 0,
    normalizedUrl: queryDiagnostics.normalizedUrl,
    host: url.hostname,
    port: url.port ? Number.parseInt(url.port, 10) : null,
    path: url.pathname,
    parameterNames: queryDiagnostics.parameterNames,
    sensitiveParams: queryDiagnostics.sensitiveParams,
    warnings,
    queryFlags: queryDiagnostics.queryFlags,
    tokenMetadata: extractTokenMetadata(url.searchParams.get('id_token')),
  };
}

function normalizeCodexExecRequest(request: CodexExecRequest): CodexExecRequestResolved {
  return {
    prompt: request.prompt,
    cwd: request.cwd,
    model: request.model,
    sandbox: request.sandbox,
    profile: request.profile,
    skipGitRepoCheck: request.skipGitRepoCheck ?? false,
    fullAuto: request.fullAuto ?? false,
  };
}

function createCommandPreview(request: CodexExecRequestResolved): string {
  const segments = ['codex exec --json'];
  if (request.model) {
    segments.push(`-m ${request.model}`);
  }
  if (request.sandbox) {
    segments.push(`-s ${request.sandbox}`);
  }
  if (request.profile) {
    segments.push(`-p ${request.profile}`);
  }
  if (request.skipGitRepoCheck) {
    segments.push('--skip-git-repo-check');
  }
  if (request.fullAuto) {
    segments.push('--full-auto');
  }
  segments.push(`-C ${request.cwd}`);
  return segments.join(' ');
}

function ensureDirectoryExists(cwd: string): void {
  if (!fs.existsSync(cwd)) {
    throw new Error(`El directorio no existe: ${cwd}`);
  }
  const stats = fs.statSync(cwd);
  if (!stats.isDirectory()) {
    throw new Error(`La ruta no es un directorio: ${cwd}`);
  }
}

function emitCodexExecEvent(event: CodexExecEvent): void {
  const sanitizedEvent = sanitizeObject(event) as CodexExecEvent;
  if (ipcContext.mainWindow) {
    ipcContext.mainWindow.webContents.send(IPC_CHANNELS.CODEX_EXEC_EVENT, sanitizedEvent);
  }
}

class CodexExecManager {
  private readonly runs = new Map<string, CodexExecRunSnapshot>();
  private readonly activeRuns = new Map<string, ActiveRunState>();
  private lastRunId: string | null = null;

  public getLastRunSummary(): CodexExecRunSummary | null {
    return this.lastRunId ? (this.runs.get(this.lastRunId)?.summary ?? null) : null;
  }

  public getRun(runId: string): CodexExecRunSnapshot | null {
    return this.runs.get(runId) ?? null;
  }

  public cancel(runId: string): void {
    const activeRun = this.activeRuns.get(runId);
    if (!activeRun) {
      throw new Error('No hay una ejecucion activa con ese identificador.');
    }

    activeRun.cancelRequested = true;
    activeRun.child.kill();
  }

  public start(executablePath: string, request: CodexExecRequestResolved): CodexExecRunSnapshot {
    if (this.activeRuns.size > 0) {
      throw new Error('Ya hay una ejecucion de Codex en curso.');
    }

    ensureDirectoryExists(request.cwd);
    const runId = randomUUID();
    const args = ['exec', '--json', '-C', request.cwd];

    if (request.model) {
      args.push('-m', request.model);
    }
    if (request.sandbox) {
      args.push('-s', request.sandbox);
    }
    if (request.profile) {
      args.push('-p', request.profile);
    }
    if (request.skipGitRepoCheck) {
      args.push('--skip-git-repo-check');
    }
    if (request.fullAuto) {
      args.push('--full-auto');
    }
    args.push(request.prompt);

    const child = spawn(executablePath, args, {
      cwd: request.cwd,
      stdio: 'pipe',
      windowsHide: true,
    });

    const summary: CodexExecRunSummary = {
      runId,
      status: 'running',
      commandPreview: createCommandPreview(request),
      cwd: request.cwd,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      exitCode: null,
      signal: null,
      lastMessage: null,
      eventCount: 0,
      errorMessage: null,
    };
    const snapshot: CodexExecRunSnapshot = {
      summary,
      events: [],
    };

    this.runs.set(runId, snapshot);
    this.activeRuns.set(runId, {
      child,
      stdoutBuffer: '',
      stderrBuffer: '',
      cancelRequested: false,
    });
    this.lastRunId = runId;

    this.appendEvent(runId, {
      runId,
      kind: 'start',
      at: new Date().toISOString(),
      summary: { ...summary },
    });

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => this.handleStdout(runId, chunk));
    child.stderr.on('data', (chunk: string) => this.handleStderr(runId, chunk));

    child.on('error', (error) => {
      this.finalizeRun(runId, {
        status: 'failed',
        exitCode: null,
        signal: null,
        errorMessage: error.message,
      });
      this.appendEvent(runId, {
        runId,
        kind: 'error',
        at: new Date().toISOString(),
        line: error.message,
        summary: { ...this.runs.get(runId)!.summary },
      });
    });

    child.on('close', (exitCode, signal) => {
      const activeRun = this.activeRuns.get(runId);
      const status =
        activeRun?.cancelRequested === true ? 'cancelled' : exitCode === 0 ? 'completed' : 'failed';

      this.flushBuffers(runId);
      this.finalizeRun(runId, {
        status,
        exitCode,
        signal,
        errorMessage:
          status === 'failed' ? `Proceso finalizado con codigo ${exitCode ?? 'desconocido'}` : null,
      });
      this.appendEvent(runId, {
        runId,
        kind: 'exit',
        at: new Date().toISOString(),
        line:
          status === 'cancelled'
            ? 'Ejecucion cancelada por el usuario.'
            : `Proceso finalizado con codigo ${exitCode ?? 'desconocido'}.`,
        summary: { ...this.runs.get(runId)!.summary },
      });
      this.activeRuns.delete(runId);
    });

    return snapshot;
  }

  private flushBuffers(runId: string): void {
    const activeRun = this.activeRuns.get(runId);
    if (!activeRun) {
      return;
    }

    if (activeRun.stdoutBuffer.trim()) {
      this.processStdoutLine(runId, activeRun.stdoutBuffer.trim());
      activeRun.stdoutBuffer = '';
    }
    if (activeRun.stderrBuffer.trim()) {
      this.processStderrLine(runId, activeRun.stderrBuffer.trim());
      activeRun.stderrBuffer = '';
    }
  }

  private finalizeRun(
    runId: string,
    input: {
      status: CodexExecRunSummary['status'];
      exitCode: number | null;
      signal: string | null;
      errorMessage: string | null;
    },
  ): void {
    const snapshot = this.runs.get(runId);
    if (!snapshot) {
      return;
    }

    snapshot.summary = {
      ...snapshot.summary,
      status: input.status,
      exitCode: input.exitCode,
      signal: input.signal,
      errorMessage: input.errorMessage,
      finishedAt: new Date().toISOString(),
    };
  }

  private handleStdout(runId: string, chunk: string): void {
    const activeRun = this.activeRuns.get(runId);
    if (!activeRun) {
      return;
    }

    activeRun.stdoutBuffer += chunk;
    const lines = activeRun.stdoutBuffer.split(/\r?\n/);
    activeRun.stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      this.processStdoutLine(runId, line);
    }
  }

  private handleStderr(runId: string, chunk: string): void {
    const activeRun = this.activeRuns.get(runId);
    if (!activeRun) {
      return;
    }

    activeRun.stderrBuffer += chunk;
    const lines = activeRun.stderrBuffer.split(/\r?\n/);
    activeRun.stderrBuffer = lines.pop() ?? '';
    for (const line of lines) {
      this.processStderrLine(runId, line);
    }
  }

  private processStdoutLine(runId: string, line: string): void {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let parsed: unknown;
    let kind: CodexExecEvent['kind'] = 'stdout-text';
    try {
      parsed = JSON.parse(trimmed);
      kind = 'stdout-json';
    } catch {
      parsed = undefined;
    }

    this.updateLastMessage(runId, trimmed);
    this.appendEvent(runId, {
      runId,
      kind,
      at: new Date().toISOString(),
      line: trimmed,
      parsed,
      summary: { ...this.runs.get(runId)!.summary },
    });
  }

  private processStderrLine(runId: string, line: string): void {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    const snapshot = this.runs.get(runId);
    if (snapshot) {
      snapshot.summary = {
        ...snapshot.summary,
        errorMessage: trimmed,
      };
    }

    this.appendEvent(runId, {
      runId,
      kind: 'stderr',
      at: new Date().toISOString(),
      line: trimmed,
      summary: { ...this.runs.get(runId)!.summary },
    });
  }

  private updateLastMessage(runId: string, line: string): void {
    const snapshot = this.runs.get(runId);
    if (!snapshot) {
      return;
    }

    snapshot.summary = {
      ...snapshot.summary,
      lastMessage: line,
    };
  }

  private appendEvent(runId: string, event: CodexExecEvent): void {
    const snapshot = this.runs.get(runId);
    if (!snapshot) {
      return;
    }

    snapshot.events = [...snapshot.events, event].slice(-MAX_RUN_EVENTS);
    snapshot.summary = {
      ...snapshot.summary,
      eventCount: snapshot.events.length,
    };
    const eventWithSummary = {
      ...event,
      summary: { ...snapshot.summary },
    };
    snapshot.events[snapshot.events.length - 1] = eventWithSummary;
    emitCodexExecEvent(eventWithSummary);
  }
}

const codexExecManager = new CodexExecManager();

export async function getCodexStatus(): Promise<CodexStatusSnapshot> {
  const installation = await detectCodexInstallation();
  return {
    installation,
    auth: readCodexAuthStatus(),
    config: readCodexConfigSnapshot(),
    lastRun: codexExecManager.getLastRunSummary(),
  };
}

export async function openCodexLogin(): Promise<void> {
  const installation = await detectCodexInstallation();
  if (!installation.available || !installation.executablePath) {
    throw new Error('No se encontro ninguna instalacion de Codex.');
  }

  if (process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/c', 'start', '""', installation.executablePath, 'login'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();
    return;
  }

  const child = spawn(installation.executablePath, ['login'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

export async function logoutCodex(): Promise<void> {
  const installation = await detectCodexInstallation();
  if (!installation.available || !installation.executablePath) {
    throw new Error('No se encontro ninguna instalacion de Codex.');
  }

  await execFileAsync(installation.executablePath, ['logout'], {
    windowsHide: true,
    timeout: 15_000,
  });
}

export async function openCodexHome(): Promise<void> {
  const result = await shell.openPath(getCodexHomeDir());
  if (result) {
    throw new Error(`No se pudo abrir la carpeta de Codex: ${result}`);
  }
}

export async function startCodexExec(request: CodexExecRequest): Promise<CodexExecRunSnapshot> {
  const installation = await detectCodexInstallation();
  if (!installation.available || !installation.executablePath) {
    throw new Error('No se encontro ninguna instalacion de Codex.');
  }

  return codexExecManager.start(installation.executablePath, normalizeCodexExecRequest(request));
}

export async function cancelCodexExec(runId: string): Promise<void> {
  codexExecManager.cancel(runId);
}

export async function getCodexRun(runId: string): Promise<CodexExecRunSnapshot | null> {
  return codexExecManager.getRun(runId);
}

export function __resetCodexExecManagerForTests(): void {
  (codexExecManager as unknown as { runs: Map<string, CodexExecRunSnapshot> }).runs.clear();
  (codexExecManager as unknown as { activeRuns: Map<string, ActiveRunState> }).activeRuns.clear();
  (codexExecManager as unknown as { lastRunId: string | null }).lastRunId = null;
}
