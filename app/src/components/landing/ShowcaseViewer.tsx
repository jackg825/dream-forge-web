import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ShowcaseViewerProps {
  /** Animated GIF URL */
  src: string;
  /** Alt text for image */
  alt?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ShowcaseViewer - Animated GIF model preview
 *
 * Displays an auto-playing animated GIF showing a rotating 3D model.
 * Simple and lightweight - no Three.js/WebGL required.
 */
export function ShowcaseViewer({
  src,
  alt = '3D Model Preview',
  className,
}: ShowcaseViewerProps) {
  return (
    <div className={cn('relative w-full h-full overflow-hidden', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain"
        sizes="(max-width: 768px) 100vw, 50vw"
        unoptimized // Required for GIF animation
        priority
      />
    </div>
  );
}
