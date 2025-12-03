/**
 * Tencent Cloud TC3-HMAC-SHA256 Authentication
 *
 * Implements the TC3 signature algorithm for Tencent Cloud API authentication.
 * Reference: https://cloud.tencent.com/document/api/213/30654
 */

import * as crypto from 'crypto';

export interface SignatureParams {
  secretId: string;
  secretKey: string;
  service: string;
  host: string;
  action: string;
  version: string;
  region: string;
  payload: string;
  timestamp?: number;
}

export interface SignedHeaders {
  [key: string]: string;  // Index signature for axios compatibility
  Authorization: string;
  'Content-Type': string;
  Host: string;
  'X-TC-Action': string;
  'X-TC-Version': string;
  'X-TC-Timestamp': string;
  'X-TC-Region': string;
}

/**
 * Generate TC3-HMAC-SHA256 signature and headers
 */
export function signRequest(params: SignatureParams): SignedHeaders {
  const {
    secretId,
    secretKey,
    service,
    host,
    action,
    version,
    region,
    payload,
    timestamp = Math.floor(Date.now() / 1000),
  } = params;

  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const algorithm = 'TC3-HMAC-SHA256';

  // Step 1: Build canonical request
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const contentType = 'application/json; charset=utf-8';
  const signedHeaders = 'content-type;host';

  const hashedPayload = sha256Hex(payload);
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;

  const canonicalRequest = [
    httpRequestMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join('\n');

  // Step 2: Build string to sign
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = sha256Hex(canonicalRequest);

  const stringToSign = [
    algorithm,
    timestamp.toString(),
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n');

  // Step 3: Calculate signature
  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = hmacSha256Hex(secretSigning, stringToSign);

  // Step 4: Build authorization header
  const authorization = [
    `${algorithm} Credential=${secretId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  return {
    Authorization: authorization,
    'Content-Type': contentType,
    Host: host,
    'X-TC-Action': action,
    'X-TC-Version': version,
    'X-TC-Timestamp': timestamp.toString(),
    'X-TC-Region': region,
  };
}

/**
 * SHA256 hash (returns hex string)
 */
function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * HMAC-SHA256 (returns Buffer)
 */
function hmacSha256(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

/**
 * HMAC-SHA256 (returns hex string)
 */
function hmacSha256Hex(key: Buffer, data: string): string {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}
