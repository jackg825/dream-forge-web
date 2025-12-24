'use client';

/**
 * UpgradePrompt Component
 *
 * Modal dialog prompting users to upgrade to Premium tier.
 * Displays Premium features and contact information for upgrade.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Zap, Sparkles, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface UpgradePromptProps {
  open: boolean;
  onClose: () => void;
  feature?: string;
}

export function UpgradePrompt({ open, onClose, feature }: UpgradePromptProps) {
  const t = useTranslations('upgrade');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {feature
              ? t('descriptionWithFeature', { feature })
              : t('descriptionGeneric')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-4">
            <h4 className="font-medium mb-3">{t('featuresTitle')}</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    {t('features.geminiPro.title')}
                  </div>
                  <div className="text-xs">
                    {t('features.geminiPro.description')}
                  </div>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Layers className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    {t('features.providers.title')}
                  </div>
                  <div className="text-xs">
                    {t('features.providers.description')}
                  </div>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    {t('features.hitem3dHires.title')}
                  </div>
                  <div className="text-xs">
                    {t('features.hitem3dHires.description')}
                  </div>
                </div>
              </li>
            </ul>
          </div>

          <Button className="w-full" onClick={onClose}>
            {t('contactAdmin')}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            {t('contactNote')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
