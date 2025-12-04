'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { NavItem } from './NavItem';
import { isActivePath, type NavItem as NavItemType } from './NavConfig';

interface DesktopNavProps {
  items: NavItemType[];
  className?: string;
}

export function DesktopNav({ items, className }: DesktopNavProps) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <nav className={cn('hidden md:flex flex-1 items-center gap-1', className)}>
      {items.map((item) => (
        <NavItem
          key={item.href}
          href={item.href}
          label={t(item.labelKey)}
          icon={item.icon}
          isActive={isActivePath(pathname, item.href)}
          variant="desktop"
        />
      ))}
    </nav>
  );
}
