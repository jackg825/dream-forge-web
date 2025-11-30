'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QuickGenerateTab } from './QuickGenerateTab';
import { AdvancedFlowPreview } from './AdvancedFlowPreview';
import { H2COptimizeTab } from '@/components/h2c';
import { PipelineFlow } from '@/components/generate';
import { useQuickGenerate } from '@/hooks/useQuickGenerate';
import { Zap, Sparkles, Palette, Wand2 } from 'lucide-react';

// Feature flag for legacy modes
const LEGACY_DISABLED = true;

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
    provider,
    setProvider,
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
    <Tabs defaultValue="pipeline" className={className}>
      {/* Tab triggers - centered */}
      <div className="flex justify-center mb-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          {/* New Pipeline tab - default */}
          <TabsTrigger value="pipeline" className="gap-2">
            <Wand2 className="h-4 w-4" />
            新流程
            <Badge variant="default" className="ml-1 text-xs">推薦</Badge>
          </TabsTrigger>

          {/* Legacy tabs - disabled */}
          <TabsTrigger value="quick" className="gap-2" disabled={LEGACY_DISABLED}>
            <Zap className="h-4 w-4" />
            {t('quick')}
          </TabsTrigger>
          <TabsTrigger value="h2c" className="gap-2" disabled={LEGACY_DISABLED}>
            <Palette className="h-4 w-4" />
            {t('h2c')}
          </TabsTrigger>
          <TabsTrigger value="advanced" className="gap-2" disabled={LEGACY_DISABLED}>
            <Sparkles className="h-4 w-4" />
            {t('advanced')}
          </TabsTrigger>
        </TabsList>
      </div>

      {/* New Pipeline Flow - Default */}
      <TabsContent value="pipeline">
        <PipelineFlow onNoCredits={onNoCredits} />
      </TabsContent>

      {/* Quick Generate tab content (legacy) */}
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
              provider={provider}
              onProviderChange={setProvider}
              generating={generating}
              generateError={generateError}
              canGenerate={canGenerate}
              onGenerate={onGenerateClick}
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* H2C 7-Color Optimization tab content (legacy) */}
      <TabsContent value="h2c">
        <Card>
          <CardContent className="pt-6">
            <H2COptimizeTab onNoCredits={onNoCredits} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Advanced Flow tab content (legacy) */}
      <TabsContent value="advanced">
        <AdvancedFlowPreview user={user} />
      </TabsContent>
    </Tabs>
  );
}
