import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  getAppDataDir,
  getAntigravityDbPath,
  getAntigravityStoragePath,
  getAntigravityExecutablePath,
} from '../../utils/paths';

describe('Path Utilities', () => {
  const originalPlatform = process.platform;
  const originalPath = process.env.PATH;
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-paths-'));
    tempDirs.push(tempDir);
    return tempDir;
  }

  afterEach(() => {
    vi.resetModules();
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    process.env.PATH = originalPath;
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    if (originalUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = originalUserProfile;
    }
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should get correct AppData directory', () => {
    const appData = getAppDataDir();
    expect(appData).toBeDefined();
    expect(appData.length).toBeGreaterThan(0);
  });

  it('should get correct DB path', () => {
    const dbPath = getAntigravityDbPath();
    expect(dbPath).toContain('state.vscdb');
  });

  it('should get correct storage path', () => {
    const storagePath = getAntigravityStoragePath();
    expect(storagePath).toContain('storage.json');
  });

  it('should get correct executable path', () => {
    const execPath = getAntigravityExecutablePath();
    if (process.platform === 'linux') {
      expect(execPath).toBe('/usr/share/antigravity/antigravity');
    } else if (process.platform === 'darwin') {
      expect(execPath).toBe('/Applications/Antigravity.app/Contents/MacOS/Antigravity');
    }
    // Windows path depends on env vars, harder to test strictly without mocking
  });

  it('should resolve Codex path candidates from PATH on Windows', async () => {
    vi.resetModules();
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    const tempDir = createTempDir();
    const toolsDir = path.join(tempDir, 'Tools');
    const homeDir = path.join(tempDir, 'home');
    const executablePath = path.join(toolsDir, 'codex.exe');

    fs.mkdirSync(toolsDir, { recursive: true });
    fs.mkdirSync(homeDir, { recursive: true });
    fs.writeFileSync(executablePath, '');

    process.env.PATH = toolsDir;
    process.env.HOME = homeDir;
    process.env.USERPROFILE = homeDir;

    const { getCodexExecutableCandidates } = await import('../../utils/codexPaths');
    const candidates = getCodexExecutableCandidates();

    expect(candidates).toEqual([
      {
        path: executablePath,
        source: 'path',
      },
    ]);
  });

  it('should resolve Codex extension fallback candidates on Windows', async () => {
    vi.resetModules();
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    const tempDir = createTempDir();
    const homeDir = path.join(tempDir, 'home');
    const executablePath = path.join(
      homeDir,
      '.vscode-insiders',
      'extensions',
      'openai.chatgpt-1.2.3',
      'bin',
      'windows-x86_64',
      'codex.exe',
    );

    fs.mkdirSync(path.dirname(executablePath), { recursive: true });
    fs.writeFileSync(executablePath, '');

    process.env.PATH = '';
    process.env.HOME = homeDir;
    process.env.USERPROFILE = homeDir;

    const { getCodexExecutableCandidates } = await import('../../utils/codexPaths');
    const candidates = getCodexExecutableCandidates();

    expect(candidates).toEqual([
      {
        path: executablePath,
        source: 'vscode-extension',
      },
    ]);
  });
});
