import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPreviewScene, getPreviewClippingPlane, getPreviewCamera } from '../src/lib/preview-scene.ts';

function fixture() {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(10, 20, 5);
  const material = new THREE.MeshStandardMaterial({ color: '#d54a35', metalness: 0.3 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(12, 8, -5);
  group.add(mesh);
  group.rotation.y = Math.PI / 3;
  group.position.set(14, 3, -5);
  return { group, mesh, geometry, material };
}

test('normalizes a translated, rotated source without changing the source or losing its material', () => {
  const { group, mesh, material } = fixture();
  group.updateMatrixWorld(true);
  const originalTransform = group.matrixWorld.clone();
  const scene = createPreviewScene(null, group);
  const size = scene.bounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(Math.max(size.x, size.y, size.z) - 2) < 1e-10);
  assert.ok(Math.abs(scene.bounds.min.y + 1) < 1e-10);
  assert.ok(group.matrixWorld.equals(originalTransform));
  scene.setDisplay('wireframe', null);
  assert.equal(mesh.material, material);
  assert.equal(material.wireframe, false);
  scene.setDisplay('textured', null);
  let previewMesh;
  scene.object.traverse((child) => { if (child.isMesh) previewMesh = child; });
  assert.notEqual(previewMesh.material, material);
  assert.ok(previewMesh.material.color.equals(material.color));
  scene.dispose();
});

test('cross-section endpoints use normalized world bounds and inversion retains the same cut', () => {
  const scene = createPreviewScene(null, fixture().group);
  for (const axis of ['x', 'y', 'z']) {
    const low = getPreviewClippingPlane(scene.bounds, axis, 0);
    const high = getPreviewClippingPlane(scene.bounds, axis, 100);
    const center = scene.bounds.getCenter(new THREE.Vector3());
    assert.ok(low.distanceToPoint(center) < 0);
    assert.ok(high.distanceToPoint(center) > 0);
    const half = getPreviewClippingPlane(scene.bounds, axis, 50);
    const inverted = getPreviewClippingPlane(scene.bounds, axis, 50, true);
    assert.ok(Math.abs(half.distanceToPoint(center)) < 1e-10);
    assert.ok(half.normal.clone().negate().equals(inverted.normal));
    assert.equal(half.constant, -inverted.constant);
  }
  scene.dispose();
});

test('portrait viewport camera backs away enough to frame the full model, and top view has a valid up vector', () => {
  const scene = createPreviewScene(null, fixture().group);
  const wide = getPreviewCamera(scene.bounds, 'front', 1.5);
  const portrait = getPreviewCamera(scene.bounds, 'front', 0.5);
  assert.ok(portrait.position.distanceTo(portrait.target) > wide.position.distanceTo(wide.target));
  const top = getPreviewCamera(scene.bounds, 'top', 1);
  assert.equal(top.position.x, top.target.x);
  assert.equal(top.position.z, top.target.z);
  assert.ok(top.position.y > top.target.y);
  assert.equal(top.up.dot(top.position.clone().sub(top.target).normalize()), 0);
  scene.dispose();
});

test('rejects an empty model instead of scaling it by infinity', () => {
  assert.throws(() => createPreviewScene(new THREE.BufferGeometry(), null), /no visible mesh/);
});

test('disposing preview resources does not dispose the loaded source model', () => {
  const { group, geometry, material } = fixture();
  let disposed = false;
  geometry.addEventListener('dispose', () => { disposed = true; });
  material.addEventListener('dispose', () => { disposed = true; });
  const scene = createPreviewScene(null, group);
  scene.setDisplay('clay', null);
  scene.dispose();
  assert.equal(disposed, false);
});


test('STL geometry receives a lit material and retains vertex colors in its default view', () => {
  const geometry = new THREE.BoxGeometry(1, 2, 3);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(0.5), 3));
  const scene = createPreviewScene(geometry, null);
  scene.setDisplay('textured', null);
  const mesh = scene.object.children[0];
  assert.ok(mesh.material.isMeshStandardMaterial);
  assert.equal(mesh.material.vertexColors, true);
  scene.dispose();
  geometry.dispose();
});
