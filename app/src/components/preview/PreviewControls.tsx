'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreviewControlsProps {
  backgroundColor: string;
  onBackgroundChange: (color: string) => void;
  onReset: () => void;
  hasModel: boolean;
}

type BackgroundKey = 'white' | 'gray' | 'dark' | 'black';

const BACKGROUND_OPTIONS: { value: string; key: BackgroundKey; preview: string }[] = [
  { value: '#ffffff', key: 'white', preview: 'bg-white' },
  { value: '#f3f4f6', key: 'gray', preview: 'bg-gray-100' },
  { value: '#1f2937', key: 'dark', preview: 'bg-gray-800' },
  { value: '#000000', key: 'black', preview: 'bg-black' },
];

export function PreviewControls({
  backgroundColor,
  onBackgroundChange,
  onReset,
  hasModel,
}: PreviewControlsProps) {
  const t = useTranslations('controls');

  return (
    <Card className="py-0">
      <CardContent className="flex flex-wrap items-center gap-4 p-5">
        {/* Background Color */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('background')}:</span>
          <div className="flex gap-2">
            {BACKGROUND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onBackgroundChange(option.value)}
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition-colors',
                  option.preview,
                  backgroundColor === option.value
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-muted-foreground'
                )}
                title={t(`backgroundColor.${option.key}`)}
                aria-pressed={backgroundColor === option.value}
                aria-label={t('setBackgroundTo', { color: t(`backgroundColor.${option.key}`) })}
              />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Clear Model */}
        {hasModel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
            {t('clearModel')}
          </Button>
        )}

        {/* Help text */}
        <div className="text-xs leading-relaxed text-muted-foreground sm:ml-auto">
          {t('helpText')}
        </div>
      </CardContent>
    </Card>
  );
}
