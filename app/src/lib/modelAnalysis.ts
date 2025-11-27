/**
 * Model Analysis Utilities
 *
 * Provides functions to analyze 3D geometry and extract
 * useful information like vertex count, face count, and dimensions.
 */

import * as THREE from 'three';

export interface ModelInfo {
  fileName: string;
  fileSize: number;
  vertexCount: number;
  faceCount: number;
  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };
  center: THREE.Vector3;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-TW');
}

/**
 * Format dimension for display (assume model units are in mm)
 */
export function formatDimension(value: number, unit: string = 'mm'): string {
  return `${value.toFixed(2)} ${unit}`;
}

/**
 * Analyze a BufferGeometry and extract model information
 */
export function analyzeGeometry(
  geometry: THREE.BufferGeometry,
  fileName: string,
  fileSize: number
): ModelInfo {
  // Compute bounding box if not already computed
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox();
  }

  const box = geometry.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);

  const center = new THREE.Vector3();
  box.getCenter(center);

  // Calculate vertex and face counts
  const positionAttribute = geometry.attributes.position;
  const vertexCount = positionAttribute ? positionAttribute.count : 0;

  // Face count depends on whether geometry is indexed
  let faceCount: number;
  if (geometry.index) {
    faceCount = geometry.index.count / 3;
  } else {
    faceCount = vertexCount / 3;
  }

  return {
    fileName,
    fileSize,
    vertexCount,
    faceCount: Math.floor(faceCount),
    boundingBox: {
      width: size.x,
      height: size.y,
      depth: size.z,
    },
    center,
  };
}

/**
 * Analyze a THREE.Group (e.g., from GLTF) and extract model information
 */
export function analyzeGroup(
  group: THREE.Group,
  fileName: string,
  fileSize: number
): ModelInfo {
  let totalVertices = 0;
  let totalFaces = 0;

  // Traverse all meshes in the group
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geometry = child.geometry;
      if (geometry.attributes.position) {
        totalVertices += geometry.attributes.position.count;
      }
      if (geometry.index) {
        totalFaces += geometry.index.count / 3;
      } else if (geometry.attributes.position) {
        totalFaces += geometry.attributes.position.count / 3;
      }
    }
  });

  // Compute overall bounding box
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);

  const center = new THREE.Vector3();
  box.getCenter(center);

  return {
    fileName,
    fileSize,
    vertexCount: totalVertices,
    faceCount: Math.floor(totalFaces),
    boundingBox: {
      width: size.x,
      height: size.y,
      depth: size.z,
    },
    center,
  };
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

/**
 * Validate if file is a supported 3D model format
 */
export function isSupported3DFormat(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return ['stl', 'obj', 'glb', 'gltf'].includes(ext);
}
