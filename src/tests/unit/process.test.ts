import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock find-process module
vi.mock('find-process', () => ({
  default: vi.fn(),
}));

const childProcessMocks = vi.hoisted(() => ({
  exec: vi.fn(),
  execSync: vi.fn(),
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: childProcessMocks.exec,
  execSync: childProcessMocks.execSync,
  execFile: childProcessMocks.execFile,
  spawn: childProcessMocks.spawn,
  default: {
    exec: childProcessMocks.exec,
    execSync: childProcessMocks.execSync,
    execFile: childProcessMocks.execFile,
    spawn: childProcessMocks.spawn,
  },
}));

vi.mock('electron', () => ({
  shell: {
    openPath: vi.fn(() => Promise.resolve('')),
  },
}));

// Mock logger to avoid console output during tests
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock paths module to avoid child_process issues
vi.mock('../../utils/paths', () => ({
  getAntigravityExecutablePath: vi.fn(() => '/path/to/antigravity'),
  isWsl: vi.fn(() => false),
}));

// Import after mocks are set up
import { isProcessRunning, closeAntigravity, startAntigravity } from '../../ipc/process/handler';
import {
  analyzeCodexCallback,
  parseCodexAuthStatus,
  parseCodexConfig,
} from '../../ipc/codex/handler';
import findProcess from 'find-process';

