'use client';

import { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, Center } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

interface ModelViewerProps {
  modelUrl: string;
  backgroundColor?: string;
}

/**
 * Inner component that renders the STL model
 * STL files don't contain materials, so we apply a default material
 */
function STLModel({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    // Center and scale the model
    if (meshRef.current && geometry) {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim; // Fit model to ~2 units

      meshRef.current.scale.setScalar(scale);

      // Center the model
      const center = new THREE.Vector3();
      box.getCenter(center);
      meshRef.current.position.copy(center.multiplyScalar(-scale));
    }
  }, [geometry]);

  // Default material for STL (no textures)
  // Using a neutral gray with slight metallic look for 3D printing preview
  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#808080"
        metalness={0.2}
        roughness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
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

        {/* STL Model */}
        <Suspense fallback={<LoadingSpinner />}>
          <Center>
            <STLModel url={modelUrl} />
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

// Note: STLLoader doesn't have a preload function like useGLTF
// The model will load when the component mounts
