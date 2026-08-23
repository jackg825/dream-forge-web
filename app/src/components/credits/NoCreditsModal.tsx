'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Coins } from 'lucide-react';

interface NoCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NoCreditsModal({ isOpen, onClose }: NoCreditsModalProps) {
  const t = useTranslations('credits');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader className="items-center text-center">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
            <Coins className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <DialogTitle>{t('noCreditsTitle')}</DialogTitle>
          <DialogDescription>{t('noCreditsDescription')}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          {t('contactAdmin')}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
