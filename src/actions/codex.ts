import { ipc } from '@/ipc/manager';
import type { CodexExecRequest } from '@/types/codex';

export function getCodexStatus() {
  return ipc.client.codex.getStatus();
}

export function detectCodexInstallation() {
  return ipc.client.codex.detectInstallation();
}

export function openCodexLogin() {
  return ipc.client.codex.openLogin();
}

export function logoutCodex() {
  return ipc.client.codex.logout();
}

export function openCodexHome() {
  return ipc.client.codex.openHome();
}

export function analyzeCodexCallback(input: { input: string }) {
  return ipc.client.codex.analyzeCallback(input);
}

export function startCodexExec(input: CodexExecRequest) {
  return ipc.client.codex.startExec(input);
}

export function cancelCodexExec(input: { runId: string }) {
  return ipc.client.codex.cancelExec(input);
}

export function getCodexRun(input: { runId: string }) {
  return ipc.client.codex.getRun(input);
}
