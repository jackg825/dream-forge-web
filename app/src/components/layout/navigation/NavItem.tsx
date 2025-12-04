'use client';

import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { ChevronRight, type LucideIcon } from 'lucide-react';

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive?: boolean;
  variant?: 'desktop' | 'mobile';
  showChevron?: boolean;
  onClick?: () => void;
  className?: string;
}

export function NavItem({
  href,
  label,
  icon: Icon,
  isActive = false,
  variant = 'desktop',
  showChevron = false,
  onClick,
  className,
}: NavItemProps) {
  const router = useRouter();

  // Handle nav click - reset to base path when clicking on active parent route
  const handleClick = (e: React.MouseEvent) => {
    if (href === '/generate' && window.location.pathname.includes('/generate/')) {
      e.preventDefault();
      router.push('/generate');
    }
    onClick?.();
  };

  if (variant === 'mobile') {
    return (
      <Link
        href={href}
        onClick={handleClick}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors',
          'min-h-[48px]',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
          className
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span>{label}</span>
        {showChevron && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
      </Link>
    );
  }

  // Desktop variant
  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}
