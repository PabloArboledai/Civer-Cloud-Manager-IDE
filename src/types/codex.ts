import { z } from 'zod';

export const CodexInstallationSourceSchema = z.enum(['path', 'vscode-extension', 'not-found']);

export const CodexInstallationSchema = z.object({
  available: z.boolean(),
  executablePath: z.string().nullable(),
  source: CodexInstallationSourceSchema,
  version: z.string().nullable(),
  codexHome: z.string(),
  authFileExists: z.boolean(),
  configFileExists: z.boolean(),
  stateFileExists: z.boolean(),
  sessionIndexExists: z.boolean(),
  detectedAt: z.string(),
});

export const CodexAuthStatusSchema = z.object({
  isAuthenticated: z.boolean(),
  authMode: z.string().nullable(),
  loginLabel: z.string(),
  accountIdMasked: z.string().nullable(),
  lastRefresh: z.string().nullable(),
  hasAccessToken: z.boolean(),
  hasRefreshToken: z.boolean(),
  hasIdToken: z.boolean(),
  hasApiKey: z.boolean(),
});

export const CodexConfigSnapshotSchema = z.object({
  model: z.string().nullable(),
  modelReasoningEffort: z.string().nullable(),
  profile: z.string().nullable(),
  sandboxMode: z.string().nullable(),
});

export const CodexCallbackTokenHeaderSchema = z.object({
  alg: z.string().nullable(),
  typ: z.string().nullable(),
  kid: z.string().nullable(),
});

export const CodexCallbackTokenClaimsSchema = z.object({
  issuer: z.string().nullable(),
  audienceCount: z.number().nullable(),
  issuedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  authProvider: z.string().nullable(),
  planType: z.string().nullable(),
  localhost: z.boolean().nullable(),
  organizationCount: z.number().nullable(),
  projectIdPresent: z.boolean().nullable(),
  platformUrlHost: z.string().nullable(),
});

export const CodexCallbackTokenMetadataSchema = z.object({
  header: CodexCallbackTokenHeaderSchema.nullable(),
  claims: CodexCallbackTokenClaimsSchema.nullable(),
});

export const CodexCallbackDiagnosticsSchema = z.object({
  valid: z.boolean(),
  normalizedUrl: z.string().nullable(),
  host: z.string().nullable(),
  port: z.number().nullable(),
  path: z.string().nullable(),
  parameterNames: z.array(z.string()),
  sensitiveParams: z.array(z.string()),
  warnings: z.array(z.string()),
  queryFlags: z.object({
    needsSetup: z.boolean().nullable(),
    planType: z.string().nullable(),
    hasOrgId: z.boolean(),
    hasProjectId: z.boolean(),
    platformUrlHost: z.string().nullable(),
  }),
  tokenMetadata: CodexCallbackTokenMetadataSchema.nullable(),
});

export const CodexExecStatusSchema = z.enum(['running', 'completed', 'failed', 'cancelled']);

export const CodexExecRequestSchema = z.object({
  prompt: z.string().min(1),
  cwd: z.string().min(1),
  model: z.string().optional(),
  sandbox: z.enum(['read-only', 'workspace-write', 'danger-full-access']).optional(),
  profile: z.string().optional(),
  skipGitRepoCheck: z.boolean().optional().default(false),
  fullAuto: z.boolean().optional().default(false),
});

export const CodexExecRunSummarySchema = z.object({
  runId: z.string(),
  status: CodexExecStatusSchema,
  commandPreview: z.string(),
  cwd: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  exitCode: z.number().nullable(),
  signal: z.string().nullable(),
  lastMessage: z.string().nullable(),
  eventCount: z.number(),
  errorMessage: z.string().nullable(),
});

export const CodexExecEventKindSchema = z.enum([
  'start',
  'stdout-json',
  'stdout-text',
  'stderr',
  'exit',
  'error',
]);

export const CodexExecEventSchema = z.object({
  runId: z.string(),
  kind: CodexExecEventKindSchema,
  at: z.string(),
  line: z.string().nullable().optional(),
  parsed: z.unknown().optional(),
  summary: CodexExecRunSummarySchema,
});

export const CodexExecRunSnapshotSchema = z.object({
  summary: CodexExecRunSummarySchema,
  events: z.array(CodexExecEventSchema),
});

export const CodexStatusSnapshotSchema = z.object({
  installation: CodexInstallationSchema,
  auth: CodexAuthStatusSchema,
  config: CodexConfigSnapshotSchema,
  lastRun: CodexExecRunSummarySchema.nullable(),
});

export type CodexInstallationSource = z.infer<typeof CodexInstallationSourceSchema>;
export type CodexInstallation = z.infer<typeof CodexInstallationSchema>;
export type CodexAuthStatus = z.infer<typeof CodexAuthStatusSchema>;
export type CodexConfigSnapshot = z.infer<typeof CodexConfigSnapshotSchema>;
export type CodexCallbackDiagnostics = z.infer<typeof CodexCallbackDiagnosticsSchema>;
export type CodexExecRequest = z.infer<typeof CodexExecRequestSchema>;
export type CodexExecRunSummary = z.infer<typeof CodexExecRunSummarySchema>;
export type CodexExecEvent = z.infer<typeof CodexExecEventSchema>;
export type CodexExecRunSnapshot = z.infer<typeof CodexExecRunSnapshotSchema>;
export type CodexStatusSnapshot = z.infer<typeof CodexStatusSnapshotSchema>;
