import fs from 'fs';
import os from 'os';
import path from 'path';
import { type CodexInstallationSource } from '../types/codex';

interface CodexExecutableCandidate {
  path: string;
  source: Exclude<CodexInstallationSource, 'not-found'>;
}

function dedupeCandidates(candidates: CodexExecutableCandidate[]): CodexExecutableCandidate[] {
  const seen = new Set<string>();
  const deduped: CodexExecutableCandidate[] = [];

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate.path).toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(candidate);
  }

  return deduped;
}

function listVsCodeExtensionRoots(): string[] {
  if (process.platform !== 'win32') {
    return [];
  }

  const home = os.homedir();
  return [
    path.join(home, '.vscode', 'extensions'),
    path.join(home, '.vscode-insiders', 'extensions'),
  ];
}

function findWindowsVsCodeCodexCandidates(): CodexExecutableCandidate[] {
  const candidates: CodexExecutableCandidate[] = [];

  for (const extensionRoot of listVsCodeExtensionRoots()) {
    if (!fs.existsSync(extensionRoot)) {
      continue;
    }

    let entries: string[] = [];
    try {
      entries = fs.readdirSync(extensionRoot);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.startsWith('openai.chatgpt-')) {
        continue;
      }

      const executablePath = path.join(
        extensionRoot,
        entry,
        'bin',
        'windows-x86_64',
        'codex.exe',
      );

      if (fs.existsSync(executablePath)) {
        candidates.push({
          path: executablePath,
          source: 'vscode-extension',
        });
      }
    }
  }

  return candidates;
}

function findPathCandidates(): CodexExecutableCandidate[] {
  const envPath = process.env.PATH ?? '';
  const pathEntries = envPath.split(path.delimiter).filter(Boolean);
  const executableNames =
    process.platform === 'win32' ? ['codex.exe', 'codex.cmd', 'codex.bat'] : ['codex'];

  const candidates: CodexExecutableCandidate[] = [];
  for (const pathEntry of pathEntries) {
    for (const executableName of executableNames) {
      const executablePath = path.join(pathEntry, executableName);
      if (fs.existsSync(executablePath)) {
        candidates.push({
          path: executablePath,
          source: 'path',
        });
      }
    }
  }

  return candidates;
}

export function getCodexHomeDir(): string {
  return path.join(os.homedir(), '.codex');
}

export function getCodexAuthFilePath(): string {
  return path.join(getCodexHomeDir(), 'auth.json');
}

export function getCodexConfigFilePath(): string {
  return path.join(getCodexHomeDir(), 'config.toml');
}

export function getCodexStateFilePath(): string {
  return path.join(getCodexHomeDir(), 'state_5.sqlite');
}

export function getCodexSessionIndexFilePath(): string {
  return path.join(getCodexHomeDir(), 'session_index.jsonl');
}

export function getCodexExecutableCandidates(): CodexExecutableCandidate[] {
  return dedupeCandidates([...findPathCandidates(), ...findWindowsVsCodeCodexCandidates()]);
}
