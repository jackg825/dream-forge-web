/**
 * Tencent Cloud TC3-HMAC-SHA256 Authentication
 *
 * Implements the TC3 signature algorithm for Tencent Cloud API authentication.
 * Reference: https://cloud.tencent.com/document/api/213/30654
 */
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
    [key: string]: string;
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
export declare function signRequest(params: SignatureParams): SignedHeaders;
