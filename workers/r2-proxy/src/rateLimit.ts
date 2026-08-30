/**
 * Rate Limiting module backed by Cloudflare's native Rate Limiting API.
 *
 * KV cannot safely implement a request counter: writes to the same key are
 * limited and read-modify-write updates are not atomic. Native bindings avoid
 * those availability and concurrency failures.
 */

import type { Env, RateLimitAction, RateLimitConfig } from './types';

// Rate limit 配置
const RATE_LIMIT_CONFIG: Record<RateLimitAction, RateLimitConfig> = {
  upload: { requests: 10, window: 60 }, // 10 次上傳/分鐘
  download: { requests: 100, window: 60 }, // 100 次下載/分鐘
  presign: { requests: 50, window: 60 }, // 50 次簽名請求/分鐘
};

// 全局 IP rate limit (針對未認證請求)
const GLOBAL_IP_LIMIT: RateLimitConfig = {
  requests: 200,
  window: 60,
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

function getActionLimiter(env: Env, action: RateLimitAction): RateLimit {
  switch (action) {
    case 'upload':
      return env.UPLOAD_RATE_LIMITER;
    case 'download':
      return env.DOWNLOAD_RATE_LIMITER;
    case 'presign':
      return env.PRESIGN_RATE_LIMITER;
  }
}

/**
 * 檢查用戶級別的 rate limit
 */
export async function checkRateLimit(
  env: Env,
  userId: string,
  action: RateLimitAction
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIG[action];
  const now = Date.now();

  try {
    const { success } = await getActionLimiter(env, action).limit({ key: userId });

    return {
      allowed: success,
      remaining: success ? config.requests - 1 : 0,
      resetAt: now + config.window * 1000,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + config.window * 1000,
    };
  }
}

/**
 * 檢查 IP 級別的 rate limit (用於未認證請求)
 */
export async function checkIpRateLimit(
  env: Env,
  ip: string
): Promise<RateLimitResult> {
  const now = Date.now();

  try {
    const { success } = await env.IP_RATE_LIMITER.limit({ key: ip });

    return {
      allowed: success,
      remaining: success ? GLOBAL_IP_LIMIT.requests - 1 : 0,
      resetAt: now + GLOBAL_IP_LIMIT.window * 1000,
    };
  } catch (error) {
    console.error('IP rate limit check failed:', error);
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + GLOBAL_IP_LIMIT.window * 1000,
    };
  }
}

/**
 * 生成 rate limit response headers
 */
export function getRateLimitHeaders(
  remaining: number,
  resetAt: number,
  limit: number
): Headers {
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', limit.toString());
  headers.set('X-RateLimit-Remaining', Math.max(0, remaining).toString());
  headers.set('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString());
  return headers;
}

/**
 * 創建 rate limit exceeded response
 */
export function createRateLimitResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}
