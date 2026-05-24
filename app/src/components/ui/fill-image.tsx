'use client';

import Image, { type ImageProps } from 'next/image';

type FillImageProps = Omit<ImageProps, 'fill' | 'width' | 'height'> & {
  sizes?: string;
};

export function FillImage({
  alt,
  sizes = '100vw',
  unoptimized = true,
  ...props
}: FillImageProps) {
  return <Image {...props} alt={alt} fill sizes={sizes} unoptimized={unoptimized} />;
}
