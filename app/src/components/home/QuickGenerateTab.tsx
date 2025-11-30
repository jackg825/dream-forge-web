'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { MultiImageUploader } from '@/components/upload/MultiImageUploader';
import { QualitySelector } from '@/components/upload/QualitySelector';
import { PrinterTypeSelector } from '@/components/upload/PrinterTypeSelector';
import { CreditBadge } from '@/components/credits/CreditBadge';
import { GenerateButton } from './GenerateButton';
import { Upload } from 'lucide-react';
import type { User } from '@/types';
import type {
  UploadedImage,
  InputMode,
  QualityLevel,
  PrinterType,
} from '@/types';

interface QuickGenerateTabProps {
  // Auth
  user: User | null;
  authLoading: boolean;

  // Credits
  credits: number;
  creditsLoading: boolean;
  creditCost: number;

  // Image state
  onImagesChange: (images: UploadedImage[], mode: InputMode) => void;
  uploadedImages: UploadedImage[];

  // Settings
  quality: QualityLevel;
  onQualityChange: (quality: QualityLevel) => void;
  printerType: PrinterType;
  onPrinterTypeChange: (type: PrinterType) => void;

  // Generation
  generating: boolean;
  generateError: string | null;
  canGenerate: boolean;
  onGenerate: () => void;
}

/**
 * QuickGenerateTab - Simplified generation interface
 * Single smart view with all options visible, one-click generate
 */
export function QuickGenerateTab({
  user,
  authLoading,
  credits,
  creditsLoading,
  creditCost,
  onImagesChange,
  uploadedImages,
  quality,
  onQualityChange,
  printerType,
  onPrinterTypeChange,
  generating,
  generateError,
  canGenerate,
  onGenerate,
}: QuickGenerateTabProps) {
  const t = useTranslations();

  const getCreditsRemainingText = () => {
    if (credits === 0) return t('home.creditsRemaining.none');
    if (credits === 1) return t('home.creditsRemaining.one');
    return t('home.creditsRemaining.many', { count: credits });
  };

  return (
    <div className="space-y-6">
      {/* Credit display for logged in users */}
      {user && !authLoading && (
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <CreditBadge credits={credits} loading={creditsLoading} />
            <span className="text-sm text-muted-foreground">
              {getCreditsRemainingText()}
            </span>
          </div>
        </div>
      )}

      {/* Image uploader */}
      <div>
        {user ? (
          <MultiImageUploader
            userId={user.uid}
            onImagesChange={onImagesChange}
          />
        ) : (
          <Link href="/auth">
            <div className="relative rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center cursor-pointer hover:border-muted-foreground/50 bg-muted/50 transition-colors">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-foreground">
                  <span className="text-primary font-medium">{t('common.signIn')}</span>{' '}
                  {t('auth.signInToUpload')}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('auth.newUsersGet3Credits')}
                </p>
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* Options - Always visible (user preference) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <QualitySelector
            value={quality}
            onChange={onQualityChange}
            disabled={uploadedImages.length === 0}
          />
        </div>
        <div>
          <PrinterTypeSelector
            value={printerType}
            onChange={onPrinterTypeChange}
            disabled={uploadedImages.length === 0}
          />
        </div>
      </div>

      {/* Generate button */}
      <GenerateButton
        onClick={onGenerate}
        disabled={!canGenerate}
        generating={generating}
        creditCost={creditCost}
        error={generateError}
      />

      {/* Sign in prompt for unauthenticated users */}
      {!user && (
        <p className="text-center text-sm text-muted-foreground">
          {t('auth.signInToGenerate')}
        </p>
      )}
    </div>
  );
}
