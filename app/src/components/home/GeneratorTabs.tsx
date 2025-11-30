'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { QuickGenerateTab } from './QuickGenerateTab';
import { AdvancedFlowPreview } from './AdvancedFlowPreview';
import { useQuickGenerate } from '@/hooks/useQuickGenerate';
import { Zap, Sparkles } from 'lucide-react';

interface GeneratorTabsProps {
  onNoCredits: () => void;
  className?: string;
}

/**
 * GeneratorTabs - Container for Quick Generate and Advanced Flow tabs
 * Uses shadcn/ui Tabs with centered layout
 */
export function GeneratorTabs({ onNoCredits, className }: GeneratorTabsProps) {
  const t = useTranslations('home.tabs');

  // Use the custom hook for all Quick Generate state
  const {
    user,
    authLoading,
    credits,
    creditsLoading,
    creditCost,
    uploadedImages,
    handleImagesChange,
    quality,
    setQuality,
    printerType,
    setPrinterType,
    generating,
    generateError,
    canGenerate,
    handleGenerate,
  } = useQuickGenerate();

  // Handle generate with credit check
  const onGenerateClick = async () => {
    if (!user) {
      // Will redirect to auth in handleGenerate
      handleGenerate();
      return;
    }

    if (credits < creditCost) {
      onNoCredits();
      return;
    }

    await handleGenerate();
  };

  return (
    <Tabs defaultValue="quick" className={className}>
      {/* Tab triggers - centered */}
      <div className="flex justify-center mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="quick" className="gap-2">
            <Zap className="h-4 w-4" />
            {t('quick')}
          </TabsTrigger>
          <TabsTrigger value="advanced" className="gap-2">
            <Sparkles className="h-4 w-4" />
            {t('advanced')}
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Quick Generate tab content */}
      <TabsContent value="quick">
        <Card>
          <CardContent className="pt-6">
            <QuickGenerateTab
              user={user}
              authLoading={authLoading}
              credits={credits}
              creditsLoading={creditsLoading}
              creditCost={creditCost}
              uploadedImages={uploadedImages}
              onImagesChange={handleImagesChange}
              quality={quality}
              onQualityChange={setQuality}
              printerType={printerType}
              onPrinterTypeChange={setPrinterType}
              generating={generating}
              generateError={generateError}
              canGenerate={canGenerate}
              onGenerate={onGenerateClick}
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Advanced Flow tab content */}
      <TabsContent value="advanced">
        <AdvancedFlowPreview user={user} />
      </TabsContent>
    </Tabs>
  );
}
