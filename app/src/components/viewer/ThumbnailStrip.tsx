'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ThumbnailImage {
  url: string;
  label: string;
  angle?: 'front' | 'back' | 'left' | 'right';
}

interface ThumbnailStripProps {
  /** Array of thumbnail images to display */
  images: ThumbnailImage[];
  /** Currently selected thumbnail index */
  selectedIndex?: number;
  /** Callback when thumbnail is clicked */
  onSelect?: (index: number) => void;
  /** Orientation of the strip */
  orientation?: 'horizontal' | 'vertical';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show labels below thumbnails */
  showLabels?: boolean;
  /** Custom class name */
  className?: string;
}

const SIZE_MAP = {
  sm: { thumb: 48, container: 'w-12 h-12' },
  md: { thumb: 64, container: 'w-16 h-16' },
  lg: { thumb: 80, container: 'w-20 h-20' },
};

/**
 * ThumbnailStrip - Display a row/column of image thumbnails
 *
 * Used for:
 * - Viewer page: Show pipeline multi-view images
 * - Preview page: Show captured view thumbnails
 *
 * @example
 * ```tsx
 * <ThumbnailStrip
 *   images={[
 *     { url: frontUrl, label: '正面', angle: 'front' },
 *     { url: backUrl, label: '背面', angle: 'back' },
 *   ]}
 *   selectedIndex={0}
 *   onSelect={(i) => setSelectedIndex(i)}
 * />
 * ```
 */
export function ThumbnailStrip({
  images,
  selectedIndex,
  onSelect,
  orientation = 'horizontal',
  size = 'md',
  showLabels = true,
  className,
}: ThumbnailStripProps) {
  const [loadErrors, setLoadErrors] = useState<Set<number>>(new Set());
  const { thumb, container } = SIZE_MAP[size];

  const handleImageError = (index: number) => {
    setLoadErrors((prev) => new Set(prev).add(index));
  };

  if (images.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex gap-2',
        orientation === 'vertical' ? 'flex-col' : 'flex-row',
        className
      )}
    >
      {images.map((image, index) => {
        const isSelected = selectedIndex === index;
        const hasError = loadErrors.has(index);

        return (
          <button
            key={`${image.url}-${index}`}
            onClick={() => onSelect?.(index)}
            className={cn(
              'group relative flex-shrink-0 rounded-lg overflow-hidden',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-black',
              container,
              isSelected
                ? 'ring-2 ring-indigo-400 scale-105'
                : 'ring-1 ring-white/20 hover:ring-white/40 hover:scale-102',
              onSelect ? 'cursor-pointer' : 'cursor-default'
            )}
          >
            {/* Image */}
            {hasError ? (
              <div className="w-full h-full flex items-center justify-center bg-white/5">
                <ImageOff className="w-5 h-5 text-white/30" />
              </div>
            ) : (
              <Image
                src={image.url}
                alt={image.label}
                width={thumb}
                height={thumb}
                className="object-cover w-full h-full"
                onError={() => handleImageError(index)}
              />
            )}

            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              </div>
            )}

            {/* Hover overlay */}
            {!isSelected && onSelect && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            )}

            {/* Label */}
            {showLabels && (
              <div
                className={cn(
                  'absolute bottom-0 left-0 right-0 px-1 py-0.5',
                  'bg-gradient-to-t from-black/60 to-transparent',
                  'text-[10px] text-white/80 text-center truncate'
                )}
              >
                {image.label}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * ThumbnailStripSkeleton - Loading state for ThumbnailStrip
 */
export function ThumbnailStripSkeleton({
  count = 4,
  orientation = 'horizontal',
  size = 'md',
  className,
}: {
  count?: number;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { container } = SIZE_MAP[size];

  return (
    <div
      className={cn(
        'flex gap-2',
        orientation === 'vertical' ? 'flex-col' : 'flex-row',
        className
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'rounded-lg bg-white/5 animate-pulse',
            container
          )}
        />
      ))}
    </div>
  );
}
