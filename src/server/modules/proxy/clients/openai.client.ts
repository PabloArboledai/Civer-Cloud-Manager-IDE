import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  OpenAIChatRequest,
  OpenAIChatResponse,
} from '../interfaces/request-interfaces';
import { UpstreamRequestError } from './upstream-error';

interface OpenAIRequestOptions {
  apiKey: string;
  baseUrl?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
}

function resolveBaseUrl(baseUrl?: string | null): string {
  const trimmedBaseUrl = baseUrl?.trim();
  if (!trimmedBaseUrl) {
    return 'https://api.openai.com/v1';
  }

  return trimmedBaseUrl.replace(/\/+$/, '');
}

@Injectable()
export class OpenAIClient {
  private readonly logger = new Logger(OpenAIClient.name);

  private buildHeaders(options: OpenAIRequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (options.organizationId) {
      headers['OpenAI-Organization'] = options.organizationId;
    }

    if (options.projectId) {
      headers['OpenAI-Project'] = options.projectId;
    }

    return headers;
  }

  async createChatCompletion(
    request: OpenAIChatRequest,
    options: OpenAIRequestOptions,
  ): Promise<OpenAIChatResponse> {
    const url = `${resolveBaseUrl(options.baseUrl)}/chat/completions`;

    try {
      const response = await axios.post<OpenAIChatResponse>(url, request, {
        headers: this.buildHeaders(options),
        timeout: 120_000,
      });

      return response.data;
    } catch (error) {
      this.throwUpstreamError(error, 'chat.completions.create');
    }
  }

  async streamChatCompletion(
    request: OpenAIChatRequest,
    options: OpenAIRequestOptions,
  ): Promise<NodeJS.ReadableStream> {
    const url = `${resolveBaseUrl(options.baseUrl)}/chat/completions`;

    try {
      const response = await axios.post(url, request, {
        headers: this.buildHeaders(options),
        responseType: 'stream',
        timeout: 120_000,
      });

      return response.data;
    } catch (error) {
      this.throwUpstreamError(error, 'chat.completions.stream');
    }
  }

  async listModels(options: OpenAIRequestOptions): Promise<string[]> {
    const url = `${resolveBaseUrl(options.baseUrl)}/models`;

    try {
      const response = await axios.get<{ data?: Array<{ id?: string }> }>(url, {
        headers: this.buildHeaders(options),
        timeout: 30_000,
      });

      return (response.data.data ?? [])
        .map((entry) => entry.id?.trim())
        .filter((entry): entry is string => Boolean(entry));
    } catch (error) {
      this.throwUpstreamError(error, 'models.list');
    }
  }

  private throwUpstreamError(error: unknown, operation: string): never {
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data as
        | { error?: { message?: string } }
        | string
        | undefined;
      const message =
        typeof responseData === 'string'
          ? responseData
          : responseData?.error?.message || error.message;

      this.logger.error(`[${operation}] OpenAI upstream error: ${message}`);
      throw new UpstreamRequestError({
        message,
        status: error.response?.status,
        headers: {
          retryAfter: this.extractRetryAfterHeader(error.response?.headers),
        },
        body:
          typeof responseData === 'string'
            ? responseData
            : responseData
              ? JSON.stringify(responseData)
              : undefined,
      });
    }

    throw error instanceof Error ? new Error(error.message) : new Error(String(error));
  }

  private extractRetryAfterHeader(headers: unknown): string | undefined {
    if (!headers || typeof headers !== 'object') {
      return undefined;
    }

    const retryAfter = (headers as Record<string, unknown>)['retry-after'];
    if (typeof retryAfter === 'string' && retryAfter.trim() !== '') {
      return retryAfter.trim();
    }

    return undefined;
  }
}
