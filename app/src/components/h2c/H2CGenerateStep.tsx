'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { QualitySelector } from '@/components/upload/QualitySelector';
import { ProviderSelector } from '@/components/upload/ProviderSelector';
import type { QualityLevel, ModelProvider } from '@/types';

interface H2CGenerateStepProps {
  optimizedImageUrl: string | null;
  provider: ModelProvider;
  quality: QualityLevel;
  onProviderChange: (provider: ModelProvider) => void;
  onQualityChange: (quality: QualityLevel) => void;
  onGenerate: () => Promise<string | null>;
  onBack: () => void;
  credits: number;
  generating: boolean;
}

/**
 * Step 3: Configure and start 3D model generation
 */
export function H2CGenerateStep({
  optimizedImageUrl,
  provider,
  quality,
  onProviderChange,
  onQualityChange,
  onGenerate,
  onBack,
  credits,
  generating,
}: H2CGenerateStepProps) {
  const canGenerate = optimizedImageUrl && credits >= 1 && !generating;

  return (
    <div className="space-y-6">
      {/* Optimized image preview */}
      {optimizedImageUrl && (
        <div className="max-w-xs mx-auto">
          <p className="text-sm font-medium text-muted-foreground mb-2 text-center">
            優化後圖片
          </p>
          <div className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
            <Image
              src={optimizedImageUrl}
              alt="Optimized image for 3D generation"
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="space-y-4">
        {/* Provider selector */}
        <div>
          <p className="text-sm font-medium mb-2">選擇生成引擎</p>
          <ProviderSelector
            value={provider}
            onChange={onProviderChange}
          />
        </div>

        {/* Quality selector */}
        <div>
          <p className="text-sm font-medium mb-2">選擇品質</p>
          <QualitySelector
            value={quality}
            onChange={onQualityChange}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <Button variant="outline" onClick={onBack} disabled={generating}>
          返回優化
        </Button>

        <Button
          onClick={onGenerate}
          disabled={!canGenerate}
          size="lg"
          className="min-w-[200px]"
        >
          {generating ? (
            <>
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              生成中...
            </>
          ) : credits < 1 ? (
            '點數不足'
          ) : (
            <>生成 3D 模型 (1 點)</>
          )}
        </Button>
      </div>

      {/* Help text */}
      <p className="text-center text-sm text-muted-foreground">
        生成完成後將自動跳轉到 3D 預覽頁面
      </p>
    </div>
  );
}
