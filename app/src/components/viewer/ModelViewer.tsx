'use client';

import { Suspense, useRef, useEffect, useMemo } from 'react';
import { Canvas, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { ViewMode, DownloadFile } from '@/types';
import {
  orientGeometry,
  applyZUpToYUpRotation,
  alignToGroundPlane,
  type ModelRotation,
} from '@/lib/modelOrientation';

interface ModelViewerProps {
  modelUrl: string;           // Primary model URL (usually STL for download)
  downloadFiles?: DownloadFile[]; // All available files from Rodin
  viewMode?: ViewMode;        // clay | textured | wireframe
  backgroundColor?: string;
  rotation?: ModelRotation;   // User rotation override (degrees)
  autoOrient?: boolean;       // Apply Z-up to Y-up conversion (default: true)
}

// Re-export ModelRotation for convenience
export type { ModelRotation };

/**
 * Find GLB file URL from download files list
 */
function findGlbUrl(downloadFiles?: DownloadFile[]): string | null {
  if (!downloadFiles) return null;
  const glbFile = downloadFiles.find(
    (f) => f.name.endsWith('.glb') || f.name.endsWith('.gltf')
  );
  return glbFile?.url || null;
}

/**
 * GLB Model component - loads model with PBR materials
 */
function GLBModel({
  url,
  viewMode,
  autoOrient = true,
  rotation,
}: {
  url: string;
  viewMode: ViewMode;
  autoOrient?: boolean;
  rotation?: ModelRotation;
}) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  // Clone scene to avoid modifying original
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    if (!groupRef.current) return;

    // Reset transforms before applying new ones
    groupRef.current.position.set(0, 0, 0);
    groupRef.current.rotation.set(0, 0, 0);
    groupRef.current.scale.set(1, 1, 1);

    // Step 1: Apply Z-up to Y-up rotation if enabled
    if (autoOrient) {
      applyZUpToYUpRotation(clonedScene);
    }

    // Update matrix after rotation
    clonedScene.updateMatrixWorld(true);

    // Step 2: Compute bounding box for scaling (after rotation)
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    groupRef.current.scale.setScalar(scale);

    // Step 3: Center the model
    const center = new THREE.Vector3();
    box.getCenter(center);
    groupRef.current.position.copy(center.multiplyScalar(-scale));

    // Update matrix after scale/center
    groupRef.current.updateMatrixWorld(true);

    // Step 4: Align to ground plane
    alignToGroundPlane(groupRef.current, -1);

    // Step 5: Apply user rotation (additive)
    if (rotation) {
      groupRef.current.rotation.x += THREE.MathUtils.degToRad(rotation.x);
      groupRef.current.rotation.y += THREE.MathUtils.degToRad(rotation.y);
      groupRef.current.rotation.z += THREE.MathUtils.degToRad(rotation.z);
    }
  }, [clonedScene, autoOrient, rotation]);

  // Apply view mode to all materials in the scene
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            if (viewMode === 'wireframe') {
              mat.wireframe = true;
              mat.opacity = 1;
            } else if (viewMode === 'clay') {
              // Override to clay material
              mat.wireframe = false;
              mat.map = null;
              mat.normalMap = null;
              mat.roughnessMap = null;
              mat.metalnessMap = null;
              mat.color.set('#808080');
              mat.metalness = 0.2;
              mat.roughness = 0.6;
              mat.needsUpdate = true;
            } else {
              // textured - use original materials
              mat.wireframe = false;
            }
          }
        });
      }
    });
  }, [clonedScene, viewMode]);

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} castShadow receiveShadow />
    </group>
  );
}

/**
 * STL Model component - no textures, applies solid material
 */
function STLModel({
  url,
  viewMode,
  autoOrient = true,
  rotation,
}: {
  url: string;
  viewMode: ViewMode;
  autoOrient?: boolean;
  rotation?: ModelRotation;
}) {
  const geometry = useLoader(STLLoader, url);
  const meshRef = useRef<THREE.Mesh>(null);

  // Clone and orient geometry
  const orientedGeometry = useMemo(() => {
    const cloned = geometry.clone();
    if (autoOrient) {
      orientGeometry(cloned, true);
    } else {
      cloned.computeBoundingBox();
    }
    return cloned;
  }, [geometry, autoOrient]);

  useEffect(() => {
    if (meshRef.current && orientedGeometry) {
      // Reset transforms
      meshRef.current.position.set(0, 0, 0);
      meshRef.current.rotation.set(0, 0, 0);
      meshRef.current.scale.set(1, 1, 1);

      // Get bounding box (already computed after orientation)
      const box = orientedGeometry.boundingBox!;
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;

      meshRef.current.scale.setScalar(scale);

      const center = new THREE.Vector3();
      box.getCenter(center);
      meshRef.current.position.copy(center.multiplyScalar(-scale));

      // Update matrix after scale/center
      meshRef.current.updateMatrixWorld(true);

      // Align to ground plane
      alignToGroundPlane(meshRef.current, -1);

      // Apply user rotation (additive)
      if (rotation) {
        meshRef.current.rotation.x += THREE.MathUtils.degToRad(rotation.x);
        meshRef.current.rotation.y += THREE.MathUtils.degToRad(rotation.y);
        meshRef.current.rotation.z += THREE.MathUtils.degToRad(rotation.z);
      }
    }
  }, [orientedGeometry, rotation]);

  const materialProps = useMemo(() => {
    if (viewMode === 'wireframe') {
      return {
        color: '#808080',
        wireframe: true,
      };
    }
    // For STL, clay and textured look the same (no texture data)
    return {
      color: '#808080',
      metalness: 0.2,
      roughness: 0.6,
      wireframe: false,
    };
  }, [viewMode]);

  return (
    <mesh ref={meshRef} geometry={orientedGeometry} castShadow receiveShadow>
      <meshStandardMaterial
        {...materialProps}
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
 * - STL and GLB model loading with Suspense
 * - View modes: clay (solid), textured (PBR), wireframe
 * - OrbitControls for rotation/zoom/pan
 * - Studio lighting setup
 * - Configurable background color
 *
 * For textured mode, uses GLB file if available (contains PBR materials).
 * For clay/wireframe modes, can use either format.
 */
export function ModelViewer({
  modelUrl,
  downloadFiles,
  viewMode = 'clay',
  backgroundColor = '#f3f4f6',
  rotation,
  autoOrient = true,
}: ModelViewerProps) {
  // Determine which model to load based on view mode
  const glbUrl = findGlbUrl(downloadFiles);

  // For textured mode, prefer GLB (has materials). Otherwise use primary URL.
  const useGlb = viewMode === 'textured' && glbUrl;
  const effectiveUrl = useGlb ? glbUrl : modelUrl;

  // Determine file type from URL
  const isGlb = effectiveUrl.includes('.glb') || effectiveUrl.includes('.gltf');

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

        {/* Environment for reflections */}
        <Environment preset="studio" />

        {/* Model - use GLB or STL based on availability and view mode */}
        <Suspense fallback={<LoadingSpinner />}>
          {isGlb ? (
            <GLBModel
              url={effectiveUrl}
              viewMode={viewMode}
              autoOrient={autoOrient}
              rotation={rotation}
            />
          ) : (
            <STLModel
              url={effectiveUrl}
              viewMode={viewMode}
              autoOrient={autoOrient}
              rotation={rotation}
            />
          )}
        </Suspense>

        {/* Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={20}
          rotateSpeed={0.5}
          enableDamping={true}
          dampingFactor={0.05}
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
