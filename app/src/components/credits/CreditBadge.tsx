'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreditBadgeProps {
  credits: number;
  loading?: boolean;
  showLabel?: boolean;
}

export function CreditBadge({ credits, loading, showLabel = true }: CreditBadgeProps) {
  const t = useTranslations('home');
  const isLow = credits > 0 && credits < 2;
  const isEmpty = credits === 0;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 px-3 py-1.5',
        isEmpty && 'bg-destructive/10 text-destructive border-destructive/30',
        isLow && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
        !isEmpty && !isLow && 'bg-primary/10 text-primary border-primary/30'
      )}
    >
      <Coins className="h-3.5 w-3.5" />
      {loading ? (
        <span className="animate-pulse">...</span>
      ) : (
        <>
          <span className="font-bold">{credits}</span>
          {showLabel && <span className="text-xs opacity-75">{credits === 1 ? t('credit') : t('credits')}</span>}
        </>
      )}
    </Badge>
  );
}
