/**
 * HiTem3D Authentication Module
 *
 * Handles JWT token management with caching.
 * Tokens are valid for 24 hours; we cache for 23 hours.
 */

import axios from 'axios';
import * as functions from 'firebase-functions';
import type { HitemTokenResponse } from './types';
import { HITEM_API_BASE, HITEM_TOKEN_TTL_MS, HITEM_ERROR_CODES } from './types';

/**
 * Cached token state
 */
interface TokenCache {
  accessToken: string;
  expiresAt: number;  // Unix timestamp in ms
}

/**
 * Token manager for HiTem3D API
 *
 * Uses singleton pattern with thread-safe token refresh.
 */
export class HitemAuthManager {
  private accessKey: string;
  private secretKey: string;
  private tokenCache: TokenCache | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(accessKey: string, secretKey: string) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
  }

  /**
   * Get valid access token
   *
   * Returns cached token if still valid, otherwise refreshes.
   * Thread-safe: concurrent calls will share the same refresh promise.
   */
  async getAccessToken(): Promise<string> {
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
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Refresh the access token
   */
  private async refreshToken(): Promise<string> {
    try {
      // Create Basic Auth header (access_key:secret_key)
      const credentials = Buffer.from(`${this.accessKey}:${this.secretKey}`).toString('base64');

      functions.logger.info('Refreshing HiTem3D access token');

      const response = await axios.post<HitemTokenResponse>(
        `${HITEM_API_BASE}/open-api/v1/auth/token`,
        {},
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      // Check for successful response
      if (response.data.code !== 200 && response.data.code !== '200') {
        const errorCode = String(response.data.code);
        if (errorCode === HITEM_ERROR_CODES.INVALID_CREDENTIALS) {
          throw new functions.https.HttpsError(
            'unauthenticated',
            'Invalid HiTem3D client credentials'
          );
        }
        throw new functions.https.HttpsError(
          'internal',
          `HiTem3D auth error: ${response.data.msg}`
        );
      }

      if (!response.data.data?.accessToken) {
        throw new functions.https.HttpsError(
          'internal',
          'HiTem3D auth response missing access token'
        );
      }

      const accessToken = response.data.data.accessToken;

      // Cache the token
      this.tokenCache = {
        accessToken,
        expiresAt: Date.now() + HITEM_TOKEN_TTL_MS,
      };

      functions.logger.info('HiTem3D access token refreshed successfully');

      return accessToken;
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        functions.logger.error('HiTem3D auth request failed', {
          status,
          message: error.message,
        });

        if (status === 401) {
          throw new functions.https.HttpsError(
            'unauthenticated',
            'Invalid HiTem3D client credentials'
          );
        }

        throw new functions.https.HttpsError(
          'internal',
          `HiTem3D auth failed: ${error.message}`
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new functions.https.HttpsError(
        'internal',
        `HiTem3D auth failed: ${message}`
      );
    }
  }

  /**
   * Clear the token cache (for testing or forced refresh)
   */
  clearCache(): void {
    this.tokenCache = null;
    this.refreshPromise = null;
  }
}
