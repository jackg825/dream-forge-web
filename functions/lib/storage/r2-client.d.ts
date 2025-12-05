/**
 * Cloudflare R2 Storage Client
 * 使用 AWS SDK v3 的 S3 相容 API 與 R2 互動
 */
/**
 * R2 Storage Client 類別
 */
export declare class R2Client {
    private client;
    private bucket;
    private publicUrl;
    constructor();
    /**
     * 上傳檔案到 R2
     */
    upload(key: string, body: Buffer | Uint8Array | string, contentType: string, metadata?: Record<string, string>): Promise<void>;
    /**
     * 從 URL 下載並上傳到 R2
     */
    uploadFromUrl(key: string, url: string, contentType?: string): Promise<void>;
    /**
     * 下載檔案
     */
    download(key: string): Promise<Buffer>;
    /**
     * 檢查檔案是否存在
     */
    exists(key: string): Promise<boolean>;
    /**
     * 獲取檔案 metadata
     */
    getMetadata(key: string): Promise<{
        contentType?: string;
        contentLength?: number;
        lastModified?: Date;
        metadata?: Record<string, string>;
    } | null>;
    /**
     * 刪除檔案
     */
    delete(key: string): Promise<void>;
    /**
     * 列出檔案
     */
    list(prefix: string, maxKeys?: number): Promise<{
        key: string;
        size: number;
        lastModified?: Date;
    }[]>;
    /**
     * 生成 presigned GET URL
     */
    getSignedDownloadUrl(key: string, expiresIn?: number): Promise<string>;
    /**
     * 生成 presigned PUT URL
     */
    getSignedUploadUrl(key: string, contentType: string, expiresIn?: number): Promise<string>;
    /**
     * 獲取公開 URL (透過 Worker 代理)
     */
    getPublicUrl(key: string): string;
    /**
     * 複製檔案
     */
    copy(sourceKey: string, destinationKey: string): Promise<void>;
}
export declare function getR2Client(): R2Client;
/**
 * 輔助函數：生成儲存路徑
 */
export declare function generateStoragePath(userId: string, prefix: string, filename: string): string;
/**
 * 輔助函數：從 Base64 上傳
 */
export declare function uploadBase64ToR2(base64: string, path: string, contentType: string): Promise<string>;
