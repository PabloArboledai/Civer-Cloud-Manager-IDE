import { z } from 'zod';
import { os } from '@orpc/server';
import {
  CodexCallbackDiagnosticsSchema,
  CodexExecRequestSchema,
  CodexExecRunSnapshotSchema,
  CodexInstallationSchema,
  CodexStatusSnapshotSchema,
} from '../../types/codex';
import {
  analyzeCodexCallback,
  cancelCodexExec,
  detectCodexInstallation,
  getCodexRun,
  getCodexStatus,
  logoutCodex,
  openCodexHome,
  openCodexLogin,
  startCodexExec,
} from './handler';

export const codexRouter = os.router({
  detectInstallation: os.output(CodexInstallationSchema).handler(async () => {
    return detectCodexInstallation();
  }),

  getStatus: os.output(CodexStatusSnapshotSchema).handler(async () => {
    return getCodexStatus();
  }),

  openLogin: os.output(z.void()).handler(async () => {
    await openCodexLogin();
  }),

  logout: os.output(z.void()).handler(async () => {
    await logoutCodex();
  }),

  openHome: os.output(z.void()).handler(async () => {
    await openCodexHome();
  }),

  analyzeCallback: os
    .input(z.object({ input: z.string() }))
    .output(CodexCallbackDiagnosticsSchema)
    .handler(async ({ input }) => {
      return analyzeCodexCallback(input.input);
    }),

  startExec: os
    .input(CodexExecRequestSchema)
    .output(CodexExecRunSnapshotSchema)
    .handler(async ({ input }) => {
      return startCodexExec(input);
    }),

  cancelExec: os
    .input(z.object({ runId: z.string() }))
    .output(z.void())
    .handler(async ({ input }) => {
      await cancelCodexExec(input.runId);
    }),

  getRun: os
    .input(z.object({ runId: z.string() }))
    .output(CodexExecRunSnapshotSchema.nullable())
    .handler(async ({ input }) => {
      return getCodexRun(input.runId);
    }),
});
