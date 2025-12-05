/**
 * Presigned URL 生成模組
 * 生成 S3 相容的 presigned URLs 用於直接上傳/下載
 */

import type { Env } from './types';

// R2 endpoint 格式
function getR2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

/**
 * 生成 AWS Signature V4 (簡化版本，用於 R2)
 * 注意：這是簡化實作，生產環境建議使用 aws4fetch 套件
 */
async function signRequest(
  method: string,
  url: URL,
  headers: Headers,
  accessKeyId: string,
  secretAccessKey: string,
  region: string = 'auto'
): Promise<Headers> {
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  // 設置必要的 headers
  headers.set('x-amz-date', amzDate);
  headers.set('host', url.host);

  // 創建 canonical request
  const signedHeaders = Array.from(headers.keys())
    .filter((k) => k.startsWith('x-amz-') || k === 'host' || k === 'content-type')
    .sort()
    .join(';');

  const canonicalHeaders = Array.from(headers.entries())
    .filter(([k]) => k.startsWith('x-amz-') || k === 'host' || k === 'content-type')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.trim()}`)
    .join('\n');

  const canonicalRequest = [
    method,
    url.pathname,
    url.searchParams.toString(),
    canonicalHeaders + '\n',
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  // 創建 string to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const encoder = new TextEncoder();

  const canonicalRequestHash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(canonicalRequest)
  );
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHashHex,
  ].join('\n');

  // 計算簽名
  async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  }

  const kDate = await hmacSha256(encoder.encode('AWS4' + secretAccessKey), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = await hmacSha256(kSigning, stringToSign);

  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // 創建 Authorization header
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signatureHex}`,
  ].join(', ');

  headers.set('Authorization', authorization);
  headers.set('x-amz-content-sha256', 'UNSIGNED-PAYLOAD');

  return headers;
}

/**
 * 生成 Presigned PUT URL (用於上傳)
 */
export async function generatePresignedPutUrl(
  env: Env,
  key: string,
  contentType: string,
  expiresIn: number = 900 // 15 分鐘
): Promise<string> {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 credentials not configured');
  }

  const bucketName = 'dream-forge-storage';
  const endpoint = getR2Endpoint(env.R2_ACCOUNT_ID);
  const url = new URL(`${endpoint}/${bucketName}/${key}`);

  // 添加 query parameters
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  url.searchParams.set('X-Amz-Credential', `${env.R2_ACCESS_KEY_ID}/${credentialScope}`);
  url.searchParams.set('X-Amz-Date', amzDate);
  url.searchParams.set('X-Amz-Expires', expiresIn.toString());
  url.searchParams.set('X-Amz-SignedHeaders', 'content-type;host');

  // 計算簽名
  const encoder = new TextEncoder();

  const canonicalRequest = [
    'PUT',
    `/${bucketName}/${key}`,
    url.searchParams.toString(),
    `content-type:${contentType}`,
    `host:${url.host}`,
    '',
    'content-type;host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const canonicalRequestHash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(canonicalRequest)
  );
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHashHex,
  ].join('\n');

  async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  }

  const kDate = await hmacSha256(
    encoder.encode('AWS4' + env.R2_SECRET_ACCESS_KEY),
    dateStamp
  );
  const kRegion = await hmacSha256(kDate, 'auto');
  const kService = await hmacSha256(kRegion, 's3');
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = await hmacSha256(kSigning, stringToSign);

  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  url.searchParams.set('X-Amz-Signature', signatureHex);

  return url.toString();
}

/**
 * 生成 Presigned GET URL (用於下載)
 */
export async function generatePresignedGetUrl(
  env: Env,
  key: string,
  expiresIn: number = 3600 // 1 小時
): Promise<string> {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 credentials not configured');
  }

  const bucketName = 'dream-forge-storage';
  const endpoint = getR2Endpoint(env.R2_ACCOUNT_ID);
  const url = new URL(`${endpoint}/${bucketName}/${key}`);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  url.searchParams.set('X-Amz-Credential', `${env.R2_ACCESS_KEY_ID}/${credentialScope}`);
  url.searchParams.set('X-Amz-Date', amzDate);
  url.searchParams.set('X-Amz-Expires', expiresIn.toString());
  url.searchParams.set('X-Amz-SignedHeaders', 'host');

  const encoder = new TextEncoder();

  const canonicalRequest = [
    'GET',
    `/${bucketName}/${key}`,
    url.searchParams.toString(),
    `host:${url.host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const canonicalRequestHash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(canonicalRequest)
  );
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHashHex,
  ].join('\n');

  async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  }

  const kDate = await hmacSha256(
    encoder.encode('AWS4' + env.R2_SECRET_ACCESS_KEY),
    dateStamp
  );
  const kRegion = await hmacSha256(kDate, 'auto');
  const kService = await hmacSha256(kRegion, 's3');
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = await hmacSha256(kSigning, stringToSign);

  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  url.searchParams.set('X-Amz-Signature', signatureHex);

  return url.toString();
}
