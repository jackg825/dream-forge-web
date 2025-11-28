'use client';

import { Suspense, useRef, useEffect, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { ClippingAxis } from './ClippingPlaneControls';
import {
  orientGeometry,
  applyZUpToYUpRotation,
  alignToGroundPlane,
  type ModelRotation,
} from '@/lib/modelOrientation';

interface PreviewViewerProps {
  geometry: THREE.BufferGeometry | null;
  group: THREE.Group | null;
  backgroundColor?: string;
  clippingEnabled?: boolean;
  clippingAxis?: ClippingAxis;
  clippingPosition?: number; // 0-100
  clippingInverted?: boolean;
  boundingBox?: { width: number; height: number; depth: number };
  rotation?: ModelRotation;   // User rotation override (degrees)
  autoOrient?: boolean;       // Apply Z-up to Y-up conversion (default: true)
}

// Re-export ModelRotation for convenience
export type { ModelRotation };

// Plane normals for each axis
const PLANE_NORMALS: Record<ClippingAxis, THREE.Vector3> = {
  x: new THREE.Vector3(-1, 0, 0),
  y: new THREE.Vector3(0, -1, 0),
  z: new THREE.Vector3(0, 0, -1),
};

/**
 * Enable local clipping on the renderer
 */
function ClippingSetup({ enabled }: { enabled: boolean }) {
  const { gl } = useThree();

  useEffect(() => {
    gl.localClippingEnabled = enabled;
    return () => {
      gl.localClippingEnabled = false;
    };
  }, [gl, enabled]);

  return null;
}

/**
 * Model component with clipping support for BufferGeometry
 */
function GeometryModel({
  geometry,
  clippingPlane,
  autoOrient = true,
  rotation,
}: {
  geometry: THREE.BufferGeometry;
  clippingPlane: THREE.Plane | null;
  autoOrient?: boolean;
  rotation?: ModelRotation;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

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
    // Center and scale the model
    if (meshRef.current && orientedGeometry) {
      // Reset transforms
      meshRef.current.position.set(0, 0, 0);
      meshRef.current.rotation.set(0, 0, 0);
      meshRef.current.scale.set(1, 1, 1);

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
      alignToGroundPlane(meshRef.current, -1.2);

      // Apply user rotation (additive)
      if (rotation) {
        meshRef.current.rotation.x += THREE.MathUtils.degToRad(rotation.x);
        meshRef.current.rotation.y += THREE.MathUtils.degToRad(rotation.y);
        meshRef.current.rotation.z += THREE.MathUtils.degToRad(rotation.z);
      }
    }
  }, [orientedGeometry, rotation]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.clippingPlanes = clippingPlane ? [clippingPlane] : [];
      materialRef.current.needsUpdate = true;
    }
  }, [clippingPlane]);

  return (
    <mesh ref={meshRef} geometry={orientedGeometry} castShadow receiveShadow>
      <meshStandardMaterial
        ref={materialRef}
        color="#808080"
        metalness={0.2}
        roughness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Model component for THREE.Group (GLB/GLTF/OBJ)
 */
function GroupModel({
  group,
  clippingPlane,
  autoOrient = true,
  rotation,
}: {
  group: THREE.Group;
  clippingPlane: THREE.Plane | null;
  autoOrient?: boolean;
  rotation?: ModelRotation;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Clone the group once
  const clonedGroup = useMemo(() => group.clone(), [group]);

  useEffect(() => {
    if (groupRef.current && clonedGroup) {
      // Reset transforms
      groupRef.current.position.set(0, 0, 0);
      groupRef.current.rotation.set(0, 0, 0);
      groupRef.current.scale.set(1, 1, 1);

      // Step 1: Apply Z-up to Y-up rotation if enabled
      if (autoOrient) {
        applyZUpToYUpRotation(clonedGroup);
      }

      // Update matrix after rotation
      clonedGroup.updateMatrixWorld(true);

      // Step 2: Compute overall bounding box and scale
      const box = new THREE.Box3().setFromObject(clonedGroup);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;

      groupRef.current.scale.setScalar(scale);

      const center = new THREE.Vector3();
      box.getCenter(center);
      groupRef.current.position.copy(center.multiplyScalar(-scale));

      // Update matrix after scale/center
      groupRef.current.updateMatrixWorld(true);

      // Step 3: Align to ground plane
      alignToGroundPlane(groupRef.current, -1.2);

      // Step 4: Apply user rotation (additive)
      if (rotation) {
        groupRef.current.rotation.x += THREE.MathUtils.degToRad(rotation.x);
        groupRef.current.rotation.y += THREE.MathUtils.degToRad(rotation.y);
        groupRef.current.rotation.z += THREE.MathUtils.degToRad(rotation.z);
      }
    }
  }, [clonedGroup, autoOrient, rotation]);

  useEffect(() => {
    // Apply clipping planes to all materials in the group
    if (groupRef.current) {
      groupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          materials.forEach((mat) => {
            if (mat instanceof THREE.Material) {
              mat.clippingPlanes = clippingPlane ? [clippingPlane] : [];
              mat.side = THREE.DoubleSide;
              mat.needsUpdate = true;
            }
          });
        }
      });
    }
  }, [clippingPlane]);

  return <primitive ref={groupRef} object={clonedGroup} />;
}

