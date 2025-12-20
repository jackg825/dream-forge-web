"use strict";
/**
 * HiTem3D Authentication Module
 *
 * Handles JWT token management with caching.
 * Tokens are valid for 24 hours; we cache for 23 hours.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HitemAuthManager = void 0;
const axios_1 = __importDefault(require("axios"));
const functions = __importStar(require("firebase-functions"));
const types_1 = require("./types");
/**
 * Token manager for HiTem3D API
 *
 * Uses singleton pattern with thread-safe token refresh.
 */
class HitemAuthManager {
    accessKey;
    secretKey;
    tokenCache = null;
    refreshPromise = null;
    constructor(accessKey, secretKey) {
        this.accessKey = accessKey;
        this.secretKey = secretKey;
    }
    /**
     * Get valid access token
     *
     * Returns cached token if still valid, otherwise refreshes.
     * Thread-safe: concurrent calls will share the same refresh promise.
     */
    async getAccessToken() {
        // Check if cached token is still valid (with 5 min buffer)
        const now = Date.now();
        if (this.tokenCache && this.tokenCache.expiresAt > now + 5 * 60 * 1000) {
            return this.tokenCache.accessToken;
        }
        // If a refresh is already in progress, wait for it
        if (this.refreshPromise) {
            return this.refreshPromise;
        }
        // Start a new refresh
        this.refreshPromise = this.refreshToken();
        try {
            const token = await this.refreshPromise;
            return token;
        }
        finally {
            this.refreshPromise = null;
        }
    }
    /**
     * Refresh the access token
     */
    async refreshToken() {
        try {
            // Create Basic Auth header (access_key:secret_key)
            const credentials = Buffer.from(`${this.accessKey}:${this.secretKey}`).toString('base64');
            functions.logger.info('Refreshing HiTem3D access token');
            const response = await axios_1.default.post(`${types_1.HITEM_API_BASE}/open-api/v1/auth/token`, {}, {
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            // Check for successful response
            if (response.data.code !== 200 && response.data.code !== '200') {
                const errorCode = String(response.data.code);
                if (errorCode === types_1.HITEM_ERROR_CODES.INVALID_CREDENTIALS) {
                    throw new functions.https.HttpsError('unauthenticated', 'Invalid HiTem3D client credentials');
                }
                throw new functions.https.HttpsError('internal', `HiTem3D auth error: ${response.data.msg}`);
            }
            if (!response.data.data?.accessToken) {
                throw new functions.https.HttpsError('internal', 'HiTem3D auth response missing access token');
            }
            const accessToken = response.data.data.accessToken;
            // Cache the token
            this.tokenCache = {
                accessToken,
                expiresAt: Date.now() + types_1.HITEM_TOKEN_TTL_MS,
            };
            functions.logger.info('HiTem3D access token refreshed successfully');
            return accessToken;
        }
        catch (error) {
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            if (axios_1.default.isAxiosError(error)) {
                const status = error.response?.status;
                functions.logger.error('HiTem3D auth request failed', {
                    status,
                    message: error.message,
                });
                if (status === 401) {
                    throw new functions.https.HttpsError('unauthenticated', 'Invalid HiTem3D client credentials');
                }
                throw new functions.https.HttpsError('internal', `HiTem3D auth failed: ${error.message}`);
            }
            const message = error instanceof Error ? error.message : String(error);
            throw new functions.https.HttpsError('internal', `HiTem3D auth failed: ${message}`);
        }
    }
    /**
     * Clear the token cache (for testing or forced refresh)
     */
    clearCache() {
        this.tokenCache = null;
        this.refreshPromise = null;
    }
}
exports.HitemAuthManager = HitemAuthManager;
//# sourceMappingURL=auth.js.map