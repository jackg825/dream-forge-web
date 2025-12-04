'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { NavItem } from './NavItem';
import { isActivePath, type NavItem as NavItemConfig } from './NavConfig';

interface NavSectionProps {
  title: string;
  items: NavItemConfig[];
  defaultOpen?: boolean;
  onItemClick?: () => void;
}

export function NavSection({
  title,
  items,
  defaultOpen = false,
  onItemClick,
}: NavSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold',
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          'min-h-[48px] transition-colors'
        )}
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pl-2">
        {items.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={t(item.labelKey)}
            icon={item.icon}
            isActive={isActivePath(pathname, item.href)}
            variant="mobile"
            showChevron
            onClick={onItemClick}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
