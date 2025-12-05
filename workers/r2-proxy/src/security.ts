/**
 * 安全控制模組
 * 處理 CORS、Referer 驗證、IP 綁定等安全功能
 */

import type { Env, CorsConfig } from './types';

/**
 * 解析允許的 origins
 */
export function getAllowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
}

/**
 * 驗證 Origin 是否允許
 */
export function validateOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // 非 CORS 請求

  const allowedOrigins = getAllowedOrigins(env);
  return allowedOrigins.some((allowed) => {
    if (allowed === '*') return true;
    return origin === allowed;
  });
}

/**
 * 驗證 Referer 防止 hotlinking
 */
export function validateReferer(request: Request, env: Env): boolean {
  const referer = request.headers.get('Referer');

  // API 請求可能沒有 referer
  if (!referer) {
    // 檢查是否有 Authorization header (API 請求)
    if (request.headers.get('Authorization')) {
      return true;
    }
    // 對於沒有 referer 也沒有 auth 的請求，拒絕
    return false;
  }

  try {
    const refererUrl = new URL(referer);
    const allowedOrigins = getAllowedOrigins(env);

    return allowedOrigins.some((allowed) => {
      if (allowed === '*') return true;
      try {
        const allowedUrl = new URL(allowed);
        return refererUrl.hostname === allowedUrl.hostname;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * 獲取客戶端 IP
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/**
 * 生成 CORS headers
 */
export function getCorsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get('Origin');
  const headers = new Headers();

  // 檢查 origin 是否在允許列表中
  if (origin && validateOrigin(request, env)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, X-Requested-With'
  );
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Access-Control-Allow-Credentials', 'true');

  return headers;
}

/**
 * 處理 CORS preflight 請求
 */
export function handleCorsPrelight(request: Request, env: Env): Response {
  const headers = getCorsHeaders(request, env);
  return new Response(null, { status: 204, headers });
}

/**
 * 添加 CORS headers 到 response
 */
export function addCorsHeaders(
  response: Response,
  request: Request,
  env: Env
): Response {
  const corsHeaders = getCorsHeaders(request, env);
  const newHeaders = new Headers(response.headers);

  corsHeaders.forEach((value, key) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * 生成安全 headers
 */
export function getSecurityHeaders(): Headers {
  const headers = new Headers();

  // 安全 headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 防止瀏覽器快取敏感資料
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('Pragma', 'no-cache');

  return headers;
}

/**
 * URL 簽名生成 (用於短期授權)
 */
export async function signUrl(
  path: string,
  expiresIn: number,
  signingSecret: string
): Promise<string> {
  const expires = Date.now() + expiresIn * 1000;
  const message = `${path}:${expires}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );

  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signatureHex;
}

/**
 * 驗證 URL 簽名
 */
export async function verifyUrlSignature(
  path: string,
  expires: string,
  signature: string,
  signingSecret: string
): Promise<boolean> {
  // 檢查是否過期
  const expiresNum = parseInt(expires, 10);
  if (isNaN(expiresNum) || Date.now() > expiresNum) {
    return false;
  }

  // 重新計算簽名
  const expectedSignature = await signUrl(
    path,
    0,
    signingSecret
  );

  // 這裡需要修正：使用相同的過期時間來驗證
  const message = `${path}:${expires}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const expectedSig = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );

  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === expectedHex;
}
