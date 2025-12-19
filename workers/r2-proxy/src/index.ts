/**
 * Dream Forge R2 Storage Proxy Worker
 * 處理所有儲存相關的請求，包含認證、上傳、下載
 */

import type { Env, PresignRequest, UploadConfirmRequest } from './types';
import { authenticateRequest, authorizePathAccess } from './auth';
import { validateOrigin, validateReferer, handleCorsPrelight, addCorsHeaders, getClientIP, verifyUrlSignature } from './security';
import { checkRateLimit, checkIpRateLimit, createRateLimitResponse } from './rateLimit';
import { validateFile, isAllowedContentType, generateStorageKey, MAX_FILE_SIZE } from './validation';
import { generatePresignedPutUrl, generatePresignedGetUrl } from './presign';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCorsPrelight(request, env);
    }

    // 驗證 Origin
    if (!validateOrigin(request, env)) {
      return createErrorResponse('Origin not allowed', 'CORS_ERROR', 403);
    }

    try {
      // 路由處理
      const response = await handleRequest(request, url, env, ctx);

      // 添加 CORS headers
      return addCorsHeaders(response, request, env);
    } catch (error) {
      console.error('Request error:', error);

      const message = error instanceof Error ? error.message : 'Internal server error';
      const response = createErrorResponse(message, 'INTERNAL_ERROR', 500);

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
      return handlePresignUpload(request, env);

    case path.startsWith('/upload/confirm'):
      return handleUploadConfirm(request, env);

    case path.startsWith('/download/'):
      return handleDownload(request, url, env, ctx);

    case path.startsWith('/delete/'):
      return handleDelete(request, url, env);

    default:
      return createErrorResponse('Not found', 'NOT_FOUND', 404);
  }
}

/**
 * 處理 presigned upload 請求
 */
