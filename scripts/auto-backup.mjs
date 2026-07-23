import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const REPO_ROOT = process.cwd();
const GIT_BIN = resolveGitBinary();
const GIT_DIR = resolveGitDir();
const STATE_FILE = path.join(GIT_DIR, 'auto-backup-state.json');

const DEFAULT_QUIET_MS = 5 * 60 * 1000;
const QUIET_MS = resolveQuietMs();
const BACKUP_REMOTE =
  process.env.AUTO_BACKUP_REMOTE || getGitConfig('auto-backup.remote') || 'backup';
const BACKUP_BRANCH =
  process.env.AUTO_BACKUP_BRANCH ||
  getGitConfig('auto-backup.branch') ||
  resolveCurrentBranch();
const COMMIT_NAME =
  process.env.AUTO_BACKUP_COMMIT_NAME || getGitConfig('user.name') || 'Bot de respaldo automático';
const COMMIT_EMAIL =
  process.env.AUTO_BACKUP_COMMIT_EMAIL ||
  getGitConfig('user.email') ||
  getGitConfig('auto-backup.commit-email');

main();

function main() {
  ensureGitRepository();
  ensureCommitIdentity();
  ensureBackupRemoteExists();

  if (hasActiveGitOperation()) {
    log('Git está ocupado con otra operación. Se omite esta ejecución.');
    return;
  }

  const state = readState();
  const headBeforeRun = getHeadHash();
  const entries = getStatusEntries();

  if (entries.length === 0) {
    state.lastDirtySignature = null;
    state.lastDirtyChangeAt = null;

    if (headBeforeRun !== state.lastSuccessfulHead) {
      log(`El árbol de trabajo está limpio y HEAD ${headBeforeRun} aún no se ha respaldado.`);
      pushCurrentHead(BACKUP_BRANCH);
      state.lastSuccessfulHead = getHeadHash();
      writeState(state);
      log(`El push de respaldo finalizó para ${state.lastSuccessfulHead}.`);
      return;
    }

    writeState(state);
    log('El árbol de trabajo está limpio y ya está respaldado. No hay nada que hacer.');
    return;
  }

  const signature = JSON.stringify(entries);
  const dirtyTimestamps = getDirtyTimestamps(entries);
  const nowMs = Date.now();

  if (state.lastDirtySignature !== signature) {
    state.lastDirtySignature = signature;
    state.lastDirtyChangeAt = dirtyTimestamps.hasMissingPaths
      ? nowMs
      : dirtyTimestamps.latestExistingChangeMs || nowMs;
  } else if (
    dirtyTimestamps.latestExistingChangeMs > 0 &&
    dirtyTimestamps.latestExistingChangeMs > (state.lastDirtyChangeAt || 0)
  ) {
    state.lastDirtyChangeAt = dirtyTimestamps.latestExistingChangeMs;
  }

  writeState(state);

  const quietForMs = nowMs - (state.lastDirtyChangeAt || nowMs);
  if (quietForMs < QUIET_MS) {
    log(
      `Se detectaron cambios pendientes, pero el periodo de silencio solo lleva ${Math.floor(
        quietForMs / 1000,
      )}s. Esperando ${Math.floor(QUIET_MS / 1000)}s.`,
    );
    return;
  }

  log(
    `Se detectaron cambios pendientes tras ${Math.floor(
      quietForMs / 1000,
    )}s de inactividad. Creando un snapshot de respaldo.`,
  );

  const committedHead = createBackupCommitIfNeeded(headBeforeRun);
  pushCurrentHead(BACKUP_BRANCH);

  state.lastSuccessfulHead = committedHead || getHeadHash();
  state.lastDirtySignature = null;
  state.lastDirtyChangeAt = null;
  writeState(state);

  log(`El push de respaldo finalizó para ${state.lastSuccessfulHead}.`);
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

  try {
    return execFileSync('where.exe', ['git'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
  } catch (error) {
    throw new Error(
      'No se pudo resolver Git. Define AUTO_BACKUP_GIT_BIN con una ruta válida a git.exe.',
    );
  }
}

function resolveGitDir() {
  return runGit(['rev-parse', '--absolute-git-dir']);
}

function resolveQuietMs() {
  const rawQuietValue =
    process.env.AUTO_BACKUP_QUIET_MS || getGitConfig('auto-backup.quiet-ms');
  const parsedQuietValue = Number.parseInt(rawQuietValue || '', 10);

  if (Number.isFinite(parsedQuietValue) && parsedQuietValue > 0) {
    return parsedQuietValue;
  }

  return DEFAULT_QUIET_MS;
}

function ensureGitRepository() {
  const repoRoot = runGit(['rev-parse', '--show-toplevel']);
  if (path.resolve(repoRoot) !== path.resolve(REPO_ROOT)) {
    throw new Error(
      `Ejecuta este script desde la raíz del repositorio. Se esperaba ${repoRoot} y se recibió ${REPO_ROOT}.`,
    );
  }
}

function ensureCommitIdentity() {
  const currentName = getGitConfig('user.name');
  const currentEmail = getGitConfig('user.email');

  if (!currentName && COMMIT_NAME) {
    runGit(['config', '--local', 'user.name', COMMIT_NAME]);
  }

  if (!currentEmail && COMMIT_EMAIL) {
    runGit(['config', '--local', 'user.email', COMMIT_EMAIL]);
  }

  const resolvedName = getGitConfig('user.name');
  const resolvedEmail = getGitConfig('user.email');

  if (!resolvedName || !resolvedEmail) {
    throw new Error(
      'Falta la identidad de commit de Git. Define AUTO_BACKUP_COMMIT_NAME y AUTO_BACKUP_COMMIT_EMAIL o configura git user.name y user.email.',
    );
  }
}

function ensureBackupRemoteExists() {
  const remoteUrl = runGit(['remote', 'get-url', BACKUP_REMOTE], { allowFailure: true });
  if (!remoteUrl) {
    throw new Error(
      `El remoto de respaldo "${BACKUP_REMOTE}" no está configurado. Ejecuta primero scripts/setup-auto-backup.mjs.`,
    );
  }
}

function hasActiveGitOperation() {
  const activeMarkers = [
    'index.lock',
    'MERGE_HEAD',
    'CHERRY_PICK_HEAD',
    'REVERT_HEAD',
    'BISECT_LOG',
    'rebase-apply',
    'rebase-merge',
  ];

  return activeMarkers.some((marker) => fs.existsSync(path.join(GIT_DIR, marker)));
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) {
    return {
      lastSuccessfulHead: null,
      lastDirtySignature: null,
      lastDirtyChangeAt: null,
    };
  }

  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (error) {
    log('No se pudo interpretar el estado previo de auto-backup. Se reconstruirá.');
    return {
      lastSuccessfulHead: null,
      lastDirtySignature: null,
      lastDirtyChangeAt: null,
    };
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function resolveCurrentBranch() {
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch && branch !== 'HEAD') {
    return branch;
  }

  return 'main';
}

function getHeadHash() {
  return runGit(['rev-parse', 'HEAD']);
}

function getStatusEntries() {
  const rawStatus = runGit(
    ['-c', 'core.quotepath=false', 'status', '--porcelain=v1', '--untracked-files=all'],
    { allowFailure: false, trim: false },
  );

  return rawStatus
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const code = line.slice(0, 2);
      const payload = line.slice(3);

      if (payload.includes(' -> ')) {
        const [originalPath, nextPath] = payload.split(' -> ');
        return {
          code,
          path: nextPath,
          originalPath,
        };
      }

      return {
        code,
        path: payload,
      };
    })
    .sort((left, right) => `${left.code}:${left.path}`.localeCompare(`${right.code}:${right.path}`));
}

