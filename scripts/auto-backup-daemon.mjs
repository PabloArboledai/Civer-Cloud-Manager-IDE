import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const REPO_ROOT = process.cwd();
const DAEMON_DEBOUNCE_MS = resolveNumber(
  process.env.AUTO_BACKUP_DEBOUNCE_MS,
  getGitConfig('auto-backup.debounce-ms'),
  15000,
);
const FALLBACK_CHECK_MS = resolveNumber(
  process.env.AUTO_BACKUP_FALLBACK_CHECK_MS,
  getGitConfig('auto-backup.fallback-check-ms'),
  60000,
);
const IGNORED_ROOT_SEGMENTS = new Set([
  '.git',
  '.codex',
  '.vite',
  'coverage',
  'dist',
  'logs',
  'node_modules',
  'out',
  'playwright-report',
  'test-results',
]);

let debounceTimer = null;
let backupInFlight = false;
let fallbackTimer = null;
let watcher = null;
let lastEventAt = 0;
let lastEventPath = null;

main();

function main() {
  log(
    `Watcher de auto-backup iniciado. Debounce=${DAEMON_DEBOUNCE_MS}ms, verificacion=${FALLBACK_CHECK_MS}ms.`,
  );

  runBackup({
    reason: 'sincronizacion inicial',
    forceQuietMs: null,
  });

  try {
    watcher = fs.watch(REPO_ROOT, { recursive: true }, handleFileSystemEvent);
  } catch (error) {
    log(
      `No se pudo iniciar fs.watch en modo recursivo. El watcher continuo no quedo disponible: ${stringifyError(
        error,
      )}`,
    );
  }

  if (watcher) {
    watcher.on('error', (error) => {
      log(`El watcher continuo emitio un error: ${stringifyError(error)}`);
    });
  }

  fallbackTimer = setInterval(() => {
    runBackup({
      reason: 'verificacion periodica',
      forceQuietMs: null,
    });
  }, FALLBACK_CHECK_MS);

  const shutdown = (signal) => {
    log(`Recibi ${signal}. Cerrando watcher de auto-backup.`);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }

    if (watcher) {
      watcher.close();
      watcher = null;
    }

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function handleFileSystemEvent(eventType, filename) {
  const normalizedPath = normalizeRelativePath(filename);
  if (!normalizedPath || shouldIgnore(normalizedPath)) {
    return;
  }

  lastEventAt = Date.now();
  lastEventPath = normalizedPath;

  log(`Cambio detectado (${eventType}) en ${normalizedPath}.`);
  scheduleDebouncedBackup();
}

function scheduleDebouncedBackup() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;

    const quietForMs = Date.now() - lastEventAt;
    if (quietForMs < DAEMON_DEBOUNCE_MS) {
      scheduleDebouncedBackup();
      return;
    }

    runBackup({
      reason: `debounce tras cambios en ${lastEventPath || 'ruta desconocida'}`,
      forceQuietMs: 1,
    });
  }, DAEMON_DEBOUNCE_MS);
}

function runBackup({ reason, forceQuietMs }) {
  if (backupInFlight) {
    log(`Se omite la corrida de respaldo porque ya hay una en curso. Motivo pendiente: ${reason}.`);
    return;
  }

  backupInFlight = true;

  try {
    log(`Ejecutando auto-backup. Motivo: ${reason}.`);

    const scriptPath = path.join(REPO_ROOT, 'scripts', 'auto-backup.mjs');
    const env = {
      ...process.env,
    };

    if (forceQuietMs !== null && forceQuietMs !== undefined) {
      env.AUTO_BACKUP_QUIET_MS = String(forceQuietMs);
    }

    const output = execFileSync(process.execPath, [scriptPath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (output.trim()) {
      for (const line of output.trim().split(/\r?\n/)) {
        log(`[auto-backup] ${line}`);
      }
    }
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString().trim() : '';
    const stdout = error.stdout ? error.stdout.toString().trim() : '';
    const details = stderr || stdout || stringifyError(error);
    log(`La corrida de auto-backup fallo: ${details}`);
  } finally {
    backupInFlight = false;
  }
}

function shouldIgnore(relativePath) {
  const normalized = relativePath.replace(/\//g, path.sep).replace(/\\/g, path.sep);
  const [firstSegment] = normalized.split(path.sep).filter(Boolean);

  if (!firstSegment) {
    return true;
  }

  return IGNORED_ROOT_SEGMENTS.has(firstSegment);
}

function normalizeRelativePath(value) {
  if (!value) {
    return '';
  }

  return String(value).replace(/\//g, path.sep).replace(/\\/g, path.sep);
}

function resolveNumber(...values) {
  for (const value of values) {
    const parsed = Number.parseInt(value || '', 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

function getGitConfig(key) {
  try {
    return execFileSync(resolveGitBinary(), ['config', '--get', key], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (error) {
    return '';
  }
}

function resolveGitBinary() {
  const explicitGit = process.env.AUTO_BACKUP_GIT_BIN;
  if (explicitGit && fs.existsSync(explicitGit)) {
    return explicitGit;
  }

  const commonCandidates = [
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
    'C:\\Program Files (x86)\\Git\\bin\\git.exe',
  ];

  for (const candidate of commonCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return 'git';
}

function stringifyError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}
