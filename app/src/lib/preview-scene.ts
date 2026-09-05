import * as THREE from 'three';

export type PreviewCameraView = 'perspective' | 'front' | 'back' | 'left' | 'right' | 'top';
export type PreviewDisplayMode = 'textured' | 'clay' | 'wireframe';

/** Keep source transforms/materials intact; only the preview wrapper is normalized. */
export function createPreviewScene(geometry: THREE.BufferGeometry | null, group: THREE.Group | null) {
  const object = new THREE.Group();
  if (group) object.add(group.clone(true));
  else if (geometry) object.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: geometry.hasAttribute('color') ? '#ffffff' : '#b8bec8',
    vertexColors: geometry.hasAttribute('color'), roughness: 0.8, side: THREE.DoubleSide,
  })));

  const meshes: Array<{ mesh: THREE.Mesh; textured: THREE.Material | THREE.Material[]; inspection: THREE.MeshStandardMaterial; wireframe: THREE.MeshBasicMaterial }> = [];
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const textured = !group ? child.material : Array.isArray(child.material)
      ? child.material.map((material) => material.clone())
      : child.material.clone();
    child.material = textured;
    meshes.push({ mesh: child, textured, inspection: new THREE.MeshStandardMaterial({ color: '#b8bec8', roughness: 0.8, side: THREE.DoubleSide }), wireframe: new THREE.MeshBasicMaterial({ color: '#8793a6', wireframe: true }) });
  });

  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  if (meshes.length === 0 || !Number.isFinite(extent) || extent <= 0) {
    meshes.forEach(({ textured, inspection, wireframe }) => { (Array.isArray(textured) ? textured : [textured]).forEach((m) => m.dispose()); inspection.dispose(); wireframe.dispose(); });
    throw new Error('The file contains no visible mesh.');
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 2 / extent;
  object.scale.setScalar(scale);
  object.position.copy(center.multiplyScalar(-scale));
  object.position.y += size.y * scale / 2 - 1;
  object.updateMatrixWorld(true);
  bounds.setFromObject(object);

  return {
    object,
    bounds,
    setDisplay(mode: PreviewDisplayMode, plane: THREE.Plane | null) {
      meshes.forEach(({ mesh, textured, inspection, wireframe }) => {
        mesh.material = mode === 'textured' ? textured : mode === 'wireframe' ? wireframe : inspection;
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
          material.clippingPlanes = plane ? [plane] : [];
          material.needsUpdate = true;
        });
      });
    },
    dispose() {
      meshes.forEach(({ textured, inspection, wireframe }) => {
        (Array.isArray(textured) ? textured : [textured]).forEach((material) => material.dispose());
        inspection.dispose(); wireframe.dispose();
      });
    },
  };
}

export function getPreviewClippingPlane(bounds: THREE.Box3, axis: 'x' | 'y' | 'z', position: number, inverted = false) {
  const direction = inverted ? 1 : -1;
  const normal = new THREE.Vector3(axis === 'x' ? direction : 0, axis === 'y' ? direction : 0, axis === 'z' ? direction : 0);
  const coordinate = THREE.MathUtils.lerp(bounds.min[axis], bounds.max[axis], THREE.MathUtils.clamp(position, 0, 100) / 100);
  return new THREE.Plane(normal, -direction * coordinate);
}

export function getPreviewCamera(bounds: THREE.Box3, view: PreviewCameraView, aspect: number, fov = 45) {
  const target = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
  const verticalFov = THREE.MathUtils.degToRad(fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(aspect, 0.1));
  const distance = radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 1.25;
  const directions: Record<PreviewCameraView, [number, number, number]> = {
    perspective: [1, 0.65, 1], front: [0, 0, 1], back: [0, 0, -1],
    left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0],
  };
  return {
    target,
    position: new THREE.Vector3(...directions[view]).normalize().multiplyScalar(distance).add(target),
    up: new THREE.Vector3(0, view === 'top' ? 0 : 1, view === 'top' ? -1 : 0),
  };
}
