import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RateLimitReason, RateLimitTracker } from './rate-limit-tracker';
import { OpenAIProviderRepo } from '../../../ipc/database/openaiProviderRepo';
import type {
  OpenAIProviderCredential,
  OpenAIProviderStateSnapshot,
  StoredOpenAIProviderCredential,
} from '../../../types/openai-provider';
import { OpenAIProviderStateService } from '../../../services/OpenAIProviderStateService';
import { UpstreamRequestError } from './clients/upstream-error';

interface GetNextProviderOptions {
  sessionKey?: string;
  excludeProviderIds?: string[];
  model?: string;
}

@Injectable()
export class OpenAIProviderSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(OpenAIProviderSchedulerService.name);
  private readonly stickySessionTtlMs = 10 * 60 * 1000;
  private readonly authErrorCooldownMs = 30 * 60 * 1000;
  private readonly rateLimitTracker = new RateLimitTracker();

  private currentIndex = 0;
  private providers = new Map<string, StoredOpenAIProviderCredential>();
  private sessionBindings = new Map<string, { providerId: string; expiresAt: number }>();

  async onModuleInit(): Promise<void> {
    await this.reloadProviders();
  }

  async reloadProviders(): Promise<number> {
    const providers = await OpenAIProviderRepo.listProvidersWithSecrets();
    this.providers.clear();

    for (const provider of providers) {
      this.providers.set(provider.id, provider);
    }

    return providers.length;
  }

  async hasAnyProvider(): Promise<boolean> {
    if (this.providers.size === 0) {
      await this.reloadProviders();
    }

    return Array.from(this.providers.values()).some((provider) =>
      this.isProviderEligible(provider, undefined),
    );
  }

  async getKnownModels(): Promise<string[]> {
    if (this.providers.size === 0) {
      await this.reloadProviders();
    }

    const modelSet = new Set<string>();
    for (const provider of this.providers.values()) {
      for (const model of provider.state.availableModels ?? []) {
        modelSet.add(model);
      }
    }

    return Array.from(modelSet).sort();
  }

  async getProvidersSnapshot(): Promise<OpenAIProviderCredential[]> {
    return OpenAIProviderRepo.listProviders();
  }

  async getNextProvider(
    options: GetNextProviderOptions = {},
  ): Promise<StoredOpenAIProviderCredential | null> {
    await this.reloadProviders();

    const now = Date.now();
    this.clearExpiredSessionBindings(now);
    this.rateLimitTracker.cleanupExpired();

    const excludedProviderIds = new Set(options.excludeProviderIds ?? []);
    const allProviders = Array.from(this.providers.values()).filter(
      (provider) => !excludedProviderIds.has(provider.id),
    );

    const eligibleProviders = allProviders.filter((provider) =>
      this.isProviderEligible(provider, options.model),
    );

    if (eligibleProviders.length === 0) {
      return null;
    }

    const stickyBinding = options.sessionKey
      ? this.sessionBindings.get(options.sessionKey)
      : undefined;
    if (stickyBinding && stickyBinding.expiresAt > now) {
      const stickyProvider =
        eligibleProviders.find((provider) => provider.id === stickyBinding.providerId) ?? null;
      if (stickyProvider) {
        return stickyProvider;
      }
    }

    const picked = eligibleProviders[this.currentIndex % eligibleProviders.length];
    this.currentIndex += 1;

    if (options.sessionKey) {
      this.sessionBindings.set(options.sessionKey, {
        providerId: picked.id,
        expiresAt: now + this.stickySessionTtlMs,
      });
    }

    return picked;
  }

  async markSuccess(providerId: string): Promise<void> {
    const provider = await OpenAIProviderRepo.getProviderWithSecret(providerId);
    if (!provider) {
      return;
    }

    this.rateLimitTracker.markSuccess(providerId);

    const now = Math.floor(Date.now() / 1000);
    const nextState: OpenAIProviderStateSnapshot = {
      ...provider.state,
      last_refreshed_at: now,
      lastSuccessfulRequestAt: now,
      health: {
        ...provider.state.health,
        status: provider.enabled ? 'healthy' : 'disabled',
        lastCheckedAt: now,
        cooldownUntil: null,
        consecutiveFailures: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    };

    await OpenAIProviderRepo.updateState(providerId, nextState);
    await OpenAIProviderRepo.markUsed(providerId, now);
    await this.reloadProviders();
  }

  async markFailure(providerId: string, error: unknown, model?: string): Promise<void> {
    const provider = await OpenAIProviderRepo.getProviderWithSecret(providerId);
    if (!provider) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const classification = this.classifyFailure(error);
    const nextState: OpenAIProviderStateSnapshot = {
      ...provider.state,
      last_refreshed_at: now,
      lastFailedRequestAt: now,
      health: {
        ...provider.state.health,
        status: provider.enabled ? classification.status : 'disabled',
        lastCheckedAt: now,
        cooldownUntil: classification.cooldownUntil,
        consecutiveFailures: provider.state.health.consecutiveFailures + 1,
        lastErrorCode: classification.code,
        lastErrorMessage: classification.message,
      },
    };

    if (classification.rateLimitReason) {
      this.rateLimitTracker.trackFromUpstreamError({
        accountId: providerId,
        status: classification.httpStatus,
        retryAfter: classification.retryAfter,
        body: classification.body,
        model,
        backoffSteps: [15, 60, 300, 900],
      });
    }

    await OpenAIProviderRepo.updateState(providerId, nextState);
    await this.reloadProviders();
  }

  async refreshAllProviderState(): Promise<OpenAIProviderCredential[]> {
    const refreshedProviders = await OpenAIProviderStateService.refreshAllProviderStates();
    await this.reloadProviders();
    return refreshedProviders;
  }

  private clearExpiredSessionBindings(now: number): void {
    for (const [sessionKey, binding] of this.sessionBindings.entries()) {
      if (binding.expiresAt <= now) {
        this.sessionBindings.delete(sessionKey);
      }
    }
  }

  private isProviderEligible(
    provider: StoredOpenAIProviderCredential,
    model: string | undefined,
  ): boolean {
    if (!provider.enabled) {
      return false;
    }

    if (
      provider.state.health.status === 'disabled' ||
      provider.state.health.status === 'auth_error' ||
      provider.state.health.status === 'budget_exhausted'
    ) {
      return false;
    }

    return !this.rateLimitTracker.isRateLimited(provider.id, model);
  }

  private classifyFailure(error: unknown): {
    status: OpenAIProviderStateSnapshot['health']['status'];
    code: string;
    message: string;
    cooldownUntil: number | null;
    retryAfter?: string;
    body?: string;
    httpStatus?: number;
    rateLimitReason?: RateLimitReason;
  } {
    if (error instanceof UpstreamRequestError) {
      const status = error.status ?? 0;
      const message = error.message;
      const lowered = message.toLowerCase();

      if (status === 401 || status === 403) {
        return {
          status: 'auth_error',
          code: 'auth_error',
          message,
          cooldownUntil: Math.floor((Date.now() + this.authErrorCooldownMs) / 1000),
          httpStatus: status,
          body: error.body,
        };
      }

      if (status === 429 || lowered.includes('rate limit') || lowered.includes('too many requests')) {
        const cooldownSeconds = error.headers?.retryAfter
          ? Number.parseInt(error.headers.retryAfter, 10) || 15
          : 15;

        return {
          status: 'rate_limited',
          code: 'rate_limited',
          message,
          cooldownUntil: Math.floor(Date.now() / 1000) + cooldownSeconds,
          retryAfter: error.headers?.retryAfter,
          body: error.body,
          httpStatus: status || 429,
          rateLimitReason: RateLimitReason.RateLimitExceeded,
        };
      }

      if (lowered.includes('insufficient_quota') || lowered.includes('quota')) {
        return {
          status: 'budget_exhausted',
          code: 'budget_exhausted',
          message,
          cooldownUntil: null,
          body: error.body,
          httpStatus: status || 429,
          rateLimitReason: RateLimitReason.QuotaExhausted,
        };
      }

      return {
        status: 'degraded',
        code: `http_${status || 'error'}`,
        message,
        cooldownUntil: null,
        body: error.body,
        httpStatus: status || 500,
        rateLimitReason: status >= 500 ? RateLimitReason.ServerError : undefined,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'degraded',
      code: 'unknown_error',
      message,
      cooldownUntil: null,
    };
  }
}
