/**
 * Tier Configuration (Backend)
 *
 * Centralized configuration for Free/Premium membership tiers.
 * Used for server-side validation of tier-restricted features.
 */
import type { ProviderType } from '../providers/types';
import type { UserTier } from '../rodin/types';
export type ViewGenerationModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';
export type HiTem3DResolution = 512 | 1024;
export interface TierFeatureConfig {
    allowedViewModels: ViewGenerationModel[];
    allowedProviders: ProviderType[];
    allowedHiTem3DResolutions: HiTem3DResolution[];
}
/**
 * Feature access by tier
 *
 * Free tier:
 * - View generation: gemini-2.5-flash-image only
 * - Providers: HiTem3D only
 * - HiTem3D resolution: 512 only
 *
 * Premium tier:
 * - View generation: All models
 * - Providers: Hunyuan, Tripo, HiTem3D
 * - HiTem3D resolution: 512 and 1024
 */
export declare const TIER_FEATURES: Record<UserTier, TierFeatureConfig>;
export declare const ADMIN_ONLY_PROVIDERS: ProviderType[];
/**
 * Check if a user tier can access a specific provider
 */
export declare function canAccessProvider(tier: UserTier, provider: ProviderType, isAdmin: boolean): boolean;
/**
 * Check if a user tier can access a specific view generation model
 */
export declare function canAccessViewModel(tier: UserTier, model: ViewGenerationModel, isAdmin: boolean): boolean;
/**
 * Check if a user tier can access a specific HiTem3D resolution
 */
export declare function canAccessHiTem3DResolution(tier: UserTier, resolution: HiTem3DResolution, isAdmin: boolean): boolean;
/**
 * Get tier validation error message
 */
export declare function getTierValidationError(feature: 'provider' | 'viewModel' | 'resolution', value: string): string;