describe('Process Handler', () => {
  const mockFindProcess = findProcess as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isProcessRunning', () => {
    it('should return true when Antigravity main process is found on macOS', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12345,
          name: 'Antigravity',
          cmd: '/Applications/Antigravity.app/Contents/MacOS/Antigravity',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(true);
      expect(mockFindProcess).toHaveBeenCalledWith('name', 'Antigravity', true);
    });

    it('should return false when only helper processes are found', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12346,
          name: 'Antigravity Helper (Renderer)',
          cmd: '/Applications/Antigravity.app/Contents/Frameworks/Antigravity Helper (Renderer).app --type=renderer',
        },
        {
          pid: 12347,
          name: 'Antigravity Helper (GPU)',
          cmd: '/Applications/Antigravity.app/Contents/Frameworks/Antigravity Helper (GPU).app --type=gpu-process',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(false);
    });

    it('should return false when only manager process is found', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12348,
          name: 'Antigravity Manager',
          cmd: '/Applications/Antigravity Manager.app/Contents/MacOS/Antigravity Manager',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(false);
    });

    it('should return false when no processes are found', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([]);

      const result = await isProcessRunning();
      expect(result).toBe(false);
    });

    it('should skip self process', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 12345, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12345, // Same as current PID
          name: 'Antigravity',
          cmd: '/Applications/Antigravity.app/Contents/MacOS/Antigravity',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(false);
    });

    it('should return true when Antigravity.exe is found on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12345,
          name: 'Antigravity.exe',
          cmd: 'C:\\Program Files\\Antigravity\\Antigravity.exe',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(true);
    });

    it('should return true when antigravity is found on Linux', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12345,
          name: 'antigravity',
          cmd: '/usr/bin/antigravity',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(true);
    });

    it('should handle find-process errors gracefully', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockRejectedValue(new Error('Process enumeration failed'));

      const result = await isProcessRunning();
      expect(result).toBe(false);
    });

    it('should exclude processes with --type= argument', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12345,
          name: 'Antigravity',
          cmd: '/Applications/Antigravity.app/Contents/MacOS/Antigravity --type=utility',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(false);
    });
  });

  describe('Module exports', () => {
    it('should export all required functions', () => {
      expect(isProcessRunning).toBeDefined();
      expect(closeAntigravity).toBeDefined();
      expect(startAntigravity).toBeDefined();
    });
  });

  describe('Codex helper parsing', () => {
    it('should parse a safe subset of Codex config.toml', () => {
      const snapshot = parseCodexConfig(`
model = "gpt-5.4"
model_reasoning_effort = "high"
profile = "default"
[windows]
sandbox = "workspace-write"
`);

      expect(snapshot).toEqual({
        model: 'gpt-5.4',
        modelReasoningEffort: 'high',
        profile: 'default',
        sandboxMode: 'workspace-write',
      });
    });

    it('should analyze localhost callbacks without exposing token values', () => {
      const diagnostics = analyzeCodexCallback(
        'http://localhost:1455/success?id_token=aaa.bbb.ccc&needs_setup=false&plan_type=free',
      );

      expect(diagnostics.host).toBe('localhost');
      expect(diagnostics.path).toBe('/success');
      expect(diagnostics.queryFlags.flowType).toBe('localhost-callback');
      expect(diagnostics.sensitiveParams).toContain('id_token');
      expect(diagnostics.normalizedUrl).toContain('id_token=%5BREDACTED%5D');
      expect(diagnostics.queryFlags.planType).toBe('free');
    });

    it('should analyze official authorize URLs used by VS Code style Codex login flows', () => {
      const diagnostics = analyzeCodexCallback(
        'https://auth.openai.com/oauth/authorize?response_type=code&client_id=app_EMoamEEZ73f0CkXaXp7hrann&redirect_uri=http://localhost:1455/auth/callback&scope=openid%20profile%20email%20offline_access&code_challenge=abc123&code_challenge_method=S256&state=test-state&originator=codex_vscode',
      );

      expect(diagnostics.valid).toBe(true);
      expect(diagnostics.host).toBe('auth.openai.com');
      expect(diagnostics.queryFlags.flowType).toBe('authorize-url');
      expect(diagnostics.queryFlags.redirectUriHost).toBe('localhost:1455');
      expect(diagnostics.queryFlags.originator).toBe('codex_vscode');
      expect(diagnostics.queryFlags.hasState).toBe(true);
      expect(diagnostics.queryFlags.hasCodeChallenge).toBe(true);
    });

    it('should derive a redacted Codex identity card from local auth.json content', () => {
      const authStatus = parseCodexAuthStatus(`{
  "auth_mode": "chatgpt",
  "OPENAI_API_KEY": null,
  "tokens": {
    "id_token": "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImxhbnViLm9yZ0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6Ik51YmUgVmlydHVhbCIsImF1dGhfcHJvdmlkZXIiOiJwYXNzd29yZCIsImV4cCI6MTc3NTU3MzgxMH0.sig",
    "access_token": "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NzY0MzQyMTEsImh0dHBzOi8vYXBpLm9wZW5haS5jb20vYXV0aCI6eyJjaGF0Z3B0X2FjY291bnRfaWQiOiI5YTllMTM2YS04YWJjLTQzZmYtYmEzOC05OThlYjQxNzAxNDgiLCJjaGF0Z3B0X3VzZXJfaWQiOiJ1c2VyLUxCV3RWVUUxeTZ3Z2xWTFdFMjE0VWtIeSIsImNoYXRncHRfcGxhbl90eXBlIjoidGVhbSIsImNoYXRncHRfc3Vic2NyaXB0aW9uX2FjdGl2ZV9zdGFydCI6IjIwMjYtMDQtMDJUMDY6Mzk6NDErMDA6MDAiLCJjaGF0Z3B0X3N1YnNjcmlwdGlvbl9hY3RpdmVfdW50aWwiOiIyMDI2LTA1LTAyVDA2OjM5OjQxKzAwOjAwIiwiY2hhdGdwdF9zdWJzY3JpcHRpb25fbGFzdF9jaGVja2VkIjoiMjAyNi0wNC0wN1QxMzo1Njo0Ni44MDE2NzMrMDA6MDAiLCJsb2NhbGhvc3QiOnRydWUsIm9yZ2FuaXphdGlvbnMiOlt7InRpdGxlIjoiUGVyc29uYWwiLCJyb2xlIjoib3duZXIiLCJpc19kZWZhdWx0Ijp0cnVlfV0sInBsYXRmb3JtX3VybCI6Imh0dHBzOi8vcGxhdGZvcm0ub3BlbmFpLmNvbSIsInVzZXJfaWQiOiJ1c2VyLUxCV3RWVUUxeTZ3Z2xWTFdFMjE0VWtIeSJ9LCJodHRwczovL2FwaS5vcGVuYWkuY29tL3Byb2ZpbGUiOnsiZW1haWwiOiJsYW51Yi5vcmdAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWV9fQ.sig",
    "refresh_token": "rt_value",
    "account_id": "9a9e136a-8abc-43ff-ba38-998eb4170148"
  },
  "last_refresh": "2026-04-07T13:56:51.572425600Z"
}`);

      expect(authStatus.isAuthenticated).toBe(true);
      expect(authStatus.loginLabel).toBe('Autenticado con ChatGPT');
      expect(authStatus.identity?.emailMasked).toBe('la***@gm***.com');
      expect(authStatus.identity?.displayNameMasked).toBe('N. V.');
      expect(authStatus.identity?.planType).toBe('team');
      expect(authStatus.identity?.defaultOrganization?.titleMasked).toBe('Personal');
      expect(authStatus.identity?.defaultOrganization?.role).toBe('owner');
      expect(authStatus.identity?.localhostCallback).toBe(true);
      expect(authStatus.identity?.platformUrlHost).toBe('platform.openai.com');
      expect(authStatus.identity?.subscription?.activeUntil).toBe('2026-05-02T06:39:41.000Z');
      expect(authStatus.identity?.accountIdMasked).toMatch(/^acct_[a-f0-9]{12}$/);
      expect(authStatus.identity?.userIdMasked).toMatch(/^user_[a-f0-9]{12}$/);
    });
  });
});
