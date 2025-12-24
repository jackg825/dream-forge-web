'use client';

/**
 * useTierAccess Hook
 *
 * Provides tier-based feature access control for the frontend.
 * Returns helper functions to check if features are accessible based on user tier.
 */

import { useAuth } from './useAuth';
import {
  canAccessProvider,
  canAccessViewModel,
  canAccessHiTem3DResolution,
  getVisibleProviders,
  isPremiumProvider,
  isPremiumViewModel,
  isPremiumResolution,
  type ViewGenerationModel,
  type HiTem3DResolution,
} from '@/config/tiers';
import type { ModelProvider, UserTier } from '@/types';

export interface UseTierAccessReturn {
  // User tier info
  tier: UserTier;
  isAdmin: boolean;
  isPremium: boolean;

  // Provider access
  canUseProvider: (provider: ModelProvider) => boolean;
  isProviderLocked: (provider: ModelProvider) => boolean;

  // View model access
  canUseViewModel: (model: ViewGenerationModel) => boolean;
  isViewModelLocked: (model: ViewGenerationModel) => boolean;

  // HiTem3D resolution access
  canUseHiTem3DResolution: (resolution: HiTem3DResolution) => boolean;
  isResolutionLocked: (resolution: HiTem3DResolution) => boolean;

  // Get visible providers (based on admin role, not tier)
  getVisibleProviders: () => ModelProvider[];
}

/**
 * Hook for tier-based feature access control
 *
 * @example
 * ```tsx
 * const { tier, canUseProvider, isProviderLocked } = useTierAccess();
 *
 * // Check if user can use a provider
 * if (canUseProvider('hunyuan')) {
 *   // Allow selection
 * }
 *
 * // Check if provider is locked (requires upgrade)
 * if (isProviderLocked('hunyuan')) {
 *   // Show lock icon and upgrade prompt on click
 * }
 * ```
 */
export function useTierAccess(): UseTierAccessReturn {
  const { user } = useAuth();

  const tier: UserTier = user?.tier || 'free';
  const isAdmin = user?.role === 'admin';
  const isPremium = tier === 'premium' || isAdmin;

  return {
    // User tier info
    tier,
    isAdmin,
    isPremium,

    // Provider access - checks user's actual access
    canUseProvider: (provider: ModelProvider) =>
      canAccessProvider(tier, provider, isAdmin),

    // Provider locked - checks if provider requires Premium (for UI display)
    isProviderLocked: (provider: ModelProvider) =>
      !canAccessProvider(tier, provider, isAdmin) && isPremiumProvider(provider),

    // View model access
    canUseViewModel: (model: ViewGenerationModel) =>
      canAccessViewModel(tier, model, isAdmin),

    // View model locked
    isViewModelLocked: (model: ViewGenerationModel) =>
      !canAccessViewModel(tier, model, isAdmin) && isPremiumViewModel(model),

    // HiTem3D resolution access
    canUseHiTem3DResolution: (resolution: HiTem3DResolution) =>
      canAccessHiTem3DResolution(tier, resolution, isAdmin),

    // Resolution locked
    isResolutionLocked: (resolution: HiTem3DResolution) =>
      !canAccessHiTem3DResolution(tier, resolution, isAdmin) && isPremiumResolution(resolution),

    // Get visible providers (admins see all, users see non-admin-only)
    getVisibleProviders: () => getVisibleProviders(isAdmin),
  };
}

// Re-export types for convenience
export type { ViewGenerationModel, HiTem3DResolution } from '@/config/tiers';
