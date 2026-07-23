import { z } from 'zod';

const NullableStringSchema = z.string().trim().min(1).nullable().optional();
const NullableUrlSchema = z.string().trim().url().nullable().optional();

export type OpenAIProviderType = 'openai';

export interface OpenAIProviderSecret {
  apiKey: string;
}

export interface OpenAIProviderUsageSnapshot {
  totalRequests?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalCostUsd?: number | null;
  currency?: string | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  lastRefreshedAt?: number | null;
}

export interface OpenAIProviderBudgetSnapshot {
  monthlyBudgetUsd?: number | null;
  softLimitUsd?: number | null;
  hardLimitUsd?: number | null;
  remainingBudgetUsd?: number | null;
  currency?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  lastRefreshedAt?: number | null;
}

export type OpenAIProviderHealthStatus =
  | 'unknown'
  | 'healthy'
  | 'rate_limited'
  | 'auth_error'
  | 'budget_exhausted'
  | 'cooldown'
  | 'degraded'
  | 'disabled';

export interface OpenAIProviderHealthSnapshot {
  status: OpenAIProviderHealthStatus;
  lastCheckedAt?: number | null;
  cooldownUntil?: number | null;
  consecutiveFailures: number;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}

export interface OpenAIProviderStateSnapshot {
  usage?: OpenAIProviderUsageSnapshot;
  budget?: OpenAIProviderBudgetSnapshot;
  health: OpenAIProviderHealthSnapshot;
  availableModels?: string[];
  api_key_id?: string | null;
  admin_api_available?: boolean | null;
  last_refreshed_at?: number | null;
  lastSuccessfulRequestAt?: number | null;
  lastFailedRequestAt?: number | null;
}

export interface OpenAIProviderCredential {
  id: string;
  provider: OpenAIProviderType;
  label: string;
  api_key_preview: string;
  organization_id?: string | null;
  project_id?: string | null;
  base_url?: string | null;
  enabled: boolean;
  created_at: number;
  updated_at: number;
  last_used_at?: number | null;
  state: OpenAIProviderStateSnapshot;
}

export interface StoredOpenAIProviderCredential extends OpenAIProviderCredential {
  secret: OpenAIProviderSecret;
}

export const OpenAIProviderTypeSchema = z.literal('openai');

export const OpenAIProviderSecretSchema = z.object({
  apiKey: z.string().trim().min(1),
});

export const OpenAIProviderUsageSnapshotSchema = z.object({
  totalRequests: z.number().int().nonnegative().nullable().optional(),
  inputTokens: z.number().int().nonnegative().nullable().optional(),
  outputTokens: z.number().int().nonnegative().nullable().optional(),
  totalCostUsd: z.number().nonnegative().nullable().optional(),
  currency: NullableStringSchema,
  windowStart: NullableStringSchema,
  windowEnd: NullableStringSchema,
  lastRefreshedAt: z.number().int().nullable().optional(),
});

export const OpenAIProviderBudgetSnapshotSchema = z.object({
  monthlyBudgetUsd: z.number().nonnegative().nullable().optional(),
  softLimitUsd: z.number().nonnegative().nullable().optional(),
  hardLimitUsd: z.number().nonnegative().nullable().optional(),
  remainingBudgetUsd: z.number().nullable().optional(),
  currency: NullableStringSchema,
  periodStart: NullableStringSchema,
  periodEnd: NullableStringSchema,
  lastRefreshedAt: z.number().int().nullable().optional(),
});

export const OpenAIProviderHealthStatusSchema = z.enum([
  'unknown',
  'healthy',
  'rate_limited',
  'auth_error',
  'budget_exhausted',
  'cooldown',
  'degraded',
  'disabled',
]);

export const OpenAIProviderHealthSnapshotSchema = z.object({
  status: OpenAIProviderHealthStatusSchema,
  lastCheckedAt: z.number().int().nullable().optional(),
  cooldownUntil: z.number().int().nullable().optional(),
  consecutiveFailures: z.number().int().nonnegative(),
  lastErrorCode: NullableStringSchema,
  lastErrorMessage: NullableStringSchema,
});

export const OpenAIProviderStateSnapshotSchema = z.object({
  usage: OpenAIProviderUsageSnapshotSchema.optional(),
  budget: OpenAIProviderBudgetSnapshotSchema.optional(),
  health: OpenAIProviderHealthSnapshotSchema,
  availableModels: z.array(z.string()).optional(),
  api_key_id: NullableStringSchema,
  admin_api_available: z.boolean().nullable().optional(),
  last_refreshed_at: z.number().int().nullable().optional(),
  lastSuccessfulRequestAt: z.number().int().nullable().optional(),
  lastFailedRequestAt: z.number().int().nullable().optional(),
});

export const OpenAIProviderCredentialSchema = z.object({
  id: z.string().min(1),
  provider: OpenAIProviderTypeSchema,
  label: z.string().trim().min(1).max(100),
  api_key_preview: z.string().trim().min(1),
  organization_id: NullableStringSchema,
  project_id: NullableStringSchema,
  base_url: NullableUrlSchema,
  enabled: z.boolean(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
  last_used_at: z.number().int().nullable().optional(),
  state: OpenAIProviderStateSnapshotSchema,
});

export const StoredOpenAIProviderCredentialSchema = OpenAIProviderCredentialSchema.extend({
  secret: OpenAIProviderSecretSchema,
});

export const OpenAIProviderCreateInputSchema = z.object({
  label: z.string().trim().min(1).max(100),
  apiKey: z.string().trim().min(1),
  organizationId: NullableStringSchema,
  projectId: NullableStringSchema,
  baseUrl: NullableUrlSchema,
  enabled: z.boolean().optional(),
});

export const OpenAIProviderUpdateInputSchema = z.object({
  providerId: z.string().min(1),
  label: z.string().trim().min(1).max(100).optional(),
  apiKey: z.string().trim().min(1).optional(),
  organizationId: z.string().trim().min(1).nullable().optional(),
  projectId: z.string().trim().min(1).nullable().optional(),
  baseUrl: z.string().trim().url().nullable().optional(),
  enabled: z.boolean().optional(),
});

export type OpenAIProviderCreateInput = z.infer<typeof OpenAIProviderCreateInputSchema>;
export type OpenAIProviderUpdateInput = z.infer<typeof OpenAIProviderUpdateInputSchema>;

export function buildOpenAIProviderApiKeyPreview(apiKey: string): string {
  const normalizedApiKey = apiKey.trim();
  if (normalizedApiKey.length <= 8) {
    return '••••';
  }

  return `${normalizedApiKey.slice(0, 7)}…${normalizedApiKey.slice(-4)}`;
}

export function createDefaultOpenAIProviderState(
  enabled: boolean = true,
): OpenAIProviderStateSnapshot {
  return {
    health: {
      status: enabled ? 'unknown' : 'disabled',
      lastCheckedAt: null,
      cooldownUntil: null,
      consecutiveFailures: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
    availableModels: [],
    api_key_id: null,
    admin_api_available: null,
    last_refreshed_at: null,
    lastSuccessfulRequestAt: null,
    lastFailedRequestAt: null,
  };
}
