'use client';

import { cn } from '@/lib/utils';

interface FloatingShapesProps {
  className?: string;
}

/**
 * FloatingShapes - Decorative animated geometric shapes
 * Adds playful visual interest to the hero section
 */
export function FloatingShapes({ className }: FloatingShapesProps) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {/* Large violet circle - top left */}
      <div
        className="absolute -top-20 -left-20 w-64 h-64 rounded-full opacity-60 animate-float blur-xl"
        style={{ background: 'var(--accent-violet)' }}
      />

      {/* Mint blob - top right */}
      <div
        className="absolute top-20 -right-10 w-48 h-48 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] opacity-50 animate-float-slow blur-lg"
        style={{ background: 'var(--accent-mint)' }}
      />

      {/* Coral circle - bottom left */}
      <div
        className="absolute bottom-40 left-10 w-32 h-32 rounded-full opacity-50 animate-float-reverse blur-md"
        style={{ background: 'var(--accent-coral)' }}
      />

      {/* Yellow dot - center right */}
      <div
        className="absolute top-1/2 right-20 w-20 h-20 rounded-full opacity-60 animate-pulse-glow"
        style={{ background: 'var(--accent-yellow)' }}
      />

      {/* Small violet dot - bottom right */}
      <div
        className="absolute bottom-20 right-1/3 w-16 h-16 rounded-full opacity-40 animate-float"
        style={{ background: 'var(--accent-violet)', animationDelay: '2s' }}
      />

      {/* Geometric triangle shape - left center */}
      <div
        className="absolute top-1/3 left-1/4 w-24 h-24 opacity-30 animate-float-slow"
        style={{
          background: 'var(--accent-mint)',
          clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
          animationDelay: '1s',
        }}
      />

      {/* Diamond shape - right */}
      <div
        className="absolute bottom-1/3 right-1/4 w-16 h-16 opacity-40 animate-float-reverse rotate-45"
        style={{
          background: 'var(--accent-coral)',
          animationDelay: '3s',
        }}
      />
    </div>
  );
}
