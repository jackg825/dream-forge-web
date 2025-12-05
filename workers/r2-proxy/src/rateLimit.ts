/**
 * Rate Limiting 模組
 * 使用 Cloudflare KV 實現速率限制
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

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * 檢查用戶級別的 rate limit
 */
export async function checkRateLimit(
  env: Env,
  userId: string,
  action: RateLimitAction
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const config = RATE_LIMIT_CONFIG[action];
  const key = `rate:${action}:${userId}`;
  const now = Date.now();

  try {
    const stored = await env.RATE_LIMIT_KV.get(key, 'json') as RateLimitEntry | null;

    // 如果沒有記錄或已過期，創建新記錄
    if (!stored || stored.resetAt < now) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetAt: now + config.window * 1000,
      };

      await env.RATE_LIMIT_KV.put(key, JSON.stringify(newEntry), {
        expirationTtl: config.window + 10, // 額外 10 秒緩衝
      });

      return {
        allowed: true,
        remaining: config.requests - 1,
        resetAt: newEntry.resetAt,
      };
    }

    // 檢查是否超過限制
    if (stored.count >= config.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: stored.resetAt,
      };
    }

    // 增加計數
    const updatedEntry: RateLimitEntry = {
      count: stored.count + 1,
      resetAt: stored.resetAt,
    };

    await env.RATE_LIMIT_KV.put(key, JSON.stringify(updatedEntry), {
      expirationTtl: Math.ceil((stored.resetAt - now) / 1000) + 10,
    });

    return {
      allowed: true,
      remaining: config.requests - updatedEntry.count,
      resetAt: stored.resetAt,
    };
  } catch (error) {
    // KV 錯誤時允許請求通過 (fail open)
    console.error('Rate limit check failed:', error);
    return {
      allowed: true,
      remaining: config.requests,
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
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `rate:ip:${ip}`;
  const now = Date.now();

  try {
    const stored = await env.RATE_LIMIT_KV.get(key, 'json') as RateLimitEntry | null;

    if (!stored || stored.resetAt < now) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetAt: now + GLOBAL_IP_LIMIT.window * 1000,
      };

      await env.RATE_LIMIT_KV.put(key, JSON.stringify(newEntry), {
        expirationTtl: GLOBAL_IP_LIMIT.window + 10,
      });

      return {
        allowed: true,
        remaining: GLOBAL_IP_LIMIT.requests - 1,
        resetAt: newEntry.resetAt,
      };
    }

    if (stored.count >= GLOBAL_IP_LIMIT.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: stored.resetAt,
      };
    }

    const updatedEntry: RateLimitEntry = {
      count: stored.count + 1,
      resetAt: stored.resetAt,
    };

    await env.RATE_LIMIT_KV.put(key, JSON.stringify(updatedEntry), {
      expirationTtl: Math.ceil((stored.resetAt - now) / 1000) + 10,
    });

    return {
      allowed: true,
      remaining: GLOBAL_IP_LIMIT.requests - updatedEntry.count,
      resetAt: stored.resetAt,
    };
  } catch (error) {
    console.error('IP rate limit check failed:', error);
    return {
      allowed: true,
      remaining: GLOBAL_IP_LIMIT.requests,
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
