/**
 * Dream Forge R2 Storage Proxy Worker
 * 處理所有儲存相關的請求，包含認證、上傳、下載
 */

import type { Env } from './types';
import { authenticateRequest, authorizePathAccess, isCanonicalObjectPath } from './auth';
import { validateOrigin, validateReferer, handleCorsPrelight, addCorsHeaders, getClientIP, signUrl, verifyUrlSignature } from './security';
import { checkRateLimit, checkIpRateLimit, createRateLimitResponse } from './rateLimit';
import { validateFile, isAllowedContentType, generateStorageKey, MAX_FILE_SIZE } from './validation';

const CLIENT_WRITABLE_PREFIXES = new Set(['uploads', 'sessions']);
const MAX_JSON_BODY_SIZE = 32 * 1024;

type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; tooLarge: boolean };

async function parseBoundedJson(request: Request): Promise<BoundedJsonResult> {
  const contentLength = request.headers.get('Content-Length');
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      return { ok: false, tooLarge: false };
    }
    if (declaredBytes > MAX_JSON_BODY_SIZE) {
      return { ok: false, tooLarge: true };
    }
  }

  if (!request.body) {
    return { ok: false, tooLarge: false };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_JSON_BODY_SIZE) {
      await reader.cancel();
      return { ok: false, tooLarge: true };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return {
      ok: true,
      value: JSON.parse(
        new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)
      ),
    };
  } catch {
    return { ok: false, tooLarge: false };
  }
}

function normalizeClientUploadPrefix(prefix: string | undefined, uid: string): string {
  const normalized = (prefix || 'uploads').replace(/^\/+|\/+$/g, '');
  const segments = normalized.split('/').filter(Boolean);

  if (
    !normalized ||
    normalized.includes('\\') ||
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    return '';
  }

  if (CLIENT_WRITABLE_PREFIXES.has(normalized)) {
    return normalized;
  }

  if (normalized.startsWith(`sessions/${uid}/`) && normalized.endsWith('/views')) {
    return normalized;
  }

  return '';
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCorsPrelight(request, env);
    }

    // 驗證 Origin
    if (!validateOrigin(request, env)) {
      return addCorsHeaders(
        createErrorResponse('Origin not allowed', 'CORS_ERROR', 403),
        request,
        env
      );
    }

    try {
      // 路由處理
      const response = await handleRequest(request, url, env, ctx);

      // 添加 CORS headers
      return addCorsHeaders(response, request, env);
    } catch (error) {
      console.error('Request error:', error);

      const response = createErrorResponse('Internal server error', 'INTERNAL_ERROR', 500);

      return addCorsHeaders(response, request, env);
    }
  },
};

