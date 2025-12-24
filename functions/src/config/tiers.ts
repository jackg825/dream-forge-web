/**
 * Tier Configuration (Backend)
 *
 * Centralized configuration for Free/Premium membership tiers.
 * Used for server-side validation of tier-restricted features.
 */

import type { ProviderType } from '../providers/types';
import type { UserTier } from '../rodin/types';

// View generation model options (Gemini image generation)
export type ViewGenerationModel = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';

// HiTem3D resolution options
export type HiTem3DResolution = 512 | 1024;

// Tier feature configuration
export interface TierFeatureConfig {
  // View generation models available for this tier
  allowedViewModels: ViewGenerationModel[];

  // 3D generation providers available for this tier
  allowedProviders: ProviderType[];

  // HiTem3D resolution options available for this tier
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
export const TIER_FEATURES: Record<UserTier, TierFeatureConfig> = {
  free: {
    allowedViewModels: ['gemini-2.5-flash-image'],
    allowedProviders: ['hitem3d'],
    allowedHiTem3DResolutions: [512],
  },
  premium: {
    allowedViewModels: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'],
    allowedProviders: ['hunyuan', 'tripo', 'hitem3d'],
    allowedHiTem3DResolutions: [512, 1024],
  },
};

// Admin-only providers
export const ADMIN_ONLY_PROVIDERS: ProviderType[] = ['meshy', 'rodin'];

/**
 * Check if a user tier can access a specific provider
 */
export function canAccessProvider(
  tier: UserTier,
  provider: ProviderType,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  if (ADMIN_ONLY_PROVIDERS.includes(provider)) return false;
  return TIER_FEATURES[tier].allowedProviders.includes(provider);
}

/**
 * Check if a user tier can access a specific view generation model
 */
export function canAccessViewModel(
  tier: UserTier,
  model: ViewGenerationModel,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  return TIER_FEATURES[tier].allowedViewModels.includes(model);
}

/**
 * Check if a user tier can access a specific HiTem3D resolution
 */
export function canAccessHiTem3DResolution(
  tier: UserTier,
  resolution: HiTem3DResolution,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  return TIER_FEATURES[tier].allowedHiTem3DResolutions.includes(resolution);
}

/**
 * Get tier validation error message
 */
export function getTierValidationError(
  feature: 'provider' | 'viewModel' | 'resolution',
  value: string
): string {
  const messages = {
    provider: `Premium subscription required to use ${value} provider`,
    viewModel: `Premium subscription required for ${value} view generation`,
    resolution: `Premium subscription required for ${value} resolution`,
  };
  return messages[feature];
}
