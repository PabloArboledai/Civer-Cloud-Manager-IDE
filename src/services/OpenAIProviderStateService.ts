import axios from 'axios';
import {
  OpenAIProviderBudgetSnapshot,
  OpenAIProviderCredential,
  OpenAIProviderStateSnapshot,
  StoredOpenAIProviderCredential,
} from '../types/openai-provider';
import { OpenAIProviderRepo } from '../ipc/database/openaiProviderRepo';
import { logger } from '../utils/logger';

interface OpenAIPage<T> {
  data?: T[];
  has_more?: boolean;
  next_page?: string | null;
}

interface OpenAIModelEntry {
  id?: string;
}

interface OpenAIProjectApiKeyEntry {
  id?: string;
  redacted_value?: string;
  last_used_at?: number | null;
}

interface OpenAIUsageResult {
  input_tokens?: number;
  input_cached_tokens?: number;
  input_audio_tokens?: number;
  output_tokens?: number;
  output_audio_tokens?: number;
  num_model_requests?: number;
  api_key_id?: string | null;
  project_id?: string | null;
  model?: string | null;
}

interface OpenAICostResult {
  amount?: {
    value?: number;
    currency?: string;
  };
  project_id?: string | null;
}

interface OpenAIUsageBucket {
  results?: OpenAIUsageResult[];
}

interface OpenAICostBucket {
  results?: OpenAICostResult[];
}

function getInferenceBaseUrl(baseUrl?: string | null): string {
  const trimmedBaseUrl = baseUrl?.trim();
  if (!trimmedBaseUrl) {
    return 'https://api.openai.com/v1';
  }

  return trimmedBaseUrl.replace(/\/+$/, '');
}

