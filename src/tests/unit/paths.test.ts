import { describe, it, expect, vi } from 'vitest';
import {
  getAppDataDir,
  getAntigravityDbPath,
  getAntigravityStoragePath,
  getAntigravityExecutablePath,
} from '../../utils/paths';

describe('Path Utilities', () => {
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
    process.env.PATH = 'C:\\Tools';

    const existsSync = vi.fn((candidate: string) => candidate === 'C:\\Tools\\codex.exe');
    const readdirSync = vi.fn(() => []);

    vi.doMock('fs', () => ({
      existsSync,
      readdirSync,
      default: {
        existsSync,
        readdirSync,
      },
    }));
    vi.doMock('os', () => ({
      homedir: () => 'C:\\Users\\Tester',
      default: {
        homedir: () => 'C:\\Users\\Tester',
      },
    }));

    const { getCodexExecutableCandidates } = await import('../../utils/codexPaths');
    const candidates = getCodexExecutableCandidates();

    expect(candidates).toEqual([
      {
        path: 'C:\\Tools\\codex.exe',
        source: 'path',
      },
    ]);
  });

  it('should resolve Codex extension fallback candidates on Windows', async () => {
    vi.resetModules();
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    process.env.PATH = '';

    const extensionRoot = 'C:\\Users\\Tester\\.vscode-insiders\\extensions';
    const executablePath =
      'C:\\Users\\Tester\\.vscode-insiders\\extensions\\openai.chatgpt-1.2.3\\bin\\windows-x86_64\\codex.exe';
    const existsSync = vi.fn((candidate: string) => {
      return candidate === extensionRoot || candidate === executablePath;
    });
    const readdirSync = vi.fn((candidate: string) => {
      if (candidate === extensionRoot) {
        return ['openai.chatgpt-1.2.3'];
      }
      return [];
    });

    vi.doMock('fs', () => ({
      existsSync,
      readdirSync,
      default: {
        existsSync,
        readdirSync,
      },
    }));
    vi.doMock('os', () => ({
      homedir: () => 'C:\\Users\\Tester',
      default: {
        homedir: () => 'C:\\Users\\Tester',
      },
    }));

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
