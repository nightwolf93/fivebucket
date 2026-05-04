export type FiveBucketScope = 'media' | 'logs' | 'sdk' | '*';

export interface FiveBucketOptions {
  baseUrl: string;
  apiKey?: string;
  fetcher?: typeof fetch;
}

export interface FiveBucketRequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface FiveBucketFile {
  id: string;
  filename: string;
  type: 'image' | 'video' | 'audio' | 'file';
  size: number;
  metadata: Record<string, unknown>;
  url: string;
  originalUrl: string;
  assetUrl?: string;
  variantUrl?: string | null;
  signedUrl?: string | null;
  visibility?: 'public' | 'private';
  contentHash?: string | null;
}

export interface UploadOptions {
  filename?: string;
  path?: string;
  metadata?: Record<string, unknown>;
  retentionExempt?: boolean;
  visibility?: 'public' | 'private';
}

export interface LogEntry {
  level?: 'debug' | 'info' | 'warn' | 'warning' | 'error' | 'fatal' | 'critical';
  message: string;
  resource?: string;
  dataset?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SdkReportOptions {
  sdkType?: string;
  endpoint?: string;
  resourceName?: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

export class FiveBucketClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: FiveBucketOptions) {
    if (!options.baseUrl) {
      throw new Error('FiveBucket baseUrl is required.');
    }

    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.fetcher = options.fetcher ?? fetch;
  }

  async request<T = unknown>(method: string, path: string, options: FiveBucketRequestOptions = {}): Promise<T> {
    const url = new URL(this.baseUrl + normalizePath(path));

    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      headers.Authorization = this.apiKey;
    }

    let body: BodyInit | undefined;

    if (options.body instanceof FormData) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
      body = JSON.stringify(options.body);
    }

    const response = await this.fetcher(url, { method, headers, body });
    const text = await response.text();
    const data = text ? safeJson(text) : {};

    if (!response.ok) {
      const message = isRecord(data) && typeof data.message === 'string'
        ? data.message
        : `FiveBucket request failed with HTTP ${response.status}`;

      throw new FiveBucketError(message, response.status, data);
    }

    return data as T;
  }

  async listFiles(query: { limit?: number; page?: number; type?: string; path?: string } = {}) {
    return this.request<{ status: 'ok'; data: FiveBucketFile[]; pagination: Record<string, number> }>('GET', '/api/v3/file', { query });
  }

  async getFile(idOrPath: string) {
    return this.request<{ status: 'ok'; data: FiveBucketFile }>('GET', `/api/v3/file/${encodePath(idOrPath)}`);
  }

  async deleteFile(idOrPath: string) {
    return this.request<{ status: 'ok' }>('DELETE', `/api/v3/file/${encodePath(idOrPath)}`);
  }

  async signedFileUrl(idOrPath: string, options: { expires?: number; w?: number; h?: number; q?: number; format?: 'webp' } = {}) {
    return this.request<{ status: 'ok'; data: { signedUrl: string; expiresIn: number } }>(
      'GET',
      `/api/v3/file/${encodePath(idOrPath)}/signed-url`,
      { query: options },
    );
  }

  async uploadFile(file: Blob, options: UploadOptions = {}) {
    const form = new FormData();
    form.set('file', file, options.filename);
    appendUploadOptions(form, options);

    return this.request<{ status: 'ok'; data: FiveBucketFile; url: string; image?: string; video?: string; audio?: string }>(
      'POST',
      '/api/v3/file',
      { body: form },
    );
  }

  async uploadBase64(base64: string, options: UploadOptions = {}) {
    return this.request<{ status: 'ok'; data: FiveBucketFile; url: string; image?: string; video?: string; audio?: string }>(
      'POST',
      '/api/v3/file/base64',
      {
        body: {
          base64,
          filename: options.filename,
          path: options.path,
          metadata: options.metadata,
          retentionExempt: options.retentionExempt,
          visibility: options.visibility,
        },
      },
    );
  }

  async createPresignedUpload(options: { expiresAt?: number; fileType?: string } = {}) {
    return this.request<{ status: 'ok'; data: { presignedUrl: string } }>(
      'GET',
      '/api/v3/file/presigned-url',
      { query: options },
    );
  }

  async log(entry: LogEntry) {
    return this.logs([entry]);
  }

  async logs(entries: LogEntry[]) {
    return this.request<{ status: 'ok' }>('POST', '/api/v3/logs', { body: entries });
  }

  async discordLog(payload: Record<string, unknown>) {
    return this.request<{ status: 'ok' }>('POST', '/api/v3/logs/discord', { body: payload });
  }

  async sdkReport(options: SdkReportOptions = {}) {
    const { sdkType = 'fivem', endpoint, resourceName, ...body } = options;

    return this.request<{ message: string; token: string; expiresAt: string }>('POST', '/api/sdk/report', {
      query: { sdkType, endpoint, resourceName },
      body,
    });
  }

  async sdkHeartbeat(token: string) {
    return this.request<{ message: string; expiresAt?: string }>('POST', '/api/sdk/heartbeat', {
      headers: { Authorization: token },
    });
  }

  async sdkInvalidate(token: string) {
    return this.request<{ message: string }>('POST', '/api/sdk/invalidate', {
      headers: { Authorization: token },
    });
  }
}

export class FiveBucketError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: unknown,
  ) {
    super(message);
    this.name = 'FiveBucketError';
  }
}

function appendUploadOptions(form: FormData, options: UploadOptions): void {
  if (options.filename) form.set('filename', options.filename);
  if (options.path) form.set('path', options.path);
  if (options.metadata) form.set('metadata', JSON.stringify(options.metadata));
  if (options.retentionExempt !== undefined) form.set('retentionExempt', String(options.retentionExempt));
  if (options.visibility) form.set('visibility', options.visibility);
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