function buildManagementHeaders(provider: StoredOpenAIProviderCredential): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${provider.secret.apiKey}`,
    'Content-Type': 'application/json',
  };

  if (provider.organization_id) {
    headers['OpenAI-Organization'] = provider.organization_id;
  }

  if (provider.project_id) {
    headers['OpenAI-Project'] = provider.project_id;
  }

  return headers;
}

function buildQueryString(params: Record<string, string | number | Array<string | number>>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(`${key}[]`, String(item));
      }
      continue;
    }

    searchParams.append(key, String(value));
  }

  return searchParams.toString();
}

function matchesProjectApiKey(
  apiKey: string,
  preview: string,
  redactedValue: string | undefined,
): boolean {
  if (!redactedValue) {
    return false;
  }

  const normalizedRedacted = redactedValue.trim();
  if (!normalizedRedacted) {
    return false;
  }

  const prefix = apiKey.trim().slice(0, 7);
  const suffix = apiKey.trim().slice(-4);
  if (!prefix || !suffix) {
    return false;
  }

  return (
    normalizedRedacted.startsWith(prefix) ||
    normalizedRedacted.endsWith(suffix) ||
    normalizedRedacted === preview
  );
}

function classifyRefreshFailure(error: unknown): {
  status: OpenAIProviderStateSnapshot['health']['status'];
  code: string;
  message: string;
} {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const message =
      (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message ||
      error.message;
    const lowered = message.toLowerCase();

    if (status === 401 || status === 403) {
      return {
        status: 'auth_error',
        code: 'auth_error',
        message,
      };
    }

    if (status === 429 || lowered.includes('rate limit') || lowered.includes('too many requests')) {
      return {
        status: 'rate_limited',
        code: 'rate_limited',
        message,
      };
    }

    if (lowered.includes('insufficient_quota') || lowered.includes('quota')) {
      return {
        status: 'budget_exhausted',
        code: 'budget_exhausted',
        message,
      };
    }

    return {
      status: 'degraded',
      code: `http_${status || 'error'}`,
      message,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    status: 'degraded',
    code: 'unknown_error',
    message,
  };
}

function aggregateUsage(
  buckets: OpenAIUsageBucket[],
  keyId: string | null,
  projectId: string | null | undefined,
) {
  let totalRequests = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const bucket of buckets) {
    for (const result of bucket.results ?? []) {
      if (keyId && result.api_key_id && result.api_key_id !== keyId) {
        continue;
      }
      if (!keyId && projectId && result.project_id && result.project_id !== projectId) {
        continue;
      }

      totalRequests += result.num_model_requests ?? 0;
      inputTokens +=
        (result.input_tokens ?? 0) +
        (result.input_cached_tokens ?? 0) +
        (result.input_audio_tokens ?? 0);
      outputTokens += (result.output_tokens ?? 0) + (result.output_audio_tokens ?? 0);
    }
  }

  return {
    totalRequests,
    inputTokens,
    outputTokens,
  };
}

function aggregateCosts(
  buckets: OpenAICostBucket[],
  projectId: string | null | undefined,
): OpenAIProviderBudgetSnapshot | undefined {
  if (!projectId) {
    return undefined;
  }

  let currency: string | null = null;

  for (const bucket of buckets) {
    for (const result of bucket.results ?? []) {
      if (result.project_id && result.project_id !== projectId) {
        continue;
      }

      currency = result.amount?.currency ?? currency;
    }
  }

  return {
    currency,
    remainingBudgetUsd: null,
    monthlyBudgetUsd: null,
    softLimitUsd: null,
    hardLimitUsd: null,
    lastRefreshedAt: Math.floor(Date.now() / 1000),
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    periodEnd: new Date().toISOString(),
  };
}

async function getJson<T>(
  provider: StoredOpenAIProviderCredential,
  path: string,
  params?: Record<string, string | number | Array<string | number>>,
): Promise<T> {
  const baseUrl = getInferenceBaseUrl(provider.base_url);
  const queryString = params ? buildQueryString(params) : '';
  const url = `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`;

  const response = await axios.get<T>(url, {
    headers: buildManagementHeaders(provider),
    timeout: 30_000,
  });

  return response.data;
}

export class OpenAIProviderStateService {
  static async refreshProviderState(providerId: string): Promise<OpenAIProviderCredential> {
    const provider = await OpenAIProviderRepo.getProviderWithSecret(providerId);
    if (!provider) {
      throw new Error(`OpenAI provider not found: ${providerId}`);
    }

    const now = Math.floor(Date.now() / 1000);

    try {
      const modelsPage = await getJson<OpenAIPage<OpenAIModelEntry>>(provider, '/models');
      const availableModels = (modelsPage.data ?? [])
        .map((model) => model.id?.trim())
        .filter((modelId): modelId is string => Boolean(modelId))
        .sort();

      let adminApiAvailable: boolean | null = null;
      let matchedApiKeyId: string | null = provider.state.api_key_id ?? null;
      let totalCostUsd: number | undefined;
      let budget = provider.state.budget;
      let usage = provider.state.usage;

      if (provider.project_id) {
        try {
          const apiKeyPage = await getJson<OpenAIPage<OpenAIProjectApiKeyEntry>>(
            provider,
            `/organization/projects/${provider.project_id}/api_keys`,
          );
          adminApiAvailable = true;
          matchedApiKeyId =
            (apiKeyPage.data ?? []).find((entry) =>
              matchesProjectApiKey(
                provider.secret.apiKey,
                provider.api_key_preview,
                entry.redacted_value,
              ),
            )?.id ?? null;

          const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
          const usagePage = await getJson<OpenAIPage<OpenAIUsageBucket>>(
            provider,
            '/organization/usage/completions',
            {
              start_time: thirtyDaysAgo,
              bucket_width: '1d',
              limit: 31,
              group_by: ['project_id', 'api_key_id', 'model'],
              ...(matchedApiKeyId ? { api_key_ids: [matchedApiKeyId] } : {}),
              models: availableModels.filter(
                (model) => model.startsWith('gpt') || model.startsWith('o'),
              ),
            },
          );
          const usageTotals = aggregateUsage(
            usagePage.data ?? [],
            matchedApiKeyId,
            provider.project_id,
          );

          const monthStart = new Date();
          monthStart.setUTCDate(1);
          monthStart.setUTCHours(0, 0, 0, 0);
          const costsPage = await getJson<OpenAIPage<OpenAICostBucket>>(
            provider,
            '/organization/costs',
            {
              start_time: Math.floor(monthStart.getTime() / 1000),
              bucket_width: '1d',
              limit: 31,
              group_by: ['project_id'],
            },
          );

          budget = aggregateCosts(costsPage.data ?? [], provider.project_id) ?? budget;
          totalCostUsd = (costsPage.data ?? [])
            .flatMap((bucket) => bucket.results ?? [])
            .filter((result) => !provider.project_id || result.project_id === provider.project_id)
            .reduce((sum, result) => sum + (result.amount?.value ?? 0), 0);

          usage = {
            totalRequests: usageTotals.totalRequests,
            inputTokens: usageTotals.inputTokens,
            outputTokens: usageTotals.outputTokens,
            totalCostUsd,
            currency: budget?.currency ?? 'usd',
            windowStart: new Date(thirtyDaysAgo * 1000).toISOString(),
            windowEnd: new Date().toISOString(),
            lastRefreshedAt: now,
          };
        } catch (adminError) {
          const failure = classifyRefreshFailure(adminError);
          adminApiAvailable = false;
          logger.warn(
            `OpenAI admin metrics unavailable for provider ${providerId}: ${failure.code} ${failure.message}`,
          );
        }
      }

      const nextState: OpenAIProviderStateSnapshot = {
        ...provider.state,
        usage,
        budget,
        availableModels,
        api_key_id: matchedApiKeyId,
        admin_api_available: adminApiAvailable,
        last_refreshed_at: now,
        health: {
          ...provider.state.health,
          status: provider.enabled ? 'healthy' : 'disabled',
          lastCheckedAt: now,
          cooldownUntil: null,
          consecutiveFailures: 0,
          lastErrorCode: adminApiAvailable === false ? 'admin_metrics_unavailable' : null,
          lastErrorMessage:
            adminApiAvailable === false
              ? 'Las APIs administrativas no estan disponibles para esta credencial.'
              : null,
        },
      };

      return OpenAIProviderRepo.updateState(providerId, nextState);
    } catch (error) {
      const failure = classifyRefreshFailure(error);
      const nextState: OpenAIProviderStateSnapshot = {
        ...provider.state,
        admin_api_available: provider.state.admin_api_available ?? null,
        last_refreshed_at: now,
        health: {
          ...provider.state.health,
          status: provider.enabled ? failure.status : 'disabled',
          lastCheckedAt: now,
          consecutiveFailures: provider.state.health.consecutiveFailures + 1,
          lastErrorCode: failure.code,
          lastErrorMessage: failure.message,
        },
      };

      await OpenAIProviderRepo.updateState(providerId, nextState);
      throw error;
    }
  }

  static async refreshAllProviderStates(): Promise<OpenAIProviderCredential[]> {
    const providers = await OpenAIProviderRepo.listProviders();
    const refreshed: OpenAIProviderCredential[] = [];

    for (const provider of providers) {
      try {
        const result = await this.refreshProviderState(provider.id);
        refreshed.push(result);
      } catch (error) {
        logger.warn(`Failed to refresh OpenAI provider ${provider.id}`, error);
      }
    }

    return OpenAIProviderRepo.listProviders();
  }
}
