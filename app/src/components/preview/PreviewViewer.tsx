'use client';

import { useRef, useEffect, useMemo, type ComponentRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import type { ClippingAxis } from './ClippingPlaneControls';
import type { LightingState } from '@/types/lighting';
import { SceneLighting } from '@/components/viewer/SceneLighting';
import { createPreviewScene, getPreviewClippingPlane, getPreviewCamera, type PreviewCameraView, type PreviewDisplayMode } from '@/lib/preview-scene';

interface PreviewViewerProps {
  geometry: THREE.BufferGeometry | null;
  group: THREE.Group | null;
  backgroundColor?: string;
  clippingEnabled?: boolean;
  clippingAxis?: ClippingAxis;
  clippingPosition?: number;
  clippingInverted?: boolean;
  lighting?: LightingState;
  showGrid?: boolean;
  showAxes?: boolean;
  autoRotate?: boolean;
  cameraView?: PreviewCameraView;
  cameraResetKey?: number;
  viewMode?: PreviewDisplayMode;
}

function setLocalClipping(renderer: THREE.WebGLRenderer, enabled: boolean) {
  renderer.localClippingEnabled = enabled;
}

function PreviewScene({ geometry, group, clippingEnabled = false, clippingAxis = 'y', clippingPosition = 50, clippingInverted = false, cameraView = 'perspective', cameraResetKey = 0, autoRotate = false, viewMode = 'textured' }: PreviewViewerProps) {
  const { gl, camera, size } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const scene = useMemo(() => createPreviewScene(geometry, group), [geometry, group]);
  const plane = useMemo(() => clippingEnabled ? getPreviewClippingPlane(scene.bounds, clippingAxis, clippingPosition, clippingInverted) : null, [scene, clippingEnabled, clippingAxis, clippingPosition, clippingInverted]);

  useEffect(() => () => scene.dispose(), [scene]);
  useEffect(() => {
    setLocalClipping(gl, clippingEnabled);
    scene.setDisplay(viewMode, plane);
    return () => { setLocalClipping(gl, false); };
  }, [gl, scene, clippingEnabled, plane, viewMode]);

  useEffect(() => {
    const pose = getPreviewCamera(scene.bounds, cameraView, size.width / size.height);
    camera.position.copy(pose.position);
    camera.up.copy(pose.up);
    camera.lookAt(pose.target);
    controls.current?.target.copy(pose.target);
    controls.current?.update();
  }, [camera, scene, cameraView, cameraResetKey, size.width, size.height]);

  return (
    <>
      <primitive object={scene.object} dispose={null} />
      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.1} minDistance={0.2} maxDistance={30} autoRotate={autoRotate} autoRotateSpeed={2} />
    </>
  );
}

export function PreviewViewer(props: PreviewViewerProps) {
  const { backgroundColor = '#1f2937', lighting, showGrid = false, showAxes = false } = props;
  return (
    <div className="w-full h-full rounded-lg overflow-hidden">
      <Canvas dpr={[1, 2]} camera={{ fov: 45, near: 0.01, far: 100 }} gl={{ antialias: true, preserveDrawingBuffer: true }} style={{ background: backgroundColor }}>
        <SceneLighting lighting={lighting} />
        <PreviewScene {...props} />
        {showGrid && <Grid position={[0, -1.01, 0]} args={[10, 10]} cellSize={0.5} cellColor="#6b7280" sectionColor="#374151" fadeDistance={10} />}
        {showAxes && <GizmoHelper alignment="top-right" margin={[65, 65]}><GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" /></GizmoHelper>}
      </Canvas>
    </div>
  );
}
