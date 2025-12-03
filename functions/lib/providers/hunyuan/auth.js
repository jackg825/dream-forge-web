"use strict";
/**
 * Tencent Cloud TC3-HMAC-SHA256 Authentication
 *
 * Implements the TC3 signature algorithm for Tencent Cloud API authentication.
 * Reference: https://cloud.tencent.com/document/api/213/30654
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.signRequest = signRequest;
const crypto = __importStar(require("crypto"));
/**
 * Generate TC3-HMAC-SHA256 signature and headers
 */
function signRequest(params) {
    const { secretId, secretKey, service, host, action, version, region, payload, timestamp = Math.floor(Date.now() / 1000), } = params;
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
function sha256Hex(data) {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}
/**
 * HMAC-SHA256 (returns Buffer)
 */
function hmacSha256(key, data) {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}
/**
 * HMAC-SHA256 (returns hex string)
 */
function hmacSha256Hex(key, data) {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}
//# sourceMappingURL=auth.js.map