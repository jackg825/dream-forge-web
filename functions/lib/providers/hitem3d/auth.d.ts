/**
 * HiTem3D Authentication Module
 *
 * Handles JWT token management with caching.
 * Tokens are valid for 24 hours; we cache for 23 hours.
 */
/**
 * Token manager for HiTem3D API
 *
 * Uses singleton pattern with thread-safe token refresh.
 */
export declare class HitemAuthManager {
    private accessKey;
    private secretKey;
    private tokenCache;
    private refreshPromise;
    constructor(accessKey: string, secretKey: string);
    /**
     * Get valid access token
     *
     * Returns cached token if still valid, otherwise refreshes.
     * Thread-safe: concurrent calls will share the same refresh promise.
     */
    getAccessToken(): Promise<string>;
    /**
     * Refresh the access token
     */
    private refreshToken;
    /**
     * Clear the token cache (for testing or forced refresh)
     */
    clearCache(): void;
}
