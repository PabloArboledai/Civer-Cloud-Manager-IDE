import { ipc } from '@/ipc/manager';
import type {
  CodexCallbackDiagnostics,
  CodexExecRequest,
  CodexExecRunSnapshot,
  CodexInstallation,
  CodexStatusSnapshot,
} from '@/types/codex';

export function getCodexStatus(): Promise<CodexStatusSnapshot> {
  return ipc.client.codex.getStatus() as Promise<CodexStatusSnapshot>;
}

export function detectCodexInstallation(): Promise<CodexInstallation> {
  return ipc.client.codex.detectInstallation() as Promise<CodexInstallation>;
}

export function openCodexLogin(): Promise<void> {
  return ipc.client.codex.openLogin() as Promise<void>;
}

export function logoutCodex(): Promise<void> {
  return ipc.client.codex.logout() as Promise<void>;
}

export function openCodexHome(): Promise<void> {
  return ipc.client.codex.openHome() as Promise<void>;
}

export function analyzeCodexCallback(input: { input: string }): Promise<CodexCallbackDiagnostics> {
  return ipc.client.codex.analyzeCallback(input) as Promise<CodexCallbackDiagnostics>;
}

export function startCodexExec(input: CodexExecRequest): Promise<CodexExecRunSnapshot> {
  return ipc.client.codex.startExec(input) as Promise<CodexExecRunSnapshot>;
}

export function cancelCodexExec(input: { runId: string }): Promise<void> {
  return ipc.client.codex.cancelExec(input) as Promise<void>;
}

export function getCodexRun(input: { runId: string }): Promise<CodexExecRunSnapshot | null> {
  return ipc.client.codex.getRun(input) as Promise<CodexExecRunSnapshot | null>;
}
