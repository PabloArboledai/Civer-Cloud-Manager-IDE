import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';

const REPO_ROOT = process.cwd();
const GIT_BIN = resolveGitBinary();

const BACKUP_REMOTE =
  process.env.AUTO_BACKUP_REMOTE || getGitConfig('auto-backup.remote') || 'backup';
const REPO_NAME =
  process.env.AUTO_BACKUP_REPO_NAME || `${slugify(path.basename(REPO_ROOT))}-private-backup`;
const TOKEN = process.env.AUTO_BACKUP_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
const COMMIT_NAME =
  process.env.AUTO_BACKUP_COMMIT_NAME || getGitConfig('user.name') || 'Auto Backup Bot';

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

async function main() {
  ensureGitRepository();

  if (!TOKEN) {
    throw new Error(
      'Missing GitHub token. Set AUTO_BACKUP_GITHUB_TOKEN or GITHUB_TOKEN before running setup-auto-backup.mjs.',
    );
  }

  const viewer = await githubRequest('/user');
  const repo = await ensurePrivateRepository(viewer.login);
  const commitEmail =
    process.env.AUTO_BACKUP_COMMIT_EMAIL ||
    getGitConfig('user.email') ||
    `${viewer.id}+${viewer.login}@users.noreply.github.com`;

  runGit(['config', '--local', 'credential.helper', 'manager']);
  storeGitHubCredential(viewer.login, TOKEN);
  configureRemote(repo.clone_url);
  configureAutoBackupSettings(commitEmail);

  console.log(`Configured backup remote "${BACKUP_REMOTE}" -> ${repo.clone_url}`);
  console.log(`Configured backup branch "${resolveCurrentBranch()}".`);
  console.log('Stored GitHub credentials in Git Credential Manager.');
}

function ensureGitRepository() {
  const repoRoot = runGit(['rev-parse', '--show-toplevel']);
  if (path.resolve(repoRoot) !== path.resolve(REPO_ROOT)) {
    throw new Error(
      `Run this script from the repository root. Expected ${repoRoot}, received ${REPO_ROOT}.`,
    );
  }
}

async function ensurePrivateRepository(login) {
  const existingRepository = await githubRequest(`/repos/${login}/${REPO_NAME}`, {
    allowNotFound: true,
  });

  if (existingRepository) {
    if (!existingRepository.private) {
      throw new Error(
        `The repository ${login}/${REPO_NAME} already exists and is not private. Choose a different AUTO_BACKUP_REPO_NAME.`,
      );
    }

    return existingRepository;
  }

  return githubRequest('/user/repos', {
    method: 'POST',
    body: {
      name: REPO_NAME,
      private: true,
      description: `Automated backup mirror for ${path.basename(REPO_ROOT)}`,
      auto_init: false,
    },
  });
}

function configureRemote(cloneUrl) {
  const existingUrl = runGit(['remote', 'get-url', BACKUP_REMOTE], { allowFailure: true });

  if (!existingUrl) {
    runGit(['remote', 'add', BACKUP_REMOTE, cloneUrl]);
    return;
  }

  if (existingUrl !== cloneUrl) {
    runGit(['remote', 'set-url', BACKUP_REMOTE, cloneUrl]);
  }
}

function configureAutoBackupSettings(commitEmail) {
  runGit(['config', '--local', 'auto-backup.remote', BACKUP_REMOTE]);
  runGit(['config', '--local', 'auto-backup.branch', resolveCurrentBranch()]);
  runGit(['config', '--local', 'auto-backup.quiet-ms', '300000']);
  runGit(['config', '--local', 'auto-backup.commit-email', commitEmail]);
  runGit(['config', '--local', 'user.name', COMMIT_NAME]);
  runGit(['config', '--local', 'user.email', commitEmail]);
}

function storeGitHubCredential(login, token) {
  runGit(['credential-manager', 'store'], {
    input: `protocol=https\nhost=github.com\nusername=${login}\npassword=${token}\n\n`,
  });
}

async function githubRequest(endpoint, options = {}) {
  const { method = 'GET', body, allowNotFound = false } = options;
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': 'DraculaboAntigravityManager-auto-backup',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (allowNotFound && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const failureBody = await response.text();
    throw new Error(
      `GitHub API request failed (${response.status} ${response.statusText}) for ${endpoint}: ${failureBody}`,
    );
  }

  return response.json();
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

  throw new Error(
    'Git could not be resolved. Set AUTO_BACKUP_GIT_BIN to a valid git.exe path before running setup.',
  );
}

function resolveCurrentBranch() {
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch && branch !== 'HEAD') {
    return branch;
  }

  return 'main';
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function getGitConfig(key) {
  return runGit(['config', '--get', key], { allowFailure: true });
}

function runGit(args, options = {}) {
  const { allowFailure = false, input } = options;

  try {
    return execFileSync(GIT_BIN, args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      input,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
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
