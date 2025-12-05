/**
 * Storage Abstraction Layer
 *
 * 提供統一的儲存介面，支援 Firebase Storage 和 Cloudflare R2。
 * 透過環境變數 STORAGE_BACKEND 切換 ('firebase' | 'r2')
 */
type StorageBackend = 'firebase' | 'r2';
declare const STORAGE_BACKEND: StorageBackend;
declare const R2_PUBLIC_URL: string;
/**
 * 上傳 Buffer 到儲存
 */
export declare function uploadBuffer(buffer: Buffer, storagePath: string, contentType: string): Promise<string>;
/**
 * 上傳 Base64 到儲存
 */
export declare function uploadBase64(base64: string, storagePath: string, contentType: string): Promise<string>;
/**
 * 從 URL 下載並上傳到儲存
 */
export declare function uploadFromUrl(url: string, storagePath: string, contentType?: string): Promise<string>;
/**
 * 獲取檔案的公開 URL (或簽名 URL)
 */
export declare function getDownloadUrl(storagePath: string): Promise<string>;
/**
 * 獲取簽名 URL (用於臨時存取)
 */
export declare function getSignedUrl(storagePath: string, expiresIn?: number): Promise<string>;
/**
 * 刪除檔案
 */
export declare function deleteFile(storagePath: string): Promise<void>;
/**
 * 檢查檔案是否存在
 */
export declare function fileExists(storagePath: string): Promise<boolean>;
/**
 * 下載檔案內容
 */
export declare function downloadFile(storagePath: string): Promise<Buffer>;
/**
 * 列出指定前綴的檔案
 */
export declare function listFiles(prefix: string): Promise<{
    path: string;
    size: number;
}[]>;
/**
 * 生成儲存路徑
 */
export declare function generateStoragePath(userId: string, prefix: string, filename: string): string;
/**
 * 獲取目前使用的儲存後端
 */
export declare function getStorageBackend(): StorageBackend;
export { STORAGE_BACKEND, R2_PUBLIC_URL };
