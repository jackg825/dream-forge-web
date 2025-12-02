'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { LightingState } from '@/types/lighting';
import { DEFAULT_LIGHTING } from '@/types/lighting';

interface SceneLightingProps {
  /** Lighting configuration state */
  lighting?: LightingState;
  /** Enable shadow casting from spotlight (default: true) */
  castShadow?: boolean;
  /** Shadow map size for quality (default: 1024) */
  shadowMapSize?: number;
}

/**
 * SceneLighting - Controllable lighting setup for 3D scenes
 *
 * Replaces hardcoded lights in ModelViewer/PreviewViewer with
 * configurable lighting that responds to user controls.
 *
 * Lighting setup:
 * - Ambient light: Base illumination for all surfaces
 * - Spotlight (directional): Main light source, user-controllable
 * - Fill light (directional): Secondary light to reduce harsh shadows
 *
 * @example
 * ```tsx
 * // Inside a Canvas component
 * <SceneLighting lighting={lightingState} />
 * ```
 */
export function SceneLighting({
  lighting = DEFAULT_LIGHTING,
  castShadow = true,
  shadowMapSize = 1024,
}: SceneLightingProps) {
  // Memoize position array to avoid creating new arrays on every render
  const spotlightPosition = useMemo<[number, number, number]>(
    () => [
      lighting.spotlight.position.x,
      lighting.spotlight.position.y,
      lighting.spotlight.position.z,
    ],
    [lighting.spotlight.position.x, lighting.spotlight.position.y, lighting.spotlight.position.z]
  );

  // Memoize color to avoid creating new Color objects
  const spotlightColor = useMemo(
    () => new THREE.Color(lighting.spotlight.color),
    [lighting.spotlight.color]
  );

  // Calculate fill light position (opposite side of spotlight)
  const fillLightPosition = useMemo<[number, number, number]>(
    () => [
      -lighting.spotlight.position.x,
      lighting.spotlight.position.y,
      -lighting.spotlight.position.z,
    ],
    [lighting.spotlight.position.x, lighting.spotlight.position.y, lighting.spotlight.position.z]
  );

  return (
    <>
      {/* Ambient Light - Base illumination */}
      <ambientLight intensity={lighting.ambient.intensity} />

      {/* Spotlight (Main Directional Light) - User controllable */}
      <directionalLight
        position={spotlightPosition}
        intensity={lighting.spotlight.intensity}
        color={spotlightColor}
        castShadow={castShadow}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/* Fill Light - Softer secondary illumination */}
      <directionalLight
        position={fillLightPosition}
        intensity={lighting.spotlight.intensity * 0.3}
        color="#ffffff"
      />
    </>
  );
}
