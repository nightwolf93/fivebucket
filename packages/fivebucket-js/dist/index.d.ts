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
    actions?: RemoteActionDefinition[];
}
export type RemoteActionFieldType = 'string' | 'text' | 'number' | 'integer' | 'boolean' | 'select' | 'multiselect' | 'json' | 'object' | 'player' | 'datetime';
export interface RemoteActionField {
    key: string;
    type?: RemoteActionFieldType;
    label?: string;
    description?: string;
    required?: boolean;
    placeholder?: string;
    min?: number;
    max?: number;
    default?: unknown;
    options?: Array<string | {
        value: string | number | boolean;
        label?: string;
    }>;
    secret?: boolean;
}
export interface RemoteActionDefinition {
    key: string;
    label?: string;
    description?: string;
    category?: string;
    dangerous?: boolean;
    requiresConfirmation?: boolean;
    timeoutSeconds?: number;
    schema?: {
        fields?: RemoteActionField[] | Record<string, RemoteActionField | RemoteActionFieldType>;
    };
    params?: RemoteActionField[] | Record<string, RemoteActionField | RemoteActionFieldType>;
    metadata?: Record<string, unknown>;
}
export interface SdkHeartbeatOptions {
    actions?: RemoteActionDefinition[];
    metadata?: Record<string, unknown>;
}
export interface SdkPollActionsOptions extends SdkHeartbeatOptions {
}
export interface RemoteActionExecution {
    id: number;
    actionKey: string;
    label?: string;
    params: Record<string, unknown>;
    timeoutSeconds: number;
    requestedAt?: string;
    expiresAt?: string;
}
export interface RemoteActionResult {
    ok: boolean;
    result?: Record<string, unknown> | unknown;
    data?: Record<string, unknown> | unknown;
    error?: string;
}
export declare class FiveBucketClient {
    private readonly baseUrl;
    private readonly apiKey?;
    private readonly fetcher;
    constructor(options: FiveBucketOptions);
    request<T = unknown>(method: string, path: string, options?: FiveBucketRequestOptions): Promise<T>;
    listFiles(query?: {
        limit?: number;
        page?: number;
        type?: string;
        path?: string;
    }): Promise<{
        status: 'ok';
        data: FiveBucketFile[];
        pagination: Record<string, number>;
    }>;
    getFile(idOrPath: string): Promise<{
        status: 'ok';
        data: FiveBucketFile;
    }>;
    deleteFile(idOrPath: string): Promise<{
        status: 'ok';
    }>;
    signedFileUrl(idOrPath: string, options?: {
        expires?: number;
        w?: number;
        h?: number;
        q?: number;
        format?: 'webp';
    }): Promise<{
        status: 'ok';
        data: {
            signedUrl: string;
            expiresIn: number;
        };
    }>;
    uploadFile(file: Blob, options?: UploadOptions): Promise<{
        status: 'ok';
        data: FiveBucketFile;
        url: string;
        image?: string | undefined;
        video?: string | undefined;
        audio?: string | undefined;
    }>;
    uploadBase64(base64: string, options?: UploadOptions): Promise<{
        status: 'ok';
        data: FiveBucketFile;
        url: string;
        image?: string | undefined;
        video?: string | undefined;
        audio?: string | undefined;
    }>;
    createPresignedUpload(options?: {
        expiresAt?: number;
        fileType?: string;
    }): Promise<{
        status: 'ok';
        data: {
            presignedUrl: string;
        };
    }>;
    log(entry: LogEntry): Promise<{
        status: "ok";
    }>;
    logs(entries: LogEntry[]): Promise<{
        status: 'ok';
    }>;
    discordLog(payload: Record<string, unknown>): Promise<{
        status: 'ok';
    }>;
    sdkReport(options?: SdkReportOptions): Promise<{
        message: string;
        token: string;
        expiresAt: string;
    }>;
    sdkHeartbeat(token: string, options?: SdkHeartbeatOptions): Promise<{
        message: string;
        expiresAt?: string | undefined;
        pendingActions?: number | undefined;
    }>;
    sdkInvalidate(token: string): Promise<{
        message: string;
    }>;
    sdkPollActions(token: string, options?: SdkPollActionsOptions): Promise<{
        status: 'ok';
        expiresAt?: string | undefined;
        actions: RemoteActionExecution[];
    }>;
    sdkAckAction(token: string, executionId: string | number): Promise<{
        status: 'ok';
    }>;
    sdkCompleteAction(token: string, executionId: string | number, payload: RemoteActionResult): Promise<{
        status: 'ok';
    }>;
}
export declare class FiveBucketError extends Error {
    readonly status: number;
    readonly payload: unknown;
    constructor(message: string, status: number, payload: unknown);
}