async function handlePresignUpload(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return createErrorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  // 1. 驗證 Firebase JWT
  let auth;
  try {
    auth = await authenticateRequest(request, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return createErrorResponse(message, 'AUTH_ERROR', 401);
  }

  // 2. 速率限制
  const rateLimit = await checkRateLimit(env, auth.uid, 'presign');
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit.resetAt);
  }

  // 3. 解析請求
  let body: PresignRequest;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse('Invalid JSON body', 'INVALID_REQUEST', 400);
  }

  const { filename, contentType, size, path: customPath } = body;

  // 4. 驗證必要欄位
  if (!filename || !contentType || typeof size !== 'number') {
    return createErrorResponse(
      'Missing required fields: filename, contentType, size',
      'INVALID_REQUEST',
      400
    );
  }

  // 5. 驗證檔案類型
  if (!isAllowedContentType(contentType)) {
    return createErrorResponse(
      `Content type '${contentType}' is not allowed`,
      'INVALID_CONTENT_TYPE',
      400
    );
  }

  // 6. 驗證檔案大小
  if (size > MAX_FILE_SIZE) {
    return createErrorResponse(
      `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
      'FILE_TOO_LARGE',
      400
    );
  }

  if (size <= 0) {
    return createErrorResponse('Invalid file size', 'INVALID_REQUEST', 400);
  }

  // 7. 生成儲存路徑
  const prefix = customPath || 'uploads';
  const key = generateStorageKey(auth.uid, filename, prefix);

  // 8. 檢查路徑授權
  if (!authorizePathAccess(auth.uid, key, 'write')) {
    return createErrorResponse('Not authorized to write to this path', 'FORBIDDEN', 403);
  }

  // 9. 生成 presigned URL
  try {
    const uploadUrl = await generatePresignedPutUrl(env, key, contentType, 900);

    return new Response(
      JSON.stringify({
        uploadUrl,
        key,
        expiresIn: 900,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to generate presigned URL:', error);
    return createErrorResponse(
      'Failed to generate upload URL',
      'PRESIGN_ERROR',
      500
    );
  }
}

/**
 * 處理上傳確認請求 (驗證已上傳的檔案)
 */
async function handleUploadConfirm(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
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

  // 解析請求
  let body: UploadConfirmRequest;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse('Invalid JSON body', 'INVALID_REQUEST', 400);
  }

  const { key } = body;

  if (!key) {
    return createErrorResponse('Missing required field: key', 'INVALID_REQUEST', 400);
  }

  // 檢查路徑授權
  if (!authorizePathAccess(auth.uid, key, 'write')) {
    return createErrorResponse('Not authorized', 'FORBIDDEN', 403);
  }

  // 驗證檔案存在並檢查內容
  try {
    const object = await env.R2_BUCKET.get(key);

    if (!object) {
      return createErrorResponse('File not found', 'NOT_FOUND', 404);
    }

    // 讀取檔案並驗證
    const arrayBuffer = await object.arrayBuffer();
    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';

    const validation = await validateFile(arrayBuffer, contentType);

    if (!validation.valid) {
      // 刪除無效檔案
      await env.R2_BUCKET.delete(key);
      return createErrorResponse(
        validation.reason || 'File validation failed',
        'VALIDATION_FAILED',
        400
      );
    }

    // 生成下載 URL
    const downloadUrl = `/download/${key}`;

    return new Response(
      JSON.stringify({
        success: true,
        key,
        downloadUrl,
        size: arrayBuffer.byteLength,
        contentType,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Upload confirm error:', error);
    return createErrorResponse('Failed to confirm upload', 'CONFIRM_ERROR', 500);
  }
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
  const key = url.pathname.replace('/download/', '');

  if (!key) {
    return createErrorResponse('Missing file key', 'INVALID_REQUEST', 400);
  }

  // 公開路徑：pipelines/*, uploads/*, optimized/* 允許公開訪問
  // 路徑格式包含 userId，所以需要知道完整路徑才能訪問
  const isPublicPath = key.startsWith('pipelines/') || key.startsWith('uploads/') || key.startsWith('optimized/');

  if (isPublicPath) {
    // 公開路徑：只驗證 Referer 防止 hotlinking
    if (!validateReferer(request, env)) {
      return createErrorResponse('Access denied', 'HOTLINK_BLOCKED', 403);
    }
    // 跳過認證，直接下載
  } else {
    // 檢查是否有簽名 URL 參數 (用於分享連結)
    const signature = url.searchParams.get('sig');
    const expires = url.searchParams.get('exp');

    // 如果有簽名，驗證簽名有效性 (允許訪客存取)
    if (signature && expires) {
      const isValidSignature = await verifyUrlSignature(key, expires, signature, env.URL_SIGNING_SECRET || 'default-secret');
      if (isValidSignature) {
        // 簽名有效，允許訪客存取（但仍驗證 Referer 防止 hotlinking）
        if (!validateReferer(request, env)) {
          return createErrorResponse('Access denied', 'HOTLINK_BLOCKED', 403);
        }
        // 簽名有效，跳過認證，直接下載
      } else {
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
  }

  // 從 R2 獲取檔案
  try {
    // 對於公開路徑 (pipelines/*, uploads/*)，不支援 Range 請求
    // 因為 Three.js loaders 不能處理 206 響應
    const object = isPublicPath
      ? await env.R2_BUCKET.get(key)  // 完整檔案
      : await env.R2_BUCKET.get(key, {
          range: request.headers,
          onlyIf: request.headers,
        });

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

    // 快取控制 (24 小時)
    headers.set('Cache-Control', 'public, max-age=86400');

    // Content-Length
    headers.set('Content-Length', object.size.toString());

    // 檢查是否有 body (R2ObjectBody vs R2Object)
    const body = 'body' in object ? object.body : null;

    // 處理 Range 請求 (僅非公開路徑)
    if (!isPublicPath && object.range) {
      const { offset, length } = object.range as { offset: number; length: number };
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
  const key = url.pathname.replace('/delete/', '');

  if (!key) {
    return createErrorResponse('Missing file key', 'INVALID_REQUEST', 400);
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
    const body = 'body' in object ? object.body : null;

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
