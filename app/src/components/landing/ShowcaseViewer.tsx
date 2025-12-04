'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ShowcaseViewerProps {
  /** Static preview image URL (WebP/PNG, first frame of animation) */
  previewImage: string;
  /** Animated GIF URL for hover state */
  animatedImage: string;
  /** Alt text for images */
  alt?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ShowcaseViewer - Animated model preview component
 *
 * Displays a static preview image by default.
 * On hover, switches to an animated GIF showing the model rotating.
 *
 * This approach is lighter than loading actual 3D models:
 * - No Three.js/WebGL required
 * - Works on all devices
 * - Smaller file sizes (~200-500KB for GIF)
 * - Instant perceived loading
 */
export function ShowcaseViewer({
  previewImage,
  animatedImage,
  alt = '3D Model Preview',
  className,
}: ShowcaseViewerProps) {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div
      className={cn('relative w-full h-full overflow-hidden', className)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Static preview image */}
      <Image
        src={previewImage}
        alt={alt}
        fill
        className={cn(
          'object-contain transition-opacity duration-300',
          isHovering ? 'opacity-0' : 'opacity-100'
        )}
        sizes="(max-width: 768px) 100vw, 50vw"
        priority
      />

      {/* Animated GIF - preloaded, shown on hover */}
      <Image
        src={animatedImage}
        alt={alt}
        fill
        className={cn(
          'object-contain transition-opacity duration-300',
          isHovering ? 'opacity-100' : 'opacity-0'
        )}
        sizes="(max-width: 768px) 100vw, 50vw"
        unoptimized // Required for GIF animation to work
      />
    </div>
  );
}
