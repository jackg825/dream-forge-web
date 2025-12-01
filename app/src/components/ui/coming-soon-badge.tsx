'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface ComingSoonBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  children?: React.ReactNode;
}

/**
 * ComingSoonBadge - Animated badge for upcoming features
 * Uses amber/orange gradient with pulse animation
 */
export function ComingSoonBadge({
  className,
  size = 'md',
  showIcon = true,
  children,
}: ComingSoonBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        'bg-gradient-to-r from-amber-500/90 to-orange-500/90',
        'text-white shadow-lg shadow-amber-500/25',
        'animate-pulse',
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Sparkles className={iconSizes[size]} />}
      {children}
    </span>
  );
}
