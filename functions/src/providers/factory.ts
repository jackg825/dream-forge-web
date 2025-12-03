/**
 * Provider Factory
 *
 * Factory pattern for creating 3D generation provider instances.
 * Uses singleton pattern to reuse provider instances.
 * Supports: Rodin, Meshy, Hunyuan 3D, Tripo3D
 */

import * as functions from 'firebase-functions';
import type { I3DProvider, ProviderType } from './types';
import { RodinProvider } from './rodin/client';
import { MeshyProvider } from './meshy/client';
// New providers - will be implemented
import { HunyuanProvider } from './hunyuan/client';
import { TripoProvider } from './tripo/client';

/**
 * Factory for creating provider instances
 */
export class ProviderFactory {
  private static instances: Map<ProviderType, I3DProvider> = new Map();

  /**
   * Get provider instance (singleton per type)
   */
  static getProvider(type: ProviderType): I3DProvider {
    if (!this.instances.has(type)) {
      this.instances.set(type, this.createProvider(type));
    }
    return this.instances.get(type)!;
  }

  /**
   * Create new provider instance
   */
  private static createProvider(type: ProviderType): I3DProvider {
    switch (type) {
      case 'rodin':
        return this.createRodinProvider();
      case 'meshy':
        return this.createMeshyProvider();
      case 'hunyuan':
        return this.createHunyuanProvider();
      case 'tripo':
        return this.createTripoProvider();
      default:
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Unknown provider type: ${type}`
        );
    }
  }

  private static createRodinProvider(): I3DProvider {
    const apiKey = process.env.RODIN_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Rodin API key not configured'
      );
    }
    return new RodinProvider(apiKey);
  }

  private static createMeshyProvider(): I3DProvider {
    const apiKey = process.env.MESHY_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Meshy API key not configured'
      );
    }
    return new MeshyProvider(apiKey);
  }

  private static createHunyuanProvider(): I3DProvider {
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    const region = process.env.TENCENT_REGION || 'ap-guangzhou';
    if (!secretId || !secretKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Tencent Cloud credentials not configured (TENCENT_SECRET_ID, TENCENT_SECRET_KEY)'
      );
    }
    return new HunyuanProvider(secretId, secretKey, region);
  }

  private static createTripoProvider(): I3DProvider {
    const apiKey = process.env.TRIPO_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Tripo API key not configured'
      );
    }
    return new TripoProvider(apiKey);
  }

  /**
   * Clear cached instances (for testing)
   */
  static clearInstances(): void {
    this.instances.clear();
  }
}

/**
 * Helper function to get provider instance
 */
export function createProvider(type: ProviderType = 'meshy'): I3DProvider {
  return ProviderFactory.getProvider(type);
}

/**
 * All valid provider types
 */
const VALID_PROVIDERS: ProviderType[] = ['rodin', 'meshy', 'hunyuan', 'tripo'];

/**
 * Validate provider type
 */
export function isValidProvider(provider: string): provider is ProviderType {
  return VALID_PROVIDERS.includes(provider as ProviderType);
}
