export class FiveBucketClient {
    constructor(options) {
        if (!options.baseUrl) {
            throw new Error('FiveBucket baseUrl is required.');
        }
        this.baseUrl = options.baseUrl.replace(/\/+$/, '');
        this.apiKey = options.apiKey;
        this.fetcher = options.fetcher ?? fetch;
    }
    async request(method, path, options = {}) {
        const url = new URL(this.baseUrl + normalizePath(path));
        for (const [key, value] of Object.entries(options.query ?? {})) {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, String(value));
            }
        }
        const headers = {
            Accept: 'application/json',
            ...options.headers,
        };
        if (this.apiKey && !headers.Authorization) {
            headers.Authorization = this.apiKey;
        }
        let body;
        if (options.body instanceof FormData) {
            body = options.body;
        }
        else if (options.body !== undefined) {
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
        return data;
    }
    async listFiles(query = {}) {
        return this.request('GET', '/api/v3/file', { query });
    }
    async getFile(idOrPath) {
        return this.request('GET', `/api/v3/file/${encodePath(idOrPath)}`);
    }
    async deleteFile(idOrPath) {
        return this.request('DELETE', `/api/v3/file/${encodePath(idOrPath)}`);
    }
    async signedFileUrl(idOrPath, options = {}) {
        return this.request('GET', `/api/v3/file/${encodePath(idOrPath)}/signed-url`, { query: options });
    }
    async uploadFile(file, options = {}) {
        const form = new FormData();
        form.set('file', file, options.filename);
        appendUploadOptions(form, options);
        return this.request('POST', '/api/v3/file', { body: form });
    }
    async uploadBase64(base64, options = {}) {
        return this.request('POST', '/api/v3/file/base64', {
            body: {
                base64,
                filename: options.filename,
                path: options.path,
                metadata: options.metadata,
                retentionExempt: options.retentionExempt,
                visibility: options.visibility,
            },
        });
    }
    async createPresignedUpload(options = {}) {
        return this.request('GET', '/api/v3/file/presigned-url', { query: options });
    }
    async log(entry) {
        return this.logs([entry]);
    }
    async logs(entries) {
        return this.request('POST', '/api/v3/logs', { body: entries });
    }
    async discordLog(payload) {
        return this.request('POST', '/api/v3/logs/discord', { body: payload });
    }
    async sdkReport(options = {}) {
        const { sdkType = 'fivem', endpoint, resourceName, ...body } = options;
        return this.request('POST', '/api/sdk/report', {
            query: { sdkType, endpoint, resourceName },
            body,
        });
    }
    async sdkHeartbeat(token, options = {}) {
        return this.request('POST', '/api/sdk/heartbeat', {
            headers: { Authorization: token },
            body: options,
        });
    }
    async sdkInvalidate(token) {
        return this.request('POST', '/api/sdk/invalidate', {
            headers: { Authorization: token },
        });
    }
    async sdkPollActions(token, options = {}) {
        return this.request('POST', '/api/sdk/actions/poll', {
            headers: { Authorization: token },
            body: options,
        });
    }
    async sdkAckAction(token, executionId) {
        return this.request('POST', `/api/sdk/actions/${encodeURIComponent(String(executionId))}/ack`, {
            headers: { Authorization: token },
        });
    }
    async sdkCompleteAction(token, executionId, payload) {
        return this.request('POST', `/api/sdk/actions/${encodeURIComponent(String(executionId))}/result`, {
            headers: { Authorization: token },
            body: payload,
        });
    }
}
export class FiveBucketError extends Error {
    constructor(message, status, payload) {
        super(message);
        this.status = status;
        this.payload = payload;
        this.name = 'FiveBucketError';
    }
}
function appendUploadOptions(form, options) {
    if (options.filename)
        form.set('filename', options.filename);
    if (options.path)
        form.set('path', options.path);
    if (options.metadata)
        form.set('metadata', JSON.stringify(options.metadata));
    if (options.retentionExempt !== undefined)
        form.set('retentionExempt', String(options.retentionExempt));
    if (options.visibility)
        form.set('visibility', options.visibility);
}
function normalizePath(path) {
    return path.startsWith('/') ? path : `/${path}`;
}
function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
}
function safeJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
