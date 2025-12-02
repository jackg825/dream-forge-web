'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface CapturedThumbnails {
  front: string;
  back: string;
  left: string;
  right: string;
}

interface ThumbnailCapturerProps {
  /** Trigger thumbnail capture */
  captureRequested: boolean;
  /** Callback when capture completes */
  onCaptureComplete: (thumbnails: CapturedThumbnails) => void;
  /** Model center point for camera targeting */
  targetCenter?: THREE.Vector3;
  /** Distance from model center (default: 5) */
  cameraDistance?: number;
  /** Thumbnail resolution (default: 256) */
  resolution?: number;
}

/**
 * Camera positions for each view (relative to target center)
 * Positions are at eye level (y=1.5) looking at the model
 */
const CAMERA_POSITIONS = {
  front: { x: 0, y: 1.5, z: 1 },   // Looking at front
  back: { x: 0, y: 1.5, z: -1 },   // Looking at back
  left: { x: -1, y: 1.5, z: 0 },   // Looking at left side
  right: { x: 1, y: 1.5, z: 0 },   // Looking at right side
};

const VIEW_LABELS = {
  front: '正面',
  back: '背面',
  left: '左側',
  right: '右側',
};

/**
 * ThumbnailCapturer - Off-screen render component for capturing view thumbnails
 *
 * This component renders the current scene from 4 fixed camera positions
 * and returns base64 data URLs for each captured view.
 *
 * Uses WebGLRenderTarget for efficient off-screen rendering without
 * affecting the main render loop.
 *
 * IMPORTANT: This component must be placed inside a Canvas component.
 *
 * @example
 * ```tsx
 * // Inside Canvas
 * <ThumbnailCapturer
 *   captureRequested={shouldCapture}
 *   onCaptureComplete={(thumbs) => {
 *     setThumbnails(thumbs);
 *     setShouldCapture(false);
 *   }}
 * />
 * ```
 */
export function ThumbnailCapturer({
  captureRequested,
  onCaptureComplete,
  targetCenter = new THREE.Vector3(0, 0, 0),
  cameraDistance = 5,
  resolution = 256,
}: ThumbnailCapturerProps) {
  const { gl, scene } = useThree();
  const renderTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize render target and camera once
  useEffect(() => {
    // Create off-screen render target
    renderTargetRef.current = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });

    // Create dedicated camera for captures
    cameraRef.current = new THREE.PerspectiveCamera(50, 1, 0.1, 100);

    // Create off-screen canvas for pixel extraction
    canvasRef.current = document.createElement('canvas');
    canvasRef.current.width = resolution;
    canvasRef.current.height = resolution;

    return () => {
      renderTargetRef.current?.dispose();
      renderTargetRef.current = null;
      cameraRef.current = null;
      canvasRef.current = null;
    };
  }, [resolution]);

  // Capture a single view
  const captureView = useCallback(
    (viewName: keyof typeof CAMERA_POSITIONS): string | null => {
      if (!renderTargetRef.current || !cameraRef.current || !canvasRef.current) {
        return null;
      }

      const camera = cameraRef.current;
      const renderTarget = renderTargetRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) return null;

      // Position camera
      const pos = CAMERA_POSITIONS[viewName];
      camera.position.set(
        targetCenter.x + pos.x * cameraDistance,
        targetCenter.y + pos.y,
        targetCenter.z + pos.z * cameraDistance
      );
      camera.lookAt(targetCenter);
      camera.updateProjectionMatrix();

      // Save current render target
      const originalTarget = gl.getRenderTarget();

      // Render to off-screen target
      gl.setRenderTarget(renderTarget);
      gl.render(scene, camera);

      // Read pixels
      const pixels = new Uint8Array(resolution * resolution * 4);
      gl.readRenderTargetPixels(renderTarget, 0, 0, resolution, resolution, pixels);

      // Restore original render target
      gl.setRenderTarget(originalTarget);

      // Convert to canvas (flip Y axis as WebGL has inverted Y)
      const imageData = ctx.createImageData(resolution, resolution);
      for (let y = 0; y < resolution; y++) {
        for (let x = 0; x < resolution; x++) {
          const srcIdx = ((resolution - 1 - y) * resolution + x) * 4;
          const dstIdx = (y * resolution + x) * 4;
          imageData.data[dstIdx] = pixels[srcIdx];
          imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
          imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
          imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
        }
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
    },
    [gl, scene, targetCenter, cameraDistance, resolution]
  );

  // Capture all views when requested
  useEffect(() => {
    if (!captureRequested) return;

    // Small delay to ensure model is fully loaded and rendered
    const timeoutId = setTimeout(() => {
      const thumbnails: CapturedThumbnails = {
        front: captureView('front') || '',
        back: captureView('back') || '',
        left: captureView('left') || '',
        right: captureView('right') || '',
      };

      onCaptureComplete(thumbnails);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [captureRequested, captureView, onCaptureComplete]);

  // This component doesn't render anything visible
  return null;
}

/**
 * Helper function to convert captured thumbnails to ThumbnailImage array
 */
export function thumbnailsToImages(thumbnails: CapturedThumbnails | null): Array<{
  url: string;
  label: string;
  angle: 'front' | 'back' | 'left' | 'right';
}> {
  if (!thumbnails) return [];

  return (Object.keys(VIEW_LABELS) as Array<keyof typeof VIEW_LABELS>)
    .filter((key) => thumbnails[key])
    .map((key) => ({
      url: thumbnails[key],
      label: VIEW_LABELS[key],
      angle: key,
    }));
}
