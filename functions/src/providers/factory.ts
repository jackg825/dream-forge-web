/**
 * Provider Factory
 *
 * Factory pattern for creating 3D generation provider instances.
 * Uses singleton pattern to reuse provider instances.
 */

import * as functions from 'firebase-functions';
import type { I3DProvider, ProviderType } from './types';
import { RodinProvider } from './rodin/client';
import { MeshyProvider } from './meshy/client';

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
 * Validate provider type
 */
export function isValidProvider(provider: string): provider is ProviderType {
  return provider === 'rodin' || provider === 'meshy';
}
