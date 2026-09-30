'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Coins } from 'lucide-react';

interface NoCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NoCreditsModal({ isOpen, onClose }: NoCreditsModalProps) {
  const t = useTranslations('credits');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/35 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <Card className="relative w-full max-w-md rounded-[28px] border-border/50 px-2 py-8 shadow-2xl">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-4 top-4 h-8 w-8 rounded-full bg-muted"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </Button>

          <CardHeader className="px-7 pt-4 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Coins className="h-7 w-7 text-foreground" />
            </div>
            <CardTitle className="text-[26px] font-semibold tracking-tight">{t('noCreditsTitle')}</CardTitle>
          </CardHeader>

          <CardContent className="px-7 text-center">
            <p className="mb-6 text-[15px] leading-relaxed text-muted-foreground">
              {t('noCreditsDescription')}
            </p>

            {/* Coming soon notice */}
            <div className="rounded-2xl bg-background p-5">
              <p className="text-sm text-muted-foreground">
                {t('contactAdmin')}
              </p>
            </div>
          </CardContent>

          <CardFooter className="px-7">
            <Button onClick={onClose} className="h-11 w-full rounded-full">
              {t('close')}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
