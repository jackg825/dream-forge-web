import * as THREE from 'three';

export interface ModelRotation {
  x: number; // degrees
  y: number;
  z: number;
}

export interface OrientationResult {
  scale: number;
  groundOffset: number;
}

/**
 * Apply Z-up to Y-up coordinate conversion
 * Rotates the object -90 degrees around the X-axis
 * This transforms: Z-up → Y-up, Y-forward → Z-backward
 */
export function applyZUpToYUpRotation(object: THREE.Object3D): void {
  const rotationMatrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  object.applyMatrix4(rotationMatrix);
}

/**
 * Align the model so its bottom sits on the ground plane
 * Must be called AFTER scaling and centering
 */
export function alignToGroundPlane(
  object: THREE.Object3D,
  groundY: number = -1
): number {
  // Compute fresh bounding box after all other transforms
  const box = new THREE.Box3().setFromObject(object);
  const offset = groundY - box.min.y;
  object.position.y += offset;
  return offset;
}

/**
 * Scale and center a model to fit within target size
 * Returns the scale factor used
 */
export function scaleAndCenter(
  object: THREE.Object3D,
  targetSize: number = 2
): number {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = targetSize / maxDim;

  object.scale.setScalar(scale);

  // Center at origin
  const center = new THREE.Vector3();
  box.getCenter(center);
  object.position.copy(center.multiplyScalar(-scale));

  return scale;
}

/**
 * Apply user rotation (additive adjustment in degrees)
 */
export function applyUserRotation(
  object: THREE.Object3D,
  rotation: ModelRotation
): void {
  object.rotation.x += THREE.MathUtils.degToRad(rotation.x);
  object.rotation.y += THREE.MathUtils.degToRad(rotation.y);
  object.rotation.z += THREE.MathUtils.degToRad(rotation.z);
}

/**
 * Full model orientation pipeline:
 * 1. Apply Z-up to Y-up rotation (optional)
 * 2. Scale to target size
 * 3. Center at origin
 * 4. Align to ground plane
 * 5. Apply user rotation override (optional)
 */
export function orientModel(
  object: THREE.Object3D,
  options: {
    targetSize?: number;
    groundY?: number;
    applyZToYRotation?: boolean;
    userRotation?: ModelRotation;
  } = {}
): OrientationResult {
  const {
    targetSize = 2,
    groundY = -1,
    applyZToYRotation = true,
    userRotation,
  } = options;

  // Step 1: Z-up to Y-up conversion
  if (applyZToYRotation) {
    applyZUpToYUpRotation(object);
  }

  // Update the object's matrix before computing bounding box
  object.updateMatrixWorld(true);

  // Step 2 & 3: Scale and center
  const scale = scaleAndCenter(object, targetSize);

  // Update matrix again after scale/center
  object.updateMatrixWorld(true);

  // Step 4: Align to ground
  const groundOffset = alignToGroundPlane(object, groundY);

  // Step 5: Apply user rotation (additive)
  if (userRotation) {
    applyUserRotation(object, userRotation);
  }

  return { scale, groundOffset };
}

/**
 * Orient a BufferGeometry (for STL models)
 * Note: This modifies the geometry directly
 */
export function orientGeometry(
  geometry: THREE.BufferGeometry,
  applyZToYRotation: boolean = true
): void {
  if (applyZToYRotation) {
    // Rotate the geometry itself
    geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  }

  // Recompute normals after rotation
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
}
