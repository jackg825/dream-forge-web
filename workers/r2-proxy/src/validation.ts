/**
 * 檔案驗證模組
 * 驗證檔案類型、大小和內容
 */

import type { FileValidationResult, MagicBytesConfig } from './types';

// 檔案大小限制 (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 允許的檔案類型及其 magic bytes
const MAGIC_BYTES_CONFIG: MagicBytesConfig[] = [
  // 圖片格式
  {
    mimeType: 'image/jpeg',
    signature: [0xff, 0xd8, 0xff],
  },
  {
    mimeType: 'image/png',
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    mimeType: 'image/webp',
    signature: [0x52, 0x49, 0x46, 0x46], // RIFF header
  },
  {
    mimeType: 'image/gif',
    signature: [0x47, 0x49, 0x46, 0x38], // GIF8
  },
  // HEIC/HEIF (ftyp box)
  {
    mimeType: 'image/heic',
    signature: [0x00, 0x00, 0x00],
    offset: 0,
  },
  {
    mimeType: 'image/heif',
    signature: [0x00, 0x00, 0x00],
    offset: 0,
  },
  // 3D 模型格式
  {
    mimeType: 'model/gltf-binary',
    signature: [0x67, 0x6c, 0x54, 0x46], // glTF
  },
  {
    mimeType: 'application/octet-stream', // GLB 通常用這個 MIME type
    signature: [0x67, 0x6c, 0x54, 0x46], // glTF
  },
];

// 允許的 MIME types 白名單
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'model/gltf-binary',
  'application/octet-stream', // GLB
]);

/**
 * 檢查 Content-Type 是否允許
 */
export function isAllowedContentType(contentType: string): boolean {
  // 移除 charset 等參數
  const mimeType = contentType.split(';')[0].trim().toLowerCase();
  return ALLOWED_MIME_TYPES.has(mimeType);
}

/**
 * 驗證 magic bytes
 */
function validateMagicBytes(
  header: Uint8Array,
  declaredType: string
): boolean {
  const mimeType = declaredType.split(';')[0].trim().toLowerCase();

  const config = MAGIC_BYTES_CONFIG.find((c) => c.mimeType === mimeType);

  if (!config) {
    // 如果沒有配置，檢查是否是已知安全類型
    return ALLOWED_MIME_TYPES.has(mimeType);
  }

  const offset = config.offset || 0;
  const signature = config.signature;

  for (let i = 0; i < signature.length; i++) {
    if (header[offset + i] !== signature[i]) {
      return false;
    }
  }

  return true;
}

/**
 * 額外的 HEIC/HEIF 驗證
 * HEIC 文件的 ftyp box 在偏移量 4-8 處包含 'ftyp'
 * 然後在偏移量 8 處包含品牌標識符 (heic, heix, hevc, hevx, mif1, msf1)
 */
function validateHeicSignature(header: Uint8Array): boolean {
  // 檢查 ftyp box
  const ftypStr = String.fromCharCode(...header.slice(4, 8));
  if (ftypStr !== 'ftyp') {
    return false;
  }

  // 檢查品牌標識符
  const brandStr = String.fromCharCode(...header.slice(8, 12));
  const validBrands = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'];
  return validBrands.includes(brandStr);
}

/**
 * 驗證檔案內容
 */
export async function validateFile(
  file: ArrayBuffer,
  declaredType: string
): Promise<FileValidationResult> {
  // 1. 檔案大小檢查
  if (file.byteLength > MAX_FILE_SIZE) {
    return {
      valid: false,
      reason: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
    };
  }

  if (file.byteLength === 0) {
    return {
      valid: false,
      reason: 'Empty file',
    };
  }

  // 2. Content-Type 檢查
  if (!isAllowedContentType(declaredType)) {
    return {
      valid: false,
      reason: `Content type '${declaredType}' is not allowed`,
    };
  }

  // 3. Magic bytes 驗證
  const header = new Uint8Array(file.slice(0, 32));
  const mimeType = declaredType.split(';')[0].trim().toLowerCase();

  // HEIC/HEIF 需要額外驗證
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    if (!validateHeicSignature(header)) {
      return {
        valid: false,
        reason: 'Invalid HEIC/HEIF file signature',
      };
    }
    return { valid: true };
  }

  // 其他類型的 magic bytes 驗證
  if (!validateMagicBytes(header, declaredType)) {
    return {
      valid: false,
      reason: 'File signature mismatch (possible polyglot attack)',
    };
  }

  return { valid: true };
}

/**
 * 清理檔案名稱，防止路徑遍歷攻擊
 */
export function sanitizeFilename(filename: string): string {
  // 移除路徑分隔符和特殊字符
  let sanitized = filename
    .replace(/[\/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[<>:"|?*\x00-\x1f]/g, '_');

  // 限制長度
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop() || '';
    const name = sanitized.substring(0, 255 - ext.length - 1);
    sanitized = `${name}.${ext}`;
  }

  // 確保有檔案名
  if (!sanitized || sanitized === '.') {
    sanitized = 'unnamed_file';
  }

  return sanitized;
}

/**
 * 生成唯一的儲存 key
 */
export function generateStorageKey(
  userId: string,
  filename: string,
  prefix: string = 'uploads'
): string {
  const sanitized = sanitizeFilename(filename);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}/${userId}/${timestamp}_${random}_${sanitized}`;
}
