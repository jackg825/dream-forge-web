'use client';

import { Suspense, useRef, useEffect, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Center, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { ClippingAxis } from './ClippingPlaneControls';

interface PreviewViewerProps {
  geometry: THREE.BufferGeometry | null;
  group: THREE.Group | null;
  backgroundColor?: string;
  clippingEnabled?: boolean;
  clippingAxis?: ClippingAxis;
  clippingPosition?: number; // 0-100
  clippingInverted?: boolean;
  boundingBox?: { width: number; height: number; depth: number };
}

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
}: {
  geometry: THREE.BufferGeometry;
  clippingPlane: THREE.Plane | null;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => {
    // Center and scale the model
    if (meshRef.current && geometry) {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;

      meshRef.current.scale.setScalar(scale);

      const center = new THREE.Vector3();
      box.getCenter(center);
      meshRef.current.position.copy(center.multiplyScalar(-scale));
    }
  }, [geometry]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.clippingPlanes = clippingPlane ? [clippingPlane] : [];
      materialRef.current.needsUpdate = true;
    }
  }, [clippingPlane]);

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
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
}: {
  group: THREE.Group;
  clippingPlane: THREE.Plane | null;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (groupRef.current && group) {
      // Compute overall bounding box and scale
      const box = new THREE.Box3().setFromObject(group);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;

      groupRef.current.scale.setScalar(scale);

      const center = new THREE.Vector3();
      box.getCenter(center);
      groupRef.current.position.copy(center.multiplyScalar(-scale));
    }
  }, [group]);

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

  return <primitive ref={groupRef} object={group.clone()} />;
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
          <Center>
            {geometry && !group && (
              <GeometryModel geometry={geometry} clippingPlane={clippingPlane} />
            )}
            {group && <GroupModel group={group} clippingPlane={clippingPlane} />}
          </Center>
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
