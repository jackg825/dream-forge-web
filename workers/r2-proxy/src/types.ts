/**
 * Cloudflare Worker 環境類型定義
 */

export interface Env {
  // R2 Bucket 綁定
  R2_BUCKET: R2Bucket;

  // KV Namespace 用於 Rate Limiting
  RATE_LIMIT_KV: KVNamespace;

  // 環境變數
  ALLOWED_ORIGINS: string;
  FIREBASE_PROJECT_ID: string;

  // Secrets (在 Cloudflare Dashboard 設定)
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_ACCOUNT_ID?: string;
  SIGNING_SECRET?: string;
  URL_SIGNING_SECRET?: string; // 用於生成分享連結簽名
}

export interface AuthResult {
  uid: string;
  email?: string;
}

export interface PresignRequest {
  filename: string;
  contentType: string;
  size: number;
  path?: string; // 可選的自定義路徑前綴
}

export interface PresignResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export interface UploadConfirmRequest {
  key: string;
}

export interface FileValidationResult {
  valid: boolean;
  reason?: string;
}

export interface RateLimitConfig {
  requests: number;
  window: number; // 秒
}

export type RateLimitAction = 'upload' | 'download' | 'presign';

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

// 允許的檔案類型和對應的 magic bytes
export interface MagicBytesConfig {
  mimeType: string;
  signature: number[];
  offset?: number;
}

// CORS 配置
export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  maxAge: number;
}
