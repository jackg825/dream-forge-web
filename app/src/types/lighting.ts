/**
 * Lighting types for 3D model viewers
 *
 * Provides controllable lighting state for real-time adjustment
 * of spotlight direction, intensity, color, and ambient lighting.
 */

/**
 * 3D position coordinates
 */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Spotlight configuration
 */
export interface SpotlightConfig {
  /** Light position in 3D space (normalized direction from origin) */
  position: Position3D;
  /** Light intensity (0-2, default: 1) */
  intensity: number;
  /** Light color in HEX format (default: #ffffff) */
  color: string;
}

/**
 * Ambient light configuration
 */
export interface AmbientConfig {
  /** Ambient light intensity (0-1, default: 0.5) */
  intensity: number;
}

/**
 * Complete lighting state for a 3D scene
 */
export interface LightingState {
  spotlight: SpotlightConfig;
  ambient: AmbientConfig;
}

/**
 * Default lighting configuration
 * Matches the original hardcoded values in ModelViewer
 */
export const DEFAULT_LIGHTING: LightingState = {
  spotlight: {
    position: { x: 5, y: 5, z: 5 },
    intensity: 1,
    color: '#ffffff',
  },
  ambient: {
    intensity: 0.5,
  },
};

/**
 * Preset light colors for quick selection
 */
export const LIGHT_COLOR_PRESETS = [
  { value: '#ffffff', label: '純白', description: '中性標準光' },
  { value: '#fef3c7', label: '暖白', description: '自然日光感' },
  { value: '#e0f2fe', label: '冷白', description: '工作室照明' },
  { value: '#fbbf24', label: '琥珀', description: '暖色調重點光' },
] as const;

/**
 * Converts spherical coordinates to Cartesian position
 * @param azimuth - Horizontal angle in degrees (0-360)
 * @param elevation - Vertical angle in degrees (0-90)
 * @param radius - Distance from origin (default: 5)
 */
export function sphericalToCartesian(
  azimuth: number,
  elevation: number,
  radius: number = 5
): Position3D {
  const azimuthRad = (azimuth * Math.PI) / 180;
  const elevationRad = (elevation * Math.PI) / 180;

  return {
    x: radius * Math.cos(elevationRad) * Math.cos(azimuthRad),
    y: radius * Math.sin(elevationRad),
    z: radius * Math.cos(elevationRad) * Math.sin(azimuthRad),
  };
}

/**
 * Converts Cartesian position to spherical coordinates
 * @param position - 3D position
 * @returns { azimuth, elevation, radius } in degrees
 */
export function cartesianToSpherical(position: Position3D): {
  azimuth: number;
  elevation: number;
  radius: number;
} {
  const radius = Math.sqrt(
    position.x * position.x + position.y * position.y + position.z * position.z
  );
  const elevation = Math.asin(position.y / radius) * (180 / Math.PI);
  const azimuth = Math.atan2(position.z, position.x) * (180 / Math.PI);

  return { azimuth, elevation, radius };
}
