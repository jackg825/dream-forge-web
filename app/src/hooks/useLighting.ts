import { useState, useCallback, useMemo } from 'react';
import {
  LightingState,
  DEFAULT_LIGHTING,
  Position3D,
  sphericalToCartesian,
  cartesianToSpherical,
} from '@/types/lighting';

/**
 * Hook for managing lighting state in 3D viewers
 *
 * Provides controlled state and update functions for:
 * - Spotlight position (via spherical or Cartesian coordinates)
 * - Spotlight intensity and color
 * - Ambient light intensity
 *
 * @example
 * ```tsx
 * const { lighting, updateSpotlightPosition, resetLighting } = useLighting();
 *
 * <SceneLighting lighting={lighting} />
 * <AngleSphereWidget
 *   position={lighting.spotlight.position}
 *   onPositionChange={updateSpotlightPosition}
 * />
 * ```
 */
export function useLighting(initialState: LightingState = DEFAULT_LIGHTING) {
  const [lighting, setLighting] = useState<LightingState>(initialState);

  /**
   * Update spotlight position directly with Cartesian coordinates
   */
  const updateSpotlightPosition = useCallback((position: Position3D) => {
    setLighting((prev) => ({
      ...prev,
      spotlight: { ...prev.spotlight, position },
    }));
  }, []);

  /**
   * Update spotlight position using spherical coordinates (degrees)
   */
  const updateSpotlightFromSpherical = useCallback(
    (azimuth: number, elevation: number, radius: number = 5) => {
      const position = sphericalToCartesian(azimuth, elevation, radius);
      updateSpotlightPosition(position);
    },
    [updateSpotlightPosition]
  );

  /**
   * Update spotlight intensity
   */
  const updateSpotlightIntensity = useCallback((intensity: number) => {
    setLighting((prev) => ({
      ...prev,
      spotlight: { ...prev.spotlight, intensity: Math.max(0, Math.min(2, intensity)) },
    }));
  }, []);

  /**
   * Update spotlight color
   */
  const updateSpotlightColor = useCallback((color: string) => {
    setLighting((prev) => ({
      ...prev,
      spotlight: { ...prev.spotlight, color },
    }));
  }, []);

  /**
   * Update ambient light intensity
   */
  const updateAmbientIntensity = useCallback((intensity: number) => {
    setLighting((prev) => ({
      ...prev,
      ambient: { intensity: Math.max(0, Math.min(1, intensity)) },
    }));
  }, []);

  /**
   * Reset lighting to default values
   */
  const resetLighting = useCallback(() => {
    setLighting(DEFAULT_LIGHTING);
  }, []);

  /**
   * Get current spotlight position in spherical coordinates
   */
  const spotlightSpherical = useMemo(
    () => cartesianToSpherical(lighting.spotlight.position),
    [lighting.spotlight.position]
  );

  return {
    lighting,
    setLighting,

    // Spotlight updates
    updateSpotlightPosition,
    updateSpotlightFromSpherical,
    updateSpotlightIntensity,
    updateSpotlightColor,

    // Ambient updates
    updateAmbientIntensity,

    // Utilities
    resetLighting,
    spotlightSpherical,
  };
}

export type UseLightingReturn = ReturnType<typeof useLighting>;
