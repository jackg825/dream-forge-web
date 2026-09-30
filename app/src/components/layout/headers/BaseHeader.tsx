'use client';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Box } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BaseHeaderProps {
  /** Content before the logo (e.g., mobile menu trigger) */
  leftSlot?: React.ReactNode;
  /** Content after the logo (e.g., navigation tabs) */
  centerSlot?: React.ReactNode;
  /** Content on the right (e.g., user menu, badges) */
  rightSlot?: React.ReactNode;
  /** Show admin badge next to logo */
  showAdminBadge?: boolean;
  /** Admin badge text */
  adminBadgeText?: string;
  /** Additional class names */
  className?: string;
}

export function BaseHeader({
  leftSlot,
  centerSlot,
  rightSlot,
  showAdminBadge = false,
  adminBadgeText = 'Admin',
  className,
}: BaseHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-border/40',
        'bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80',
        className
      )}
    >
      <div className="flex h-14 max-w-[1184px] items-center mx-auto px-5 sm:px-8">
        {/* Left slot (mobile menu trigger) */}
        {leftSlot}

        {/* Logo */}
        <Link
          href="/"
          className="mr-4 md:mr-6 flex items-center gap-2"
          aria-label="Dream Forge"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
            <Box className="h-5 w-5 text-background" />
          </div>
          <span className="font-semibold tracking-tight text-sm sm:text-base">DreamForge</span>
          {showAdminBadge && (
            <Badge variant="destructive" className="hidden sm:inline-flex text-xs">
              {adminBadgeText}
            </Badge>
          )}
        </Link>

        {/* Center slot (navigation) */}
        {centerSlot}

        {/* Spacer for mobile (pushes right content to edge) */}
        <div className="flex-1 md:hidden" />

        {/* Right slot (user menu, credits, etc.) */}
        <div className="flex items-center gap-2">
          {rightSlot}
        </div>
      </div>
    </header>
  );
}
