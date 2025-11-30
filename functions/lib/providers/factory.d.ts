/**
 * Provider Factory
 *
 * Factory pattern for creating 3D generation provider instances.
 * Uses singleton pattern to reuse provider instances.
 */
import type { I3DProvider, ProviderType } from './types';
/**
 * Factory for creating provider instances
 */
export declare class ProviderFactory {
    private static instances;
    /**
     * Get provider instance (singleton per type)
     */
    static getProvider(type: ProviderType): I3DProvider;
    /**
     * Create new provider instance
     */
    private static createProvider;
    private static createRodinProvider;
    private static createMeshyProvider;
    /**
     * Clear cached instances (for testing)
     */
    static clearInstances(): void;
}
/**
 * Helper function to get provider instance
 */
export declare function createProvider(type?: ProviderType): I3DProvider;
/**
 * Validate provider type
 */
export declare function isValidProvider(provider: string): provider is ProviderType;
