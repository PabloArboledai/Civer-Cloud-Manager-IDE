export interface UpstreamErrorHeaders {
  retryAfter?: string;
}

export class UpstreamRequestError extends Error {
  readonly status?: number;
  readonly headers?: UpstreamErrorHeaders;
  readonly body?: string;

  constructor(params: {
    message: string;
    status?: number;
    headers?: UpstreamErrorHeaders;
    body?: string;
  }) {
    super(params.message);
    this.name = 'UpstreamRequestError';
    this.status = params.status;
    this.headers = params.headers;
    this.body = params.body;
  }
}

