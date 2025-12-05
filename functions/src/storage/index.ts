/**
 * Storage Abstraction Layer
 *
 * 提供統一的儲存介面，支援 Firebase Storage 和 Cloudflare R2。
 * 透過環境變數 STORAGE_BACKEND 切換 ('firebase' | 'r2')
 */

import * as admin from 'firebase-admin';
import { getR2Client } from './r2-client';

// 儲存後端類型
type StorageBackend = 'firebase' | 'r2';

// 從環境變數讀取，預設使用 Firebase
const STORAGE_BACKEND: StorageBackend =
  (process.env.STORAGE_BACKEND as StorageBackend) || 'firebase';

// R2 公開 URL (透過 Worker)
const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL || 'https://dream-forge-r2-proxy.jackg825.workers.dev';

/**
 * 上傳 Buffer 到儲存
 */
export async function uploadBuffer(
  buffer: Buffer,
  storagePath: string,
  contentType: string
): Promise<string> {
  if (STORAGE_BACKEND === 'r2') {
    return uploadToR2(buffer, storagePath, contentType);
  }
  return uploadToFirebase(buffer, storagePath, contentType);
}

/**
 * 上傳 Base64 到儲存
 */
export async function uploadBase64(
  base64: string,
  storagePath: string,
  contentType: string
): Promise<string> {
  const buffer = Buffer.from(base64, 'base64');
  return uploadBuffer(buffer, storagePath, contentType);
}

/**
 * 從 URL 下載並上傳到儲存
 */
export async function uploadFromUrl(
  url: string,
  storagePath: string,
  contentType?: string
): Promise<string> {
  if (STORAGE_BACKEND === 'r2') {
    const r2 = getR2Client();
    await r2.uploadFromUrl(storagePath, url, contentType);
    return r2.getPublicUrl(storagePath);
  }

  // Firebase: 下載後上傳
  const axios = (await import('axios')).default;
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });

  const buffer = Buffer.from(response.data);
  const type = contentType || response.headers['content-type'] || 'application/octet-stream';

  return uploadToFirebase(buffer, storagePath, type);
}

/**
 * 獲取檔案的公開 URL (或簽名 URL)
 */
export async function getDownloadUrl(storagePath: string): Promise<string> {
  if (STORAGE_BACKEND === 'r2') {
    const r2 = getR2Client();
    return r2.getPublicUrl(storagePath);
  }

  // Firebase: 生成簽名 URL
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return signedUrl;
}

/**
 * 獲取簽名 URL (用於臨時存取)
 */
export async function getSignedUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string> {
  if (STORAGE_BACKEND === 'r2') {
    const r2 = getR2Client();
    return r2.getSignedDownloadUrl(storagePath, expiresIn);
  }

  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresIn * 1000,
  });

  return signedUrl;
}

/**
 * 刪除檔案
 */
export async function deleteFile(storagePath: string): Promise<void> {
  if (STORAGE_BACKEND === 'r2') {
    const r2 = getR2Client();
    await r2.delete(storagePath);
    return;
  }

  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);

  try {
    await file.delete();
  } catch (error) {
    // 忽略檔案不存在的錯誤
    if ((error as { code?: number }).code !== 404) {
      throw error;
    }
  }
}

/**
 * 檢查檔案是否存在
 */
export async function fileExists(storagePath: string): Promise<boolean> {
  if (STORAGE_BACKEND === 'r2') {
    const r2 = getR2Client();
    return r2.exists(storagePath);
  }

  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  return exists;
}

/**
 * 下載檔案內容
 */
export async function downloadFile(storagePath: string): Promise<Buffer> {
  if (STORAGE_BACKEND === 'r2') {
    const r2 = getR2Client();
    return r2.download(storagePath);
  }

  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);
  const [buffer] = await file.download();
  return buffer;
}

/**
 * 列出指定前綴的檔案
 */
export async function listFiles(
  prefix: string
): Promise<{ path: string; size: number }[]> {
  if (STORAGE_BACKEND === 'r2') {
    const r2 = getR2Client();
    const files = await r2.list(prefix);
    return files.map((f) => ({ path: f.key, size: f.size }));
  }

  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix });

  return files.map((f) => ({
    path: f.name,
    size: parseInt(String(f.metadata.size || 0), 10),
  }));
}

/**
 * 生成儲存路徑
 */
export function generateStoragePath(
  userId: string,
  prefix: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${prefix}/${userId}/${timestamp}_${sanitized}`;
}

/**
 * 獲取目前使用的儲存後端
 */
export function getStorageBackend(): StorageBackend {
  return STORAGE_BACKEND;
}

// ============================================
// 內部實作
// ============================================

/**
 * 上傳到 Firebase Storage
 */
async function uploadToFirebase(
  buffer: Buffer,
  storagePath: string,
  contentType: string
): Promise<string> {
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: { contentType },
  });

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return signedUrl;
}

/**
 * 上傳到 Cloudflare R2
 */
async function uploadToR2(
  buffer: Buffer,
  storagePath: string,
  contentType: string
): Promise<string> {
  const r2 = getR2Client();
  await r2.upload(storagePath, buffer, contentType);
  return r2.getPublicUrl(storagePath);
}

// 導出常數
export { STORAGE_BACKEND, R2_PUBLIC_URL };
