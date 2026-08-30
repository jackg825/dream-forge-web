export interface ValidatedStorageReference {
    url: string;
    storagePath: string;
}
export interface DownloadedValidatedImage extends ValidatedStorageReference {
    base64: string;
    mimeType: string;
}
type AllowedPrefix = 'uploads' | 'pipelines' | string;
export type StorageBackend = 'firebase' | 'r2';
export interface ParsedStorageReference {
    storagePath: string;
    backend: StorageBackend;
}
/**
 * Extract a storage object path from Firebase Storage, Google Storage, or R2 proxy URLs.
 */
export declare function extractStorageReferenceFromUrl(rawUrl: string): ParsedStorageReference | null;
export declare function extractStoragePathFromUrl(rawUrl: string): string | null;
export declare function assertUserStorageReference(url: string, userId: string, allowedPrefixes?: AllowedPrefix[]): ValidatedStorageReference;
export declare function assertUserStorageReferences(urls: string[], userId: string, allowedPrefixes?: AllowedPrefix[], maxCount?: number): ValidatedStorageReference[];
export declare function downloadValidatedImageAsBase64(url: string, userId: string, allowedPrefixes?: AllowedPrefix[]): Promise<DownloadedValidatedImage>;
export {};