function getDirtyTimestamps(entries) {
  let latestExistingChangeMs = 0;
  let hasMissingPaths = false;

  for (const entry of entries) {
    for (const candidatePath of [entry.path, entry.originalPath].filter(Boolean)) {
      const absolutePath = path.resolve(REPO_ROOT, candidatePath);
      if (!fs.existsSync(absolutePath)) {
        hasMissingPaths = true;
        continue;
      }

      const stats = fs.statSync(absolutePath);
      latestExistingChangeMs = Math.max(latestExistingChangeMs, stats.mtimeMs);
    }
  }

  return {
    latestExistingChangeMs,
    hasMissingPaths,
  };
}

function createBackupCommitIfNeeded(headBeforeRun) {
  runGit(['add', '-A']);

  const hasChangesAfterAdd = runGit(['status', '--porcelain=v1'], {
    allowFailure: false,
    trim: false,
  })
    .split(/\r?\n/)
    .filter(Boolean).length;

  if (hasChangesAfterAdd === 0) {
    log('Ya no quedaban cambios preparados al momento del commit. Se omite el paso de commit.');
    return headBeforeRun;
  }

  const commitMessage = `chore(auto-backup): respaldo ${new Date().toISOString()}`;
  runGit(['commit', '-m', commitMessage]);

  return getHeadHash();
}

function pushCurrentHead(branch) {
  runGit(['push', BACKUP_REMOTE, `HEAD:refs/heads/${branch}`]);
}

function getGitConfig(key) {
  return runGit(['config', '--get', key], { allowFailure: true });
}

function runGit(args, options = {}) {
  const { allowFailure = false, trim = true, input } = options;

  try {
    const output = execFileSync(GIT_BIN, args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      input,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return trim ? output.trim() : output;
  } catch (error) {
    if (allowFailure) {
      return '';
    }

    const stderr = error.stderr ? error.stderr.toString().trim() : '';
    const stdout = error.stdout ? error.stdout.toString().trim() : '';
    const details = stderr || stdout || error.message;
    throw new Error(`Git command failed: ${[GIT_BIN, ...args].join(' ')}\n${details}`);
  }
}

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}
