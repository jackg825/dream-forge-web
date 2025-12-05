/**
 * Firebase JWT 認證模組
 * 驗證 Firebase ID Token 並提取用戶資訊
 */

import * as jose from 'jose';
import type { Env, AuthResult } from './types';

// Firebase 公鑰快取
let cachedKeys: jose.JWTVerifyGetKey | null = null;
let cacheExpiry = 0;

const FIREBASE_PUBLIC_KEYS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/**
 * 獲取 Firebase 公鑰 (帶快取)
 */
async function getFirebasePublicKeys(): Promise<jose.JWTVerifyGetKey> {
  const now = Date.now();

  if (cachedKeys && now < cacheExpiry) {
    return cachedKeys;
  }

  const response = await fetch(FIREBASE_PUBLIC_KEYS_URL);
  const keys = await response.json() as Record<string, string>;

  // 解析 cache-control header 獲取過期時間
  const cacheControl = response.headers.get('cache-control');
  const maxAgeMatch = cacheControl?.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) * 1000 : 3600000;

  cacheExpiry = now + maxAge;

  // 將 PEM 格式的公鑰轉換為 JWKS 格式
  const jwks: jose.JSONWebKeySet = {
    keys: await Promise.all(
      Object.entries(keys).map(async ([kid, pem]) => {
        const key = await jose.importX509(pem, 'RS256');
        const jwk = await jose.exportJWK(key);
        return { ...jwk, kid, use: 'sig', alg: 'RS256' };
      })
    ),
  };

  cachedKeys = jose.createLocalJWKSet(jwks);
  return cachedKeys;
}

/**
 * 驗證 Firebase ID Token
 */
export async function validateFirebaseToken(
  token: string,
  env: Env
): Promise<AuthResult> {
  try {
    const JWKS = await getFirebasePublicKeys();

    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
    });

    // 驗證必要的 claims
    if (!payload.sub) {
      throw new Error('Missing subject (uid) in token');
    }

    // 檢查 token 是否過期
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }

    // 檢查 auth_time (token 必須是最近發行的)
    if (payload.auth_time && typeof payload.auth_time === 'number') {
      if (payload.auth_time > now) {
        throw new Error('Invalid auth_time');
      }
    }

    return {
      uid: payload.sub,
      email: payload.email as string | undefined,
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new Error('Token expired');
    }
    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      throw new Error('Token validation failed: invalid claims');
    }
    throw error;
  }
}

/**
 * 從 Request 提取並驗證 token
 */
export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid Authorization header format');
  }

  const token = authHeader.substring(7);

  if (!token) {
    throw new Error('Empty token');
  }

  return validateFirebaseToken(token, env);
}

/**
 * 檢查用戶是否有權限存取指定路徑
 */
export function authorizePathAccess(
  uid: string,
  path: string,
  action: 'read' | 'write'
): boolean {
  const parts = path.split('/').filter(Boolean);

  if (parts.length < 2) {
    return false;
  }

  const [bucket, userId] = parts;

  // 用戶只能存取自己的路徑
  if (userId !== uid) {
    return false;
  }

  // 伺服器專用路徑禁止直接寫入
  const serverOnlyBuckets = ['models', 'sessions', 'pipelines'];
  if (action === 'write' && serverOnlyBuckets.includes(bucket)) {
    return false;
  }

  return true;
}