/**
 * Loading fallback
 */
function LoadingSpinner() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta;
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#6366f1" wireframe />
    </mesh>
  );
}

/**
 * Camera setup
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
 * 3D Preview Viewer Component
 */
export function PreviewViewer({
  geometry,
  group,
  backgroundColor = '#f3f4f6',
  clippingEnabled = false,
  clippingAxis = 'y',
  clippingPosition = 50,
  clippingInverted = false,
  boundingBox,
  rotation,
  autoOrient = true,
}: PreviewViewerProps) {
  // Calculate clipping plane
  const clippingPlane = useMemo(() => {
    if (!clippingEnabled || !boundingBox) return null;

    // Get base normal and invert if needed
    const normal = PLANE_NORMALS[clippingAxis].clone();
    if (clippingInverted) {
      normal.negate(); // Flip the normal direction
    }

    // Calculate the constant based on bounding box and position percentage
    // The model is scaled to fit within ~2 units, centered at origin
    const maxDim = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth);
    const scale = 2 / maxDim;

    // Get the dimension for the selected axis
    const axisDim =
      clippingAxis === 'x'
        ? boundingBox.width
        : clippingAxis === 'y'
        ? boundingBox.height
        : boundingBox.depth;

    const scaledDim = axisDim * scale;
    const halfDim = scaledDim / 2;

    // Map position (0-100) to (-halfDim to +halfDim)
    let planePosition = -halfDim + (clippingPosition / 100) * scaledDim;

    // When inverted, we also need to flip the constant
    if (clippingInverted) {
      planePosition = -planePosition;
    }

    return new THREE.Plane(normal, planePosition);
  }, [clippingEnabled, clippingAxis, clippingPosition, clippingInverted, boundingBox]);

  const hasModel = geometry || group;

  return (
    <div className="w-full h-full min-h-[400px] rounded-lg overflow-hidden">
      <Canvas
        shadows
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ background: backgroundColor }}
      >
        <CameraSetup />
        <ClippingSetup enabled={clippingEnabled} />

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

        {/* Model */}
        <Suspense fallback={<LoadingSpinner />}>
          {geometry && !group && (
            <GeometryModel
              geometry={geometry}
              clippingPlane={clippingPlane}
              autoOrient={autoOrient}
              rotation={rotation}
            />
          )}
          {group && (
            <GroupModel
              group={group}
              clippingPlane={clippingPlane}
              autoOrient={autoOrient}
              rotation={rotation}
            />
          )}
        </Suspense>

        {/* Grid when no model loaded */}
        {!hasModel && (
          <Grid
            args={[10, 10]}
            cellSize={0.5}
            cellThickness={0.5}
            cellColor="#6b7280"
            sectionSize={2}
            sectionThickness={1}
            sectionColor="#374151"
            fadeDistance={10}
            fadeStrength={1}
            followCamera={false}
            infiniteGrid={false}
          />
        )}

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
        {hasModel && (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -1.2, 0]}
            receiveShadow
          >
            <planeGeometry args={[10, 10]} />
            <shadowMaterial opacity={0.2} />
          </mesh>
        )}
      </Canvas>
    </div>
  );
}
