import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  analyzeCodexCallback,
  cancelCodexExec,
  getCodexRun,
  getCodexStatus,
  logoutCodex,
  openCodexHome,
  openCodexLogin,
  startCodexExec,
} from '@/actions/codex';
import type { CodexExecRunSnapshot, CodexStatusSnapshot } from '@/types/codex';

export const CODEX_STATUS_QUERY_KEY = ['codex', 'status'];

export function useCodexStatus(refetchInterval: number | false = false) {
  return useQuery<CodexStatusSnapshot>({
    queryKey: CODEX_STATUS_QUERY_KEY,
    queryFn: getCodexStatus,
    refetchInterval,
  });
}

export function useOpenCodexLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: openCodexLogin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CODEX_STATUS_QUERY_KEY });
    },
  });
}

export function useLogoutCodex() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutCodex,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CODEX_STATUS_QUERY_KEY });
    },
  });
}

export function useOpenCodexHome() {
  return useMutation({
    mutationFn: openCodexHome,
  });
}

export function useAnalyzeCodexCallback() {
  return useMutation({
    mutationFn: analyzeCodexCallback,
  });
}

export function useStartCodexExec() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startCodexExec,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CODEX_STATUS_QUERY_KEY });
    },
  });
}

export function useCancelCodexExec() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelCodexExec,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CODEX_STATUS_QUERY_KEY });
    },
  });
}

export function useCodexRun(runId: string | null) {
  return useQuery<CodexExecRunSnapshot | null>({
    queryKey: ['codex', 'run', runId],
    queryFn: () => getCodexRun({ runId: runId ?? '' }),
    enabled: Boolean(runId),
  });
}
