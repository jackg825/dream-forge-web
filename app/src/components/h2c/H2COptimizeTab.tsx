'use client';

import { useH2COptimize } from '@/hooks/useH2COptimize';
import { CreditBadge } from '@/components/credits/CreditBadge';
import { H2CUploadStep } from './H2CUploadStep';
import { H2COptimizeStep } from './H2COptimizeStep';
import { H2CGenerateStep } from './H2CGenerateStep';
import { H2C_STEP_LABELS } from '@/types';
import type { H2CStep } from '@/types';

interface H2COptimizeTabProps {
  onNoCredits?: () => void;
}

/**
 * Step indicator component
 */
function StepIndicator({ currentStep }: { currentStep: H2CStep }) {
  const steps: H2CStep[] = ['upload', 'optimize', 'generate'];
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;

        return (
          <div key={step} className="flex items-center">
            {/* Step circle */}
            <div
              className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                transition-colors duration-200
                ${isActive ? 'bg-primary text-primary-foreground' : ''}
                ${isCompleted ? 'bg-primary/20 text-primary' : ''}
                ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
              `}
            >
              {isCompleted ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </div>

            {/* Step label */}
            <span
              className={`
                ml-2 text-sm hidden sm:inline
                ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}
              `}
            >
              {H2C_STEP_LABELS[step]}
            </span>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`
                  w-8 sm:w-12 h-0.5 mx-2 sm:mx-4
                  ${isCompleted ? 'bg-primary' : 'bg-muted'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Main H2C Optimize Tab component
 * Provides the complete H2C 7-color optimization workflow
 */
export function H2COptimizeTab({ onNoCredits }: H2COptimizeTabProps) {
  const h2c = useH2COptimize();

  // Handle credits check
  const handleOptimize = async () => {
    if (h2c.credits < 1) {
      onNoCredits?.();
      return false;
    }
    return h2c.optimizeColors();
  };

  const handleGenerate = async () => {
    if (h2c.credits < 1) {
      onNoCredits?.();
      return null;
    }
    return h2c.generate3D();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold">H2C 七色優化</h2>
        <p className="text-sm text-muted-foreground mt-1">
          專為拓竹 H2C 七色打印機設計的圖片優化流程
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={h2c.state.step} />

      {/* Credit Badge */}
      <div className="flex justify-center">
        <CreditBadge credits={h2c.credits} loading={h2c.creditsLoading} />
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {h2c.state.step === 'upload' && (
          <H2CUploadStep
            originalImage={h2c.state.originalImage}
            uploadProgress={h2c.state.uploadProgress}
            uploadError={h2c.state.uploadError}
            onUpload={h2c.uploadOriginal}
            onNext={handleOptimize}
            canOptimize={h2c.canOptimize}
            credits={h2c.credits}
          />
        )}

        {h2c.state.step === 'optimize' && (
          <H2COptimizeStep
            status={h2c.state.optimizeStatus}
            originalUrl={h2c.state.originalImage.url}
            optimizedUrl={h2c.state.optimizedImage.url}
            colorPalette={h2c.state.colorPalette}
            error={h2c.state.optimizeError}
            onReOptimize={h2c.reOptimize}
            onDownload={h2c.downloadOptimized}
            onUploadEdited={h2c.uploadEditedImage}
            onConfirm={h2c.goToGenerate}
            onBack={h2c.goToUpload}
            credits={h2c.credits}
          />
        )}

        {h2c.state.step === 'generate' && (
          <H2CGenerateStep
            optimizedImageUrl={h2c.state.optimizedImage.url}
            provider={h2c.state.provider}
            quality={h2c.state.quality}
            onProviderChange={h2c.setProvider}
            onQualityChange={h2c.setQuality}
            onGenerate={handleGenerate}
            onBack={h2c.goToOptimize}
            credits={h2c.credits}
            generating={h2c.state.generating}
          />
        )}
      </div>
    </div>
  );
}
