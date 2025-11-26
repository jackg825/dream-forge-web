'use client';

import { Suspense, useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Center } from '@react-three/drei';
import * as THREE from 'three';

interface ModelViewerProps {
  modelUrl: string;
  backgroundColor?: string;
}

/**
 * Inner component that renders the 3D model
 */
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const modelRef = useRef<THREE.Group>(null);

  useEffect(() => {
    // Center and scale the model
    if (modelRef.current) {
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim; // Fit model to ~2 units

      modelRef.current.scale.setScalar(scale);

      // Center the model
      const center = box.getCenter(new THREE.Vector3());
      modelRef.current.position.sub(center.multiplyScalar(scale));
    }
  }, [scene]);

  return (
    <group ref={modelRef}>
      <primitive object={scene.clone()} />
    </group>
  );
}

/**
 * Loading spinner for Suspense fallback
 */
function LoadingSpinner() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#6366f1" wireframe />
    </mesh>
  );
}

/**
 * Camera setup component
 */
function CameraSetup() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(3, 2, 3);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return null;
}

/**
 * 3D Model Viewer Component
 *
 * Features:
 * - GLB model loading with Suspense
 * - OrbitControls for rotation/zoom/pan
 * - Studio lighting setup
 * - Configurable background color
 */
export function ModelViewer({ modelUrl, backgroundColor = '#f3f4f6' }: ModelViewerProps) {
  return (
    <div className="w-full h-full min-h-[400px] rounded-lg overflow-hidden">
      <Canvas
        shadows
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ background: backgroundColor }}
      >
        <CameraSetup />

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[5, 5, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-5, 5, -5]} intensity={0.5} />

        {/* Environment for reflections (optional) */}
        <Environment preset="studio" />

        {/* Model */}
        <Suspense fallback={<LoadingSpinner />}>
          <Center>
            <Model url={modelUrl} />
          </Center>
        </Suspense>

        {/* Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={20}
          makeDefault
        />

        {/* Ground plane for shadows */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <shadowMaterial opacity={0.2} />
        </mesh>
      </Canvas>
    </div>
  );
}

// Preload function for better UX
ModelViewer.preload = (url: string) => {
  useGLTF.preload(url);
};
