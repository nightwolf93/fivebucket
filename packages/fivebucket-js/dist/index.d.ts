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
    sdkHeartbeat(token: string): Promise<{
        message: string;
        expiresAt?: string | undefined;
    }>;
    sdkInvalidate(token: string): Promise<{
        message: string;
    }>;
}
export declare class FiveBucketError extends Error {
    readonly status: number;
    readonly payload: unknown;
    constructor(message: string, status: number, payload: unknown);
}
