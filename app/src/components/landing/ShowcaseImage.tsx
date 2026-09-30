'use client';

import { preload as preloadResource } from 'react-dom';
import { showcaseImages } from '@/config/showcase-images';
import { cn } from '@/lib/utils';

export type ShowcaseImageKey = keyof typeof showcaseImages;

interface ShowcaseImageProps {
  image: ShowcaseImageKey;
  alt: string;
  sizes: string;
  className?: string;
  preload?: boolean;
  maxWidth?: number;
  draggable?: boolean;
}

export function ShowcaseImage({ image, alt, sizes, className, preload = false, maxWidth, draggable }: ShowcaseImageProps) {
  const asset = showcaseImages[image];
  const variants = maxWidth ? asset.variants.filter(({ width }) => width <= maxWidth) : asset.variants;
  const src = (variants.find((variant) => variant.src === asset.src) ?? variants.at(-1) ?? asset.variants[0]).src;
  const srcSet = variants.map((variant) => `${variant.src} ${variant.width}w`).join(', ');

  if (preload) {
    preloadResource(src, { as: 'image', imageSrcSet: srcSet, imageSizes: sizes, fetchPriority: 'high' });
  }

  return (
    // Static export has no image optimizer; these prebuilt variants need a native srcSet.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      loading={preload ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={preload ? 'high' : undefined}
      sizes={sizes}
      srcSet={srcSet}
      src={src}
      alt={alt}
      width={asset.width}
      height={asset.height}
      draggable={draggable}
      className={cn('absolute inset-0 h-full w-full', className)}
      style={maxWidth ? undefined : { backgroundImage: `url(${asset.blurDataURL})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    />
  );
}
