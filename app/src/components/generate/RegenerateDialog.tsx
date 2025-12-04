'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface RegenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewType: 'mesh' | 'texture';
  angle: string;
  onConfirm: (hint?: string) => void;
  loading?: boolean;
}

/**
 * RegenerateDialog - Modal for regenerating a single view with optional hint
 *
 * Allows users to provide additional instructions when regenerating
 * a specific view (mesh or texture) at a specific angle.
 */
export function RegenerateDialog({
  open,
  onOpenChange,
  viewType,
  angle,
  onConfirm,
  loading = false,
}: RegenerateDialogProps) {
  const t = useTranslations();
  const [hint, setHint] = useState('');

  const handleConfirm = () => {
    onConfirm(hint.trim() || undefined);
    setHint('');
  };

  const handleClose = () => {
    setHint('');
    onOpenChange(false);
  };

  const angleLabel = t(`pipeline.angles.${angle}`);
  const typeLabel = t(`selectors.${viewType}`);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('regenerate.dialog.title', { angle: angleLabel, type: typeLabel })}</DialogTitle>
          <DialogDescription>
            {t('regenerate.dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="regenerate-hint">{t('regenerate.dialog.hintLabel')}</Label>
            <Input
              id="regenerate-hint"
              placeholder={t('regenerate.dialog.hintPlaceholder')}
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              maxLength={100}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              {t('regenerate.dialog.charCount', { count: hint.length })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('regenerate.dialog.generating')}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('pipeline.images.regenerate')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
