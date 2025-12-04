'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Position3D } from '@/types/lighting';

interface AngleSphereWidgetProps {
  /** Current light position in 3D space */
  position: Position3D;
  /** Callback when position changes via drag */
  onPositionChange: (position: Position3D) => void;
  /** Widget size in pixels (default: 120) */
  size?: number;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * AngleSphereWidget - Interactive sphere for controlling light direction
 *
 * A Canvas2D-based widget that displays a sphere with a draggable
 * light indicator. Users can drag the amber dot to change the
 * spotlight's direction in 3D space.
 *
 * The widget maps 2D mouse positions to 3D spherical coordinates,
 * constraining the light position to the surface of a virtual sphere.
 *
 * @example
 * ```tsx
 * <AngleSphereWidget
 *   position={lighting.spotlight.position}
 *   onPositionChange={updateSpotlightPosition}
 *   size={120}
 * />
 * ```
 */
export function AngleSphereWidget({
  position,
  onPositionChange,
  size = 120,
  disabled = false,
}: AngleSphereWidgetProps) {
  const t = useTranslations('viewer.angleSphere');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Normalize position to unit sphere for display
  const normalizePosition = useCallback((pos: Position3D) => {
    const length = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
    if (length === 0) return { x: 0, y: 1, z: 0 };
    return {
      x: pos.x / length,
      y: pos.y / length,
      z: pos.z / length,
    };
  }, []);

  // Convert 3D position to 2D canvas coordinates
  const positionToCanvas = useCallback(
    (pos: Position3D) => {
      const normalized = normalizePosition(pos);
      const radius = size / 2 - 15; // Leave margin for indicator
      // Project X and Z to canvas (Y is elevation, we use Z-depth for brightness)
      const canvasX = size / 2 + normalized.x * radius;
      const canvasY = size / 2 - normalized.y * radius;
      return { x: canvasX, y: canvasY, depth: normalized.z };
    },
    [size, normalizePosition]
  );

  // Convert 2D canvas coordinates to 3D position on sphere
  const canvasToPosition = useCallback(
    (canvasX: number, canvasY: number, lightRadius: number = 5) => {
      const radius = size / 2 - 15;
      const centerX = size / 2;
      const centerY = size / 2;

      // Normalize to -1 to 1 range
      const normX = (canvasX - centerX) / radius;
      const normY = -(canvasY - centerY) / radius;

      // Clamp to unit circle
      const lenSq = normX * normX + normY * normY;
      let x = normX;
      let y = normY;
      let z = 0;

      if (lenSq > 1) {
        // Outside circle - project to edge
        const len = Math.sqrt(lenSq);
        x = normX / len;
        y = normY / len;
        z = 0;
      } else {
        // Inside circle - calculate Z from sphere surface
        z = Math.sqrt(1 - lenSq);
      }

      // Scale to light radius (default 5 units from origin)
      return {
        x: x * lightRadius,
        y: y * lightRadius,
        z: z * lightRadius,
      };
    },
    [size]
  );

  // Draw the sphere widget
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = size / 2;
    const centerY = size / 2;
    const sphereRadius = size / 2 - 15;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw sphere background with gradient
    const gradient = ctx.createRadialGradient(
      centerX - sphereRadius * 0.3,
      centerY - sphereRadius * 0.3,
      0,
      centerX,
      centerY,
      sphereRadius
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.05)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.02)');

    ctx.beginPath();
    ctx.arc(centerX, centerY, sphereRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw sphere outline
    ctx.beginPath();
    ctx.arc(centerX, centerY, sphereRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw latitude lines (horizontal circles)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      const y = centerY + (sphereRadius * i * 0.33);
      const radiusAtY = Math.sqrt(sphereRadius * sphereRadius - Math.pow(sphereRadius * i * 0.33, 2));
      if (radiusAtY > 0) {
        ctx.beginPath();
        ctx.ellipse(centerX, y, radiusAtY, radiusAtY * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const y2 = centerY - (sphereRadius * i * 0.33);
      if (radiusAtY > 0) {
        ctx.beginPath();
        ctx.ellipse(centerX, y2, radiusAtY, radiusAtY * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Draw longitude line (vertical ellipse)
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, sphereRadius * 0.3, sphereRadius, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Draw center reference point
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();

    // Draw light position indicator
    const { x: lightX, y: lightY, depth } = positionToCanvas(position);

    // Line from center to light position
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(lightX, lightY);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Light indicator glow
    const glowSize = isDragging ? 20 : isHovering ? 16 : 12;
    const glowGradient = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, glowSize);
    glowGradient.addColorStop(0, 'rgba(251, 191, 36, 0.5)');
    glowGradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.2)');
    glowGradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.beginPath();
    ctx.arc(lightX, lightY, glowSize, 0, Math.PI * 2);
    ctx.fillStyle = glowGradient;
    ctx.fill();

    // Light indicator dot
    const dotSize = isDragging ? 10 : isHovering ? 9 : 8;
    // Adjust brightness based on depth (Z position)
    const brightness = 0.7 + depth * 0.3;
    ctx.beginPath();
    ctx.arc(lightX, lightY, dotSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(251, 191, 36, ${brightness})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [size, position, positionToCanvas, isDragging, isHovering]);

  // Redraw on state changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle mouse/touch events
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      e.preventDefault();
      setIsDragging(true);

      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.setPointerCapture(e.pointerId);

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newPosition = canvasToPosition(x, y);
      onPositionChange(newPosition);
    },
    [disabled, canvasToPosition, onPositionChange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if hovering over the light indicator
      const { x: lightX, y: lightY } = positionToCanvas(position);
      const distance = Math.sqrt(Math.pow(x - lightX, 2) + Math.pow(y - lightY, 2));
      setIsHovering(distance < 15);

      if (isDragging && !disabled) {
        const newPosition = canvasToPosition(x, y);
        onPositionChange(newPosition);
      }
    },
    [isDragging, disabled, canvasToPosition, onPositionChange, positionToCanvas, position]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      setIsDragging(false);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(e.pointerId);
      }
    },
    []
  );

  const handlePointerLeave = useCallback(() => {
    setIsHovering(false);
    if (!isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className={`
          rounded-full touch-none
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab'}
          ${isDragging ? 'cursor-grabbing' : ''}
        `}
        style={{ touchAction: 'none' }}
      />
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-white/40 whitespace-nowrap">
        {t('dragToAdjust')}
      </div>
    </div>
  );
}