async function handleRequest(
  request: Request,
  url: URL,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const path = url.pathname;

  // 健康檢查
  if (path === '/health') {
    return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // IP rate limit 檢查
  const clientIP = getClientIP(request);
  const ipLimit = await checkIpRateLimit(env, clientIP);
  if (!ipLimit.allowed) {
    return createRateLimitResponse(ipLimit.resetAt);
  }

  // 路由分發
  switch (true) {
    case path.startsWith('/public/'):
      return handlePublicDownload(request, url, env);

    case path.startsWith('/upload/presign'):
      return createErrorResponse('Presigned uploads are disabled', 'ENDPOINT_DISABLED', 410);

    case path === '/upload/direct':
      return handleDirectUpload(request, url, env);

    case path.startsWith('/upload/confirm'):
      return createErrorResponse('Upload confirmation is disabled', 'ENDPOINT_DISABLED', 410);

    case path === '/download/presign':
      return handlePresignDownload(request, url, env);

    case path.startsWith('/download/'):
      return handleDownload(request, url, env, ctx);

    case path.startsWith('/delete/'):
      return handleDelete(request, url, env);

    default:
      return createErrorResponse('Not found', 'NOT_FOUND', 404);
  }
}

/**
 * Authenticated streaming upload. Bytes are counted and validated before the
 * object is written, so a client cannot lie about a presigned upload size.
 */
async function handleDirectUpload(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method !== 'PUT') {
    return createErrorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  let auth;
  try {
    auth = await authenticateRequest(request, env);
  } catch {
    return createErrorResponse('Authentication failed', 'AUTH_ERROR', 401);
  }

  if (!env.URL_SIGNING_SECRET) {
    return createErrorResponse('Signed downloads are not configured', 'SIGNING_UNAVAILABLE', 503);
  }

  const rateLimit = await checkRateLimit(env, auth.uid, 'upload');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit.resetAt);
  }

  const filename = url.searchParams.get('filename') || '';
  const prefix = normalizeClientUploadPrefix(url.searchParams.get('path') || undefined, auth.uid);
  const contentType = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  const declaredLength = Number(request.headers.get('Content-Length') || 0);

  if (!filename || !prefix) {
    return createErrorResponse('Invalid filename or upload path', 'INVALID_REQUEST', 400);
  }
  if (!isAllowedContentType(contentType)) {
    return createErrorResponse(`Content type '${contentType}' is not allowed`, 'INVALID_CONTENT_TYPE', 400);
  }
  if (declaredLength > MAX_FILE_SIZE) {
    return createErrorResponse('File exceeds the 10MB limit', 'FILE_TOO_LARGE', 413);
  }
  if (!request.body) {
    return createErrorResponse('Missing upload body', 'INVALID_REQUEST', 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_FILE_SIZE) {
      await reader.cancel();
      return createErrorResponse('File exceeds the 10MB limit', 'FILE_TOO_LARGE', 413);
    }
    chunks.push(value);
  }

  if (declaredLength > 0 && declaredLength !== totalBytes) {
    return createErrorResponse('Content length mismatch', 'INVALID_REQUEST', 400);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const validation = await validateFile(bytes.buffer, contentType);
  if (!validation.valid) {
    return createErrorResponse(
      validation.reason || 'File validation failed',
      'VALIDATION_FAILED',
      400
    );
  }

  const key = generateStorageKey(auth.uid, filename, prefix);
  if (!authorizePathAccess(auth.uid, key, 'write')) {
    return createErrorResponse('Not authorized', 'FORBIDDEN', 403);
  }

  await env.R2_BUCKET.put(key, bytes, { httpMetadata: { contentType } });
  const downloadUrl = await createSignedDownloadUrl(url, key, env, 604800);

  return new Response(
    JSON.stringify({ downloadUrl, key, size: totalBytes, contentType }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Issue a short-lived direct R2 URL after Firebase authentication and ownership checks.
 */
async function handlePresignDownload(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return createErrorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  let auth;
  try {
    auth = await authenticateRequest(request, env);
  } catch {
    return createErrorResponse('Authentication failed', 'AUTH_ERROR', 401);
  }

  const rateLimit = await checkRateLimit(env, auth.uid, 'presign');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit.resetAt);
  }

  if (!env.URL_SIGNING_SECRET) {
    return createErrorResponse('Signed downloads are not configured', 'SIGNING_UNAVAILABLE', 503);
  }

  const parsedBody = await parseBoundedJson(request);
  if (!parsedBody.ok) {
    return parsedBody.tooLarge
      ? createErrorResponse('JSON body exceeds the 32KB limit', 'PAYLOAD_TOO_LARGE', 413)
      : createErrorResponse('Invalid JSON body', 'INVALID_REQUEST', 400);
  }

  if (
    typeof parsedBody.value !== 'object' ||
    parsedBody.value === null ||
    Array.isArray(parsedBody.value)
  ) {
    return createErrorResponse('Expected a JSON object', 'INVALID_REQUEST', 400);
  }

  const body = parsedBody.value as Record<string, unknown>;
  const bodyKeys = Object.keys(body);
  const hasKey = Object.prototype.hasOwnProperty.call(body, 'key');
  const hasKeys = Object.prototype.hasOwnProperty.call(body, 'keys');
  if (
    hasKey === hasKeys ||
    bodyKeys.some((name) => name !== 'key' && name !== 'keys')
  ) {
    return createErrorResponse('Provide exactly one of key or keys', 'INVALID_REQUEST', 400);
  }

  let requestedKeys: string[];
  let singleKeyRequest = false;
  if (hasKey) {
    if (typeof body.key !== 'string') {
      return createErrorResponse('key must be a string', 'INVALID_REQUEST', 400);
    }
    requestedKeys = [body.key];
    singleKeyRequest = true;
  } else {
    if (
      !Array.isArray(body.keys) ||
      body.keys.length === 0 ||
      body.keys.length > 100 ||
      body.keys.some((key) => typeof key !== 'string')
    ) {
      return createErrorResponse('keys must contain 1-100 strings', 'INVALID_REQUEST', 400);
    }
    requestedKeys = body.keys as string[];
  }

  if (
    requestedKeys.some(
      (key) => key.length === 0 || new TextEncoder().encode(key).byteLength > 1024
    )
  ) {
    return createErrorResponse('Expected 1-100 storage keys', 'INVALID_REQUEST', 400);
  }

  const keys = [...new Set(requestedKeys)];
  if (keys.some((key) => !authorizePathAccess(auth.uid, key, 'read'))) {
    return createErrorResponse('Not authorized', 'FORBIDDEN', 403);
  }

  if (keys.length === 1 && !(await env.R2_BUCKET.head(keys[0]))) {
    return createErrorResponse('File not found', 'NOT_FOUND', 404);
  }

  const entries = await Promise.all(
    keys.map(async (key) => [key, await createSignedDownloadUrl(url, key, env, 3600)] as const)
  );
  const downloadUrls = Object.fromEntries(entries);
  return new Response(JSON.stringify({
    ...(singleKeyRequest && { downloadUrl: downloadUrls[keys[0]] }),
    downloadUrls,
    expiresIn: 3600,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 處理下載請求
 */
async function handleDownload(
  request: Request,
  url: URL,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return createErrorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  // 提取 key
  let key: string;
  try {
    key = decodeURIComponent(url.pathname.replace('/download/', ''));
  } catch {
    return createErrorResponse('Invalid file key', 'INVALID_REQUEST', 400);
  }

  if (!isCanonicalObjectPath(key)) {
    return createErrorResponse('Invalid file key', 'INVALID_REQUEST', 400);
  }

  // 檢查是否有簽名 URL 參數 (用於分享連結)
  const signature = url.searchParams.get('sig');
  const expires = url.searchParams.get('exp');

  // 如果有簽名，驗證簽名有效性 (允許訪客存取)
  if (signature && expires) {
    if (!env.URL_SIGNING_SECRET) {
      return createErrorResponse('Signed downloads are not configured', 'SIGNING_UNAVAILABLE', 503);
    }
    const isValidSignature = await verifyUrlSignature(key, expires, signature, env.URL_SIGNING_SECRET);
    if (!isValidSignature) {
      return createErrorResponse('Invalid or expired signature', 'INVALID_SIGNATURE', 403);
    }
  } else {
    // 沒有簽名，需要認證
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return createErrorResponse('Authentication required', 'UNAUTHORIZED', 401);
    }

    try {
      const auth = await authenticateRequest(request, env);

      // 速率限制
      const rateLimit = await checkRateLimit(env, auth.uid, 'download');
      if (!rateLimit.allowed) {
        return createRateLimitResponse(rateLimit.resetAt);
      }

      // 權限檢查：用戶只能存取自己的檔案
      if (!authorizePathAccess(auth.uid, key, 'read')) {
        return createErrorResponse('Not authorized to access this file', 'FORBIDDEN', 403);
      }
    } catch {
      return createErrorResponse('Authentication failed', 'AUTH_ERROR', 401);
    }
  }

  // 從 R2 獲取檔案
  try {
    const getOptions: R2GetOptions = {};
    if (request.headers.has('Range')) {
      getOptions.range = request.headers;
    }
    if (
      request.headers.has('If-Match') ||
      request.headers.has('If-None-Match') ||
      request.headers.has('If-Modified-Since') ||
      request.headers.has('If-Unmodified-Since')
    ) {
      getOptions.onlyIf = request.headers;
    }
    const object = await env.R2_BUCKET.get(key, getOptions);

    if (!object) {
      return createErrorResponse('File not found', 'NOT_FOUND', 404);
    }

    // 構建 response headers
    const headers = new Headers();

    // 內容類型
    if (object.httpMetadata?.contentType) {
      headers.set('Content-Type', object.httpMetadata.contentType);
    }

    // ETag 用於快取驗證
    headers.set('ETag', object.httpEtag);

    headers.set('Cache-Control', 'private, max-age=3600');

    if (object.uploaded) {
      headers.set('Last-Modified', object.uploaded.toUTCString());
    }

    // R2 returns metadata without a body when an `onlyIf` precondition does
    // not pass. Preserve HTTP cache semantics instead of returning an empty
    // 200 response with the full object's Content-Length.
    if (!('body' in object)) {
      const status = request.headers.has('If-Match') || request.headers.has('If-Unmodified-Since')
        ? 412
        : 304;
      return new Response(null, { status, headers });
    }

    // Content-Length
    headers.set('Content-Length', object.size.toString());

    const body = (object as R2ObjectBody).body;

    if (request.headers.has('Range') && object.range) {
      const { offset, length } = object.range as { offset: number; length: number };
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Content-Length', length.toString());
      headers.set(
        'Content-Range',
        `bytes ${offset}-${offset + length - 1}/${object.size}`
      );
      return new Response(body, { status: 206, headers });
    }

    return new Response(body, { headers });
  } catch (error) {
    console.error('Download error:', error);
    return createErrorResponse('Failed to download file', 'DOWNLOAD_ERROR', 500);
  }
}

async function createSignedDownloadUrl(
  requestUrl: URL,
  key: string,
  env: Env,
  expiresIn: number
): Promise<string> {
  if (!env.URL_SIGNING_SECRET) {
    throw new Error('URL signing is not configured');
  }

  const expires = String(Date.now() + expiresIn * 1000);
  const signature = await signUrl(key, expires, env.URL_SIGNING_SECRET);
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const downloadUrl = new URL(`/download/${encodedKey}`, requestUrl.origin);
  downloadUrl.searchParams.set('sig', signature);
  downloadUrl.searchParams.set('exp', expires);
  return downloadUrl.toString();
}

/**
 * 處理刪除請求
 */
async function handleDelete(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method !== 'DELETE') {
    return createErrorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  // 驗證認證
  let auth;
  try {
    auth = await authenticateRequest(request, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return createErrorResponse(message, 'AUTH_ERROR', 401);
  }

  // 提取 key
  let key: string;
  try {
    key = decodeURIComponent(url.pathname.replace('/delete/', ''));
  } catch {
    return createErrorResponse('Invalid file key', 'INVALID_REQUEST', 400);
  }

  if (!isCanonicalObjectPath(key)) {
    return createErrorResponse('Invalid file key', 'INVALID_REQUEST', 400);
  }

  // 權限檢查
  if (!authorizePathAccess(auth.uid, key, 'write')) {
    return createErrorResponse('Not authorized', 'FORBIDDEN', 403);
  }

  // 刪除檔案
  try {
    await env.R2_BUCKET.delete(key);

    return new Response(
      JSON.stringify({ success: true, key }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Delete error:', error);
    return createErrorResponse('Failed to delete file', 'DELETE_ERROR', 500);
  }
}

/**
 * 處理公開資源下載 (無需認證)
 * 僅允許 public/showcase/ 路徑，使用 Referer 驗證防止盜連
 */
async function handlePublicDownload(
  request: Request,
  url: URL,
  env: Env
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return createErrorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  // 提取 key: /public/showcase/model.glb -> public/showcase/model.glb
  const key = url.pathname.replace(/^\//, '');

  // 安全檢查：只允許 showcase 子目錄
  if (!key.startsWith('public/showcase/')) {
    return createErrorResponse('Access denied', 'FORBIDDEN', 403);
  }

  // 安全檢查：防止 hotlinking (需要有效 Referer)
  if (!validateReferer(request, env)) {
    return createErrorResponse('Access denied', 'HOTLINK_BLOCKED', 403);
  }

  // 從 R2 獲取完整檔案 (不支援 Range 請求，避免 GLTFLoader 206 問題)
  try {
    const object = await env.R2_BUCKET.get(key);

    if (!object) {
      return createErrorResponse('File not found', 'NOT_FOUND', 404);
    }

    // 構建 response headers
    const headers = new Headers();

    // 內容類型
    if (object.httpMetadata?.contentType) {
      headers.set('Content-Type', object.httpMetadata.contentType);
    }

    // ETag 用於快取驗證
    headers.set('ETag', object.httpEtag);

    // 長期快取 (7 天，公開資源)
    headers.set('Cache-Control', 'public, max-age=604800');

    // Content-Length
    headers.set('Content-Length', object.size.toString());

    // 檢查是否有 body
    const body = 'body' in object ? (object as R2ObjectBody).body : null;

    return new Response(body, { headers });
  } catch (error) {
    console.error('Public download error:', error);
    return createErrorResponse('Failed to download file', 'DOWNLOAD_ERROR', 500);
  }
}

/**
 * 創建錯誤 response
 */
function createErrorResponse(
  message: string,
  code: string,
  status: number
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
