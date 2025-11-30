'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles } from 'lucide-react';

interface GenerateButtonProps {
  onClick: () => void;
  disabled: boolean;
  generating: boolean;
  creditCost: number;
  error?: string | null;
  className?: string;
}

/**
 * GenerateButton - Primary action button for 3D model generation
 * Shows credit cost, loading state, and error messages
 */
export function GenerateButton({
  onClick,
  disabled,
  generating,
  creditCost,
  error,
  className,
}: GenerateButtonProps) {
  const t = useTranslations('home');

  return (
    <div className={className}>
      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Generate button */}
      <Button
        onClick={onClick}
        disabled={disabled}
        size="lg"
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg transition-all hover:shadow-xl"
      >
        {generating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('startingGeneration')}
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            {t('generateButton')}
            <Badge variant="secondary" className="ml-2">
              {creditCost} {creditCost > 1 ? t('credits') : t('credit')}
            </Badge>
          </>
        )}
      </Button>
    </div>
  );
}
