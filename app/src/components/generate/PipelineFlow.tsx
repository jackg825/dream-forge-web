'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Upload,
  Images,
  Box,
  Palette,
  CheckCircle,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronRight,
  Printer,
  RotateCcw,
  Eye,
  Wrench,
} from 'lucide-react';
import { ModelViewer, type ModelViewerRef } from '@/components/viewer/ModelViewer';
import { TranslatedModelViewerErrorBoundary } from '@/components/viewer/ModelViewerErrorBoundary';
import { ViewerToolbar } from '@/components/viewer/ViewerToolbar';
import { OptimizePanel } from '@/components/viewer/OptimizePanel';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { usePipeline } from '@/hooks/usePipeline';
import type { ViewMode, StyleId } from '@/types';
import { DEFAULT_STYLE } from '@/types/styles';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { PipelineUploader } from './PipelineUploader';
import { ModeSelector } from './ModeSelector';
import { ProcessingModeSelector } from './ProcessingModeSelector';
import { PrecisionSelector } from './PrecisionSelector';
import { PreviousOutputs } from './PreviousOutputs';
import { RegenerateDialog } from './RegenerateDialog';
import { ResetStepDialog } from './ResetStepDialog';
import { PipelineErrorState } from './PipelineErrorState';
import { PipelineProgressBar } from './PipelineProgressBar';
import type { ResetTargetStep } from '@/hooks/usePipeline';
import { UnifiedProgressIndicator } from './UnifiedProgressIndicator';
import { ImageAnalysisPanel } from './ImageAnalysisPanel';
import { StyleSelector } from './StyleSelector';
import { MultiViewGrid } from './MultiViewGrid';
import { useImageAnalysis } from '@/hooks/useImageAnalysis';
import type {
  PipelineMeshAngle,
  GenerationModeId,
  ProcessingMode,
  MeshPrecision,
  ModelProvider,
  ProviderOptions,
  GeminiModelId,
} from '@/types';
import { downloadFile } from '@/lib/download';
import {
  GENERATION_MODE_OPTIONS,
  DEFAULT_GENERATION_MODE,
  DEFAULT_PROCESSING_MODE,
  DEFAULT_MESH_PRECISION,
  DEFAULT_GEMINI_MODEL,
  MAX_REGENERATIONS,
  PROVIDER_OPTIONS,
  GEMINI_MODEL_OPTIONS,
} from '@/types';
import { ProviderSelector } from './ProviderSelector';

interface PipelineFlowProps {
  onNoCredits: () => void;
}

// Map pipeline status to step (3-step flow - texture step removed)
// Step 1: 準備圖片 (draft → images-ready)
// Step 2: 生成網格 (generating-mesh → completed)
// Step 3: 打印配送 (Coming Soon - no status maps here)
const getStepFromStatus = (status: string | undefined, hasId: boolean): number => {
  if (!hasId) return 1;
  switch (status) {
    case 'draft':
    case 'generating-images':
    case 'batch-queued':
    case 'batch-processing':
    case 'images-ready':
      return 1; // 準備多視角圖片
    case 'generating-mesh':
    case 'mesh-ready':
    case 'generating-texture':
    case 'completed':
      return 2; // 生成 3D 網格 (texture now included)
    default:
      return 1;
  }
};

// Loading fallback for Suspense
function PipelineFlowLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

/**
 * PipelineFlow - Multi-step 3D generation wizard
 *
 * Flow:
 * 1. Upload images
 * 2. Gemini generates 6 views
 * 3. Preview images (can regenerate)
 * 4. Generate mesh (5 credits)
 * 5. Preview mesh
 * 6. Generate texture (10 credits) - optional
 * 7. Complete
 */
export function PipelineFlow({ onNoCredits }: PipelineFlowProps) {
  return (
    <Suspense fallback={<PipelineFlowLoading />}>
      <PipelineFlowInner onNoCredits={onNoCredits} />
    </Suspense>
  );
}

// Inner component that uses useSearchParams
function PipelineFlowInner({ onNoCredits }: PipelineFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pipelineIdParam = searchParams.get('id');
  const locale = useLocale();
  const t = useTranslations('pipeline');
  const tDownload = useTranslations('download');

  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { credits, loading: creditsLoading } = useCredits(user?.uid);

  const [pipelineId, setPipelineId] = useState<string | null>(pipelineIdParam);
  const [uploadedImages, setUploadedImages] = useState<Array<{ url: string; file?: File }>>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [generationMode, setGenerationMode] = useState<GenerationModeId>(DEFAULT_GENERATION_MODE);
  // Batch mode temporarily disabled - force realtime
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('realtime');
  const [meshPrecision, setMeshPrecision] = useState<MeshPrecision>(DEFAULT_MESH_PRECISION);
  const [userDescription, setUserDescription] = useState<string>('');
  const [colorCount, setColorCount] = useState<number>(7);

  // Provider selection state - default to Tripo3D v3.0
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider>('tripo');
  const [providerOptions, setProviderOptions] = useState<ProviderOptions>({});

  // Gemini model selection state
  const [geminiModel, setGeminiModel] = useState<GeminiModelId>(DEFAULT_GEMINI_MODEL);

  // Style selection state - default to chibi, auto-set from AI recommendation
  const [selectedStyle, setSelectedStyle] = useState<StyleId>(DEFAULT_STYLE);

  // Style change flow state - tracks when user wants to change style after analysis
  const [styleChangeRequested, setStyleChangeRequested] = useState(false);

  // Image analysis hook
  const {
    analysis: imageAnalysis,
    loading: analysisLoading,
    error: analysisError,
    analyzeImage,
    setAnalysis,
    updateDescription,
    updateColors,
    addColor,
    removeColor,
    updateColor,
    reset: resetAnalysis,
    hasEdits: analysisHasEdits,
  } = useImageAnalysis();

  // 3D Viewer state - mesh preview (Step 5)
  const meshViewerRef = useRef<ModelViewerRef>(null);
  const meshContainerRef = useRef<HTMLDivElement>(null);
  const [meshViewMode, setMeshViewMode] = useState<ViewMode>('clay');
  const [meshBgColor, setMeshBgColor] = useState('#1f2937');
  const [meshShowGrid, setMeshShowGrid] = useState(true);
  const [meshShowAxes, setMeshShowAxes] = useState(false);
  const [meshAutoRotate, setMeshAutoRotate] = useState(false);
  const [meshFullscreen, setMeshFullscreen] = useState(false);
  const [meshViewModeInitialized, setMeshViewModeInitialized] = useState(false);

  // 3D Viewer state - textured/complete preview (Step 7)
  const texturedViewerRef = useRef<ModelViewerRef>(null);
  const texturedContainerRef = useRef<HTMLDivElement>(null);
  const [texturedViewMode, setTexturedViewMode] = useState<ViewMode>('textured');
  const [texturedBgColor, setTexturedBgColor] = useState('#1f2937');
  const [texturedShowGrid, setTexturedShowGrid] = useState(true);
  const [texturedShowAxes, setTexturedShowAxes] = useState(false);
  const [texturedAutoRotate, setTexturedAutoRotate] = useState(false);
  const [texturedFullscreen, setTexturedFullscreen] = useState(false);

  // Regenerate dialog state
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateTarget, setRegenerateTarget] = useState<{
    viewType: 'mesh' | 'texture';
    angle: string;
  } | null>(null);
  const [regenerateLoading, setRegenerateLoading] = useState(false);

  // Reset step dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTargetStep, setResetTargetStep] = useState<ResetTargetStep | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Download state
  const [downloading, setDownloading] = useState(false);

  // 3D Print Optimization dialog state (Admin only)
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false);

  const {
    pipeline,
    loading: pipelineLoading,
    error,
    createPipeline,
    generateImages,
    submitBatch,
    regenerateImage,
    startMeshGeneration,
    checkStatus,
    startTextureGeneration,
    updateAnalysis,
    resetStep,
    currentStep,
    isBatchProcessing,
  } = usePipeline(pipelineId);

  // Credit costs
  const MESH_COST = 5;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Set initial mesh view mode based on provider capabilities
  useEffect(() => {
    if (!meshViewModeInitialized && pipeline?.settings?.provider) {
      const provider = pipeline.settings.provider;
      if (PROVIDER_OPTIONS[provider]?.capabilities?.texturedMesh) {
        setMeshViewMode('textured');
      }
      setMeshViewModeInitialized(true);
    }
  }, [pipeline?.settings?.provider, meshViewModeInitialized]);

  // Restore analysis when loading a draft pipeline
  useEffect(() => {
    if (pipeline?.status === 'draft' && pipeline.imageAnalysis && !imageAnalysis) {
      // Convert Firestore timestamp to Date if needed
      const analysis = {
        ...pipeline.imageAnalysis,
        analyzedAt: pipeline.imageAnalysis.analyzedAt instanceof Date
          ? pipeline.imageAnalysis.analyzedAt
          : new Date((pipeline.imageAnalysis.analyzedAt as unknown as { seconds: number }).seconds * 1000),
      };
      setAnalysis(analysis);
      // Also restore userDescription if present
      if (pipeline.userDescription) {
        setUserDescription(pipeline.userDescription);
      }
      // Restore uploaded images from pipeline
      if (pipeline.inputImages && pipeline.inputImages.length > 0 && uploadedImages.length === 0) {
        setUploadedImages(pipeline.inputImages.map(img => ({ url: img.url })));
      }
    }
  }, [pipeline, imageAnalysis, setAnalysis, uploadedImages.length]);

  // Note: We no longer auto-select recommended style since user now selects style BEFORE analysis
  // The analysis uses the user's selected style for context-aware generation
  // Keep the recommendedStyle visible in the UI for reference, but don't auto-switch

  // Start polling when generating
  useEffect(() => {
    if (pipeline?.status === 'generating-mesh' || pipeline?.status === 'generating-texture') {
      const interval = setInterval(async () => {
        try {
          await checkStatus();
        } catch (err) {
          console.error('Status check failed:', err);
        }
      }, 3000); // Poll every 3 seconds

      setPollingInterval(interval);

      return () => clearInterval(interval);
    } else {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  }, [pipeline?.status, checkStatus]);

  // Clear actionLoading when pipeline transitions to generating state
  // This ensures smooth button state after Firestore updates
  useEffect(() => {
    const status = pipeline?.status;
    if (status === 'generating-images' || status === 'batch-queued' || status === 'batch-processing') {
      setActionLoading(false);
    }
  }, [pipeline?.status]);

  // Handle image upload and pipeline creation
  const handleStartPipeline = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    if (uploadedImages.length === 0) {
      return;
    }

    setActionLoading(true);
    try {
      // Check if we already have a draft pipeline (from analysis)
      if (pipelineId && pipeline?.status === 'draft') {
        // Update analysis if user made edits
        if (analysisHasEdits && imageAnalysis) {
          await updateAnalysis(imageAnalysis, imageAnalysis.description);
        }

        // Start generation on existing pipeline
        // Keep actionLoading true until Firestore status changes to generating-images
        if (processingMode === 'batch') {
          submitBatch(pipelineId).catch((err) => {
            console.error('Batch submission failed:', err);
            setActionLoading(false);
          });
        } else {
          generateImages(pipelineId).catch((err) => {
            console.error('Image generation failed:', err);
            setActionLoading(false);
          });
        }
        return;
      }

      // Create new pipeline (no prior analysis)
      const imageUrls = uploadedImages.map((img) => img.url);
      const finalDescription = imageAnalysis?.description || userDescription.trim() || undefined;
      const newPipelineId = await createPipeline(
        imageUrls,
        { meshPrecision, colorCount, selectedStyle },
        generationMode,
        processingMode,
        finalDescription,
        imageAnalysis || undefined,
        geminiModel
      );
      setPipelineId(newPipelineId);

      // Update URL with pipeline ID
      router.push(`?id=${newPipelineId}`, { scroll: false });

      // Start image generation based on processing mode
      // Keep actionLoading true until Firestore status changes to generating-images
      if (processingMode === 'batch') {
        submitBatch(newPipelineId).catch((err) => {
          console.error('Batch submission failed:', err);
          setActionLoading(false);
        });
      } else {
        generateImages(newPipelineId).catch((err) => {
          console.error('Image generation failed:', err);
          setActionLoading(false);
        });
      }
    } catch (err) {
      console.error('Failed to create pipeline:', err);
      setActionLoading(false);
    }
  };

  // Handle image analysis - creates draft pipeline after analysis completes
  const handleAnalyze = async () => {
    if (!user || uploadedImages.length === 0) return;

    try {
      // Run analysis with current locale and selected style for context-aware results
      const result = await analyzeImage(uploadedImages[0].url, colorCount, 'fdm', locale, selectedStyle);

      // Reset style change request flag after successful analysis
      setStyleChangeRequested(false);

      // Create draft pipeline with analysis results
      // Use the user's selected style (which was passed to analysis)
      const imageUrls = uploadedImages.map((img) => img.url);
      const newPipelineId = await createPipeline(
        imageUrls,
        { meshPrecision, colorCount, selectedStyle },
        generationMode,
        processingMode,
        result.description,
        result,
        geminiModel
      );

      // Update state and URL so user can return to this draft
      setPipelineId(newPipelineId);
      router.push(`?id=${newPipelineId}`, { scroll: false });
    } catch (err) {
      console.error('Analysis failed:', err);
      // Error is handled by useImageAnalysis hook
    }
  };

  // Handle style change request (when user wants to change style after analysis)
  const handleStyleChangeRequest = () => {
    setStyleChangeRequested(true);
  };

  // Handle style change confirmation - re-analyze with new style
  const handleStyleChangeConfirm = async () => {
    // Clear analysis and re-run with new style
    resetAnalysis();
    setStyleChangeRequested(false);
    // The user will need to click "Analyze" again
  };

  // Handle style change cancel - revert to original style
  const handleStyleChangeCancel = () => {
    // Revert to the style that was used for analysis
    if (imageAnalysis?.analyzedWithStyle) {
      setSelectedStyle(imageAnalysis.analyzedWithStyle);
    }
    setStyleChangeRequested(false);
  };

  // Handle mesh generation with provider selection
  const handleStartMesh = async () => {
    if (credits < MESH_COST) {
      onNoCredits();
      return;
    }

    setActionLoading(true);
    try {
      await startMeshGeneration(selectedProvider, providerOptions);
    } catch (err) {
      console.error('Failed to start mesh generation:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Check if regeneration is allowed (within limit)
  const regenerationsUsed = pipeline?.regenerationsUsed || 0;
  const regenerationsRemaining = MAX_REGENERATIONS - regenerationsUsed;
  const canRegenerate = regenerationsRemaining > 0;

  // Open regenerate dialog
  const openRegenerateDialog = (viewType: 'mesh' | 'texture', angle: string) => {
    if (!canRegenerate) {
      // Limit reached, don't open dialog
      return;
    }
    setRegenerateTarget({ viewType, angle });
    setRegenerateDialogOpen(true);
  };

  // Handle image regeneration with optional hint
  const handleRegenerateConfirm = async (hint?: string) => {
    if (!regenerateTarget) return;

    setRegenerateLoading(true);
    try {
      await regenerateImage(regenerateTarget.viewType, regenerateTarget.angle, hint);
      setRegenerateDialogOpen(false);
      setRegenerateTarget(null);
    } catch (err) {
      console.error('Failed to regenerate image:', err);
    } finally {
      setRegenerateLoading(false);
    }
  };

  // Handle step click for navigation back
  const handleStepClick = (targetStep: ResetTargetStep) => {
    setResetTargetStep(targetStep);
    setResetDialogOpen(true);
  };

  // Handle reset step confirmation
  const handleResetStepConfirm = async (keepResults: boolean) => {
    if (!resetTargetStep) return;

    setResetLoading(true);
    try {
      await resetStep(resetTargetStep, keepResults);
      setResetDialogOpen(false);
      setResetTargetStep(null);
    } catch (err) {
      console.error('Failed to reset step:', err);
    } finally {
      setResetLoading(false);
    }
  };

  // Calculate current step from status
  const displayStep = getStepFromStatus(pipeline?.status, !!pipelineId);
  const isFailed = pipeline?.status === 'failed';

  // Step 1: Upload - cleaner without card wrapper
  // NOTE: Selectors moved to renderImagesReadyStep (Step 2)
  const renderUploadStep = () => (
    <div className="space-y-6">
      {user ? (
        <>
          <PipelineUploader
            userId={user.uid}
            images={uploadedImages}
            onImagesChange={setUploadedImages}
            maxImages={4}
            disabled={actionLoading}
          />

          {/* Style Selector - shows after images uploaded, BEFORE analysis */}
          {uploadedImages.length > 0 && (
            <StyleSelector
              value={selectedStyle}
              onChange={setSelectedStyle}
              recommendedStyle={imageAnalysis?.recommendedStyle}
              styleConfidence={imageAnalysis?.styleConfidence}
              disabled={actionLoading || analysisLoading}
              locked={!!imageAnalysis && !styleChangeRequested}
              onRequestUnlock={handleStyleChangeRequest}
              styleSuitability={imageAnalysis?.styleSuitability}
              styleSuitabilityReason={imageAnalysis?.styleSuitabilityReason}
            />
          )}

          {/* Re-analyze prompt when style changed after analysis */}
          {styleChangeRequested && imageAnalysis && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-sm text-amber-800 dark:text-amber-200 flex-1">
                {t('styles.reanalyzeRequired')}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleStyleChangeCancel}>
                  {t('buttons.cancel')}
                </Button>
                <Button size="sm" onClick={handleStyleChangeConfirm}>
                  {t('styles.reanalyze')}
                </Button>
              </div>
            </div>
          )}

          {/* Image Analysis Panel - shows after images uploaded */}
          {uploadedImages.length > 0 && (
            <ImageAnalysisPanel
              analysis={imageAnalysis}
              loading={analysisLoading}
              error={analysisError}
              colorCount={colorCount}
              onColorCountChange={setColorCount}
              onDescriptionChange={(desc) => {
                updateDescription(desc);
                setUserDescription(desc);
              }}
              onColorsChange={updateColors}
              onColorAdd={addColor}
              onColorRemove={removeColor}
              onColorUpdate={updateColor}
              onAnalyze={handleAnalyze}
              onReset={resetAnalysis}
              hasEdits={analysisHasEdits}
              disabled={actionLoading}
            />
          )}

          {/* Start button - only show after analysis completes and no style change pending */}
          {/* Style selector is now shown before analysis */}
          {imageAnalysis && !styleChangeRequested && (
            <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={handleStartPipeline}
                  disabled={uploadedImages.length === 0 || actionLoading || authLoading || styleChangeRequested}
                  className="px-8"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('buttons.processing')}
                    </>
                  ) : (
                    <>
                      <Images className="mr-2 h-4 w-4" />
                      {t('buttons.generateViewsWithCredits', { credits: GEMINI_MODEL_OPTIONS[geminiModel].creditCost })}
                    </>
                  )}
                </Button>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{t('buttons.pleaseSignIn')}</p>
            <Button onClick={() => router.push('/auth')}>
              {t('buttons.signIn')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Step 1b: Draft with analysis - preview analysis results and multi-view grid
  // User can edit description/colors, view/upload multi-view images, then proceed
  const renderDraftWithAnalysis = () => {
    const hasAllMeshImages = pipeline?.meshImages &&
      Object.keys(pipeline.meshImages).length === 4;

    // Check if any multi-view images exist
    const hasSomeImages = (pipeline?.meshImages && Object.keys(pipeline.meshImages).length > 0);

    // Check if image generation is in progress (prevents double-click)
    const isGeneratingImages = pipeline?.status === 'generating-images' ||
      pipeline?.status === 'batch-queued' ||
      pipeline?.status === 'batch-processing';

    return (
      <div className="space-y-6">
        {/* Reference image preview */}
        {pipeline?.inputImages && pipeline.inputImages.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{t('images.referenceImages')}</h3>
            <div className="flex gap-3">
              {pipeline.inputImages.map((img, idx) => (
                <div key={idx} className="w-24 h-24 rounded-lg overflow-hidden bg-black">
                  <img
                    src={img.url}
                    alt={`Reference ${idx + 1}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Style Selector - shows before analysis panel, with locked state */}
        <StyleSelector
          value={selectedStyle}
          onChange={setSelectedStyle}
          recommendedStyle={imageAnalysis?.recommendedStyle}
          styleConfidence={imageAnalysis?.styleConfidence}
          disabled={actionLoading || analysisLoading}
          locked={!!imageAnalysis && !styleChangeRequested}
          onRequestUnlock={handleStyleChangeRequest}
          styleSuitability={imageAnalysis?.styleSuitability}
          styleSuitabilityReason={imageAnalysis?.styleSuitabilityReason}
        />

        {/* Re-analyze prompt when style changed after analysis */}
        {styleChangeRequested && imageAnalysis && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-sm text-amber-800 dark:text-amber-200 flex-1">
              {t('styles.reanalyzeRequired')}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleStyleChangeCancel}>
                {t('buttons.cancel')}
              </Button>
              <Button size="sm" onClick={handleStyleChangeConfirm}>
                {t('styles.reanalyze')}
              </Button>
            </div>
          </div>
        )}

        {/* Image Analysis Panel - editable */}
        <ImageAnalysisPanel
          analysis={imageAnalysis}
          loading={analysisLoading}
          error={analysisError}
          colorCount={colorCount}
          onColorCountChange={setColorCount}
          onDescriptionChange={(desc) => {
            updateDescription(desc);
            setUserDescription(desc);
          }}
          onColorsChange={updateColors}
          onColorAdd={addColor}
          onColorRemove={removeColor}
          onColorUpdate={updateColor}
          onAnalyze={handleAnalyze}
          onReset={resetAnalysis}
          hasEdits={analysisHasEdits}
          disabled={actionLoading}
        />

        {/* Multi-view grid (if images exist) - only show mesh images for 3D printing */}
        {hasSomeImages && (
          <MultiViewGrid
            meshImages={pipeline?.meshImages || {}}
            isGenerating={false}
            onUploadView={(viewType, angle, file) => {
              // TODO: Implement view upload
              console.log('Upload view:', viewType, angle, file);
            }}
            onRegenerateView={(viewType, angle) => openRegenerateDialog(viewType, angle)}
            disabled={actionLoading}
          />
        )}

        {/* Action buttons */}
        <div className="flex justify-center gap-4 pt-4">
          {!hasSomeImages ? (
            // No multi-view images yet - show "Generate views" button
            <Button
              size="lg"
              onClick={handleStartPipeline}
              disabled={actionLoading || isGeneratingImages}
              className="px-8"
            >
              {actionLoading || isGeneratingImages ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('buttons.generating')}
                </>
              ) : (
                <>
                  <Images className="mr-2 h-4 w-4" />
                  {t('buttons.generateViewsWithCredits', { credits: GEMINI_MODEL_OPTIONS[geminiModel].creditCost })}
                </>
              )}
            </Button>
          ) : hasAllMeshImages ? (
            // All 4 mesh images ready - proceed to mesh generation
            <Button
              size="lg"
              onClick={handleStartMesh}
              disabled={actionLoading}
              className="px-8"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('buttons.processing')}
                </>
              ) : (
                <>
                  <Box className="mr-2 h-4 w-4" />
                  {t('buttons.nextStepWithCredits', { credits: PROVIDER_OPTIONS[selectedProvider].creditCost })}
                </>
              )}
            </Button>
          ) : (
            // Some images exist but not all - show both options
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={handleStartPipeline}
                disabled={actionLoading || isGeneratingImages}
              >
                {actionLoading || isGeneratingImages ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {actionLoading || isGeneratingImages ? t('buttons.generating') : t('step1.regenerateAll')}
              </Button>
              <Button
                size="lg"
                onClick={handleStartMesh}
                disabled={actionLoading || !hasAllMeshImages}
                className="px-8"
              >
                <Box className="mr-2 h-4 w-4" />
                {t('buttons.nextStepWithCredits', { credits: PROVIDER_OPTIONS[selectedProvider].creditCost })}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  // Step 1c: Images ready - preview all 4 mesh views, can replace individual, then proceed to mesh
  const renderImagesReadyStep = () => {
    const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];

    // Get mode info for display
    const currentMode = pipeline?.generationMode || generationMode;
    const modeInfo = GENERATION_MODE_OPTIONS[currentMode];

    return (
      <div className="space-y-6">
        {/* Reference images - collapsed */}
        {pipeline?.inputImages && pipeline.inputImages.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{t('images.referenceImages')}</h3>
            <div className="flex gap-2">
              {pipeline.inputImages.map((img, idx) => (
                <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden bg-black">
                  <img
                    src={img.url}
                    alt={`Reference ${idx + 1}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Multi-view grid with replace functionality */}
        <div className="space-y-8">
          {/* Mesh images */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium">{t('images.meshImages')}</h4>
              <Badge variant="outline" className="text-xs">{modeInfo?.meshStyle || '7色優化'}</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {meshAngles.map((angle) => {
                const image = pipeline?.meshImages[angle];
                return (
                  <div key={angle} className="relative group rounded-xl overflow-hidden bg-muted">
                    {image ? (
                      <img
                        src={image.url}
                        alt={`${angle} view`}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <Skeleton className="w-full aspect-square" />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openRegenerateDialog('mesh', angle)}
                        disabled={actionLoading || regenerateLoading || !canRegenerate}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        {t('images.regenerate')}
                      </Button>
                      {canRegenerate ? (
                        <span className="text-xs text-white/70">{t('images.remaining', { count: regenerationsRemaining })}</span>
                      ) : (
                        <span className="text-xs text-red-300">{t('images.limitReached')}</span>
                      )}
                    </div>
                    <span className="absolute bottom-2 left-2 text-xs font-medium text-white bg-black/50 px-2 py-0.5 rounded">
                      {t(`angles.${angle}`)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3D 生成引擎選擇 */}
        <div className="mt-6">
          <ProviderSelector
            value={selectedProvider}
            onChange={setSelectedProvider}
            disabled={actionLoading}
            showCredits={true}
            providers={['tripo', 'hunyuan', 'hitem3d']}
          />
        </div>

        {/* Action button - proceed to mesh generation */}
        <div className="flex justify-center pt-4">
          <Button size="lg" onClick={handleStartMesh} disabled={actionLoading} className="px-8">
            {actionLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('buttons.processing')}
              </>
            ) : (
              <>
                <Box className="mr-2 h-4 w-4" />
                {t('buttons.nextStepWithCredits', { credits: PROVIDER_OPTIONS[selectedProvider].creditCost })}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // Step 2: Processing - shows batch or realtime progress (image generation)
  // Uses UnifiedProgressIndicator for consistent UX across all processing states
  const renderProcessingStep = () => {
    const isBatch = pipeline?.processingMode === 'batch' || isBatchProcessing;
    const progress = pipeline?.generationProgress;

    // Progress values: mesh (0-4)
    const meshCompleted = progress?.meshViewsCompleted ?? 0;
    const phase = progress?.phase ?? 'mesh-views';

    // View labels for display (used in realtime mode grid)
    const meshLabels = [t('angles.front'), t('angles.back'), t('angles.left'), t('angles.right')];

    // For submitting (draft) and batch modes, use the unified indicator
    if (pipeline?.status === 'draft' || isBatch) {
      return (
        <div className="py-16">
          <UnifiedProgressIndicator
            status={pipeline?.status || 'batch-queued'}
            processingMode={pipeline?.processingMode || 'batch'}
            progress={{
              meshViewsCompleted: meshCompleted,
              phase,
              batchProgress: pipeline?.batchProgress,
            }}
            estimatedCompletionTime={pipeline?.estimatedCompletionTime}
            onViewHistory={() => router.push('/dashboard/history')}
          />
        </div>
      );
    }

    // Realtime mode: show detailed visual grid for granular progress
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
          <div className="relative bg-primary/10 p-6 rounded-full">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        </div>
        <p className="text-lg font-medium mt-6">{t('processing.generatingViews')}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {phase === 'mesh-views'
            ? `${t('processing.meshViews')} (${meshCompleted}/4)...`
            : t('processing.aiAnalyzing')}
        </p>

        {/* Visual progress grid - 4 mesh view boxes */}
        <div className="w-full max-w-lg mt-8">
          {/* Mesh views - green theme */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Box className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">{t('processing.meshViewsLabel')}</span>
              <span className="text-xs text-muted-foreground">({meshCompleted}/4)</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {meshLabels.map((label, index) => {
                const isCompleted = index < meshCompleted;
                const isProcessingView = index === meshCompleted && phase === 'mesh-views';
                return (
                  <div
                    key={`mesh-${index}`}
                    className={`
                      aspect-square rounded-lg border-2 flex flex-col items-center justify-center
                      transition-all duration-300
                      ${isCompleted
                        ? 'border-green-500 bg-green-500/10'
                        : isProcessingView
                          ? 'border-green-500/50 bg-green-500/5 animate-pulse'
                          : 'border-border bg-muted/30'}
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : isProcessingView ? (
                      <Loader2 className="h-5 w-5 text-green-500 animate-spin" />
                    ) : (
                      <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30" />
                    )}
                    <span className="text-xs text-muted-foreground mt-1">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 2: Mesh generation - with previous outputs sidebar
  // Uses UnifiedProgressIndicator for consistent progress display
  const renderMeshGeneratingStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content - unified progress indicator */}
      <div className="lg:col-span-2 py-16">
        <UnifiedProgressIndicator
          status="generating-mesh"
          processingMode={pipeline?.processingMode || 'batch'}
          provider={pipeline?.settings?.provider}
        />
      </div>

      {/* Sidebar - previous outputs */}
      {pipeline && (
        <div className="lg:col-span-1">
          <PreviousOutputs pipeline={pipeline} showImages={true} />
        </div>
      )}
    </div>
  );

  // Fullscreen toggle handlers
  const handleMeshFullscreen = () => {
    if (!meshContainerRef.current) return;
    if (!meshFullscreen) {
      meshContainerRef.current.requestFullscreen?.();
      setMeshFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setMeshFullscreen(false);
    }
  };

  const handleTexturedFullscreen = () => {
    if (!texturedContainerRef.current) return;
    if (!texturedFullscreen) {
      texturedContainerRef.current.requestFullscreen?.();
      setTexturedFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setTexturedFullscreen(false);
    }
  };

  // Screenshot handlers
  const handleMeshScreenshot = () => {
    const dataUrl = meshViewerRef.current?.takeScreenshot();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `mesh-preview-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const handleTexturedScreenshot = () => {
    const dataUrl = texturedViewerRef.current?.takeScreenshot();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `model-preview-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  // Download handler - uses fetch to preserve Referer header
  const handleDownload = async (url: string, fileName: string) => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadFile(url, fileName);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  // Step 2 complete: Mesh preview - user can add texture or finish with mesh only
  const renderMeshPreviewStep = () => {
    // Check if provider outputs textured mesh (e.g., Hunyuan 3D Pro)
    const provider = pipeline?.settings?.provider;
    const providerHasTexturedMesh = provider
      ? PROVIDER_OPTIONS[provider]?.capabilities?.texturedMesh === true
      : false;

    return (
      <div className="space-y-6">
        {/* Full-width 3D viewer */}
        {pipeline?.meshUrl ? (
          <>
            <div
              ref={meshContainerRef}
              className="relative aspect-[4/3] lg:aspect-[16/9] bg-muted/30 rounded-2xl overflow-hidden border border-border/50"
            >
              <TranslatedModelViewerErrorBoundary>
                <ModelViewer
                  ref={meshViewerRef}
                  modelUrl={pipeline.meshUrl}
                  viewMode={meshViewMode}
                  backgroundColor={meshBgColor}
                  showGrid={meshShowGrid}
                  showAxes={meshShowAxes}
                  autoRotate={meshAutoRotate}
                />
              </TranslatedModelViewerErrorBoundary>
              <ViewerToolbar
                viewMode={meshViewMode}
                onViewModeChange={setMeshViewMode}
                hasTextures={providerHasTexturedMesh}
                backgroundColor={meshBgColor}
                onBackgroundChange={setMeshBgColor}
                showGrid={meshShowGrid}
                onShowGridChange={setMeshShowGrid}
                showAxes={meshShowAxes}
                onShowAxesChange={setMeshShowAxes}
                autoRotate={meshAutoRotate}
                onAutoRotateChange={setMeshAutoRotate}
                onScreenshot={handleMeshScreenshot}
                onFullscreen={handleMeshFullscreen}
                isFullscreen={meshFullscreen}
                onReset={() => meshViewerRef.current?.resetCamera()}
                portalContainer={meshContainerRef.current}
              />
            </div>

            {/* Download and optimization links */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handleDownload(pipeline.meshUrl!, 'mesh-model.glb')}
                disabled={downloading}
                className="text-primary hover:underline text-sm inline-flex items-center gap-1 disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Box className="h-3 w-3" />
                )}
                {t('step2.downloadGlb')}
              </button>

              {/* 3D Print Optimization (Admin Only) */}
              {isAdmin && (
                <Dialog open={showOptimizeDialog} onOpenChange={setShowOptimizeDialog}>
                  <DialogTrigger asChild>
                    <button className="text-primary hover:underline text-sm inline-flex items-center gap-1">
                      <Wrench className="h-3 w-3" />
                      {tDownload('printOptimization.button')}
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{tDownload('printOptimization.title')}</DialogTitle>
                    </DialogHeader>
                    <OptimizePanel
                      modelUrl={pipeline.meshUrl!}
                      pipelineId={pipelineId || undefined}
                      jobId={pipeline.meshyMeshTaskId}
                      onOptimized={(url) => {
                        console.log('Optimized model URL:', url);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </>
        ) : (
          <Skeleton className="aspect-[4/3] lg:aspect-[16/9] rounded-2xl" />
        )}

        {/* Info and actions below viewer */}
        {pipeline && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Previous outputs with provider badge */}
            <PreviousOutputs pipeline={pipeline} showImages={true} defaultCollapsed={false} />

            {/* Action button - complete and go to dashboard */}
            <div className="flex flex-col gap-3">
              <Button
                className="flex-1"
                size="lg"
                onClick={() => router.push('/dashboard')}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {t('step2.finish')}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Step 3: Texture generation in progress
  // Uses UnifiedProgressIndicator for consistent progress display
  const renderTextureGeneratingStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content - unified progress indicator */}
      <div className="lg:col-span-2 py-16">
        <UnifiedProgressIndicator
          status="generating-texture"
          processingMode={pipeline?.processingMode || 'batch'}
        />
      </div>

      {/* Sidebar - previous outputs (images + mesh) */}
      {pipeline && (
        <div className="lg:col-span-1">
          <PreviousOutputs pipeline={pipeline} showImages={true} showMesh={true} />
        </div>
      )}
    </div>
  );

  // Step 3 complete: Show completed model + Step 4 Coming Soon
  // User stays on Step 3, with Step 4 (Print & Delivery) shown as Coming Soon
  const renderCompleteStep = () => {
    const modelUrl = pipeline?.texturedModelUrl || pipeline?.meshUrl;
    const hasTexture = !!pipeline?.texturedModelUrl;

    return (
      <div className="space-y-6">
        {/* Full-width 3D viewer */}
        {modelUrl ? (
          <>
            <div
              ref={texturedContainerRef}
              className="relative aspect-[4/3] lg:aspect-[16/9] bg-muted/30 rounded-2xl overflow-hidden border border-green-500/20"
            >
              <TranslatedModelViewerErrorBoundary>
                <ModelViewer
                  ref={texturedViewerRef}
                  modelUrl={modelUrl}
                  viewMode={texturedViewMode}
                  backgroundColor={texturedBgColor}
                  showGrid={texturedShowGrid}
                  showAxes={texturedShowAxes}
                  autoRotate={texturedAutoRotate}
                />
              </TranslatedModelViewerErrorBoundary>
              <ViewerToolbar
                viewMode={texturedViewMode}
                onViewModeChange={setTexturedViewMode}
                hasTextures={hasTexture}
                backgroundColor={texturedBgColor}
                onBackgroundChange={setTexturedBgColor}
                showGrid={texturedShowGrid}
                onShowGridChange={setTexturedShowGrid}
                showAxes={texturedShowAxes}
                onShowAxesChange={setTexturedShowAxes}
                autoRotate={texturedAutoRotate}
                onAutoRotateChange={setTexturedAutoRotate}
                onScreenshot={handleTexturedScreenshot}
                onFullscreen={handleTexturedFullscreen}
                isFullscreen={texturedFullscreen}
                onReset={() => texturedViewerRef.current?.resetCamera()}
                portalContainer={texturedContainerRef.current}
              />
            </div>

            {/* Download and optimization links */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() =>
                  handleDownload(modelUrl, hasTexture ? 'textured-model.glb' : 'mesh-model.glb')
                }
                disabled={downloading}
                className="text-primary hover:underline text-sm inline-flex items-center gap-1 disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : hasTexture ? (
                  <Palette className="h-3 w-3" />
                ) : (
                  <Box className="h-3 w-3" />
                )}
                {t('step2.downloadGlb')}
              </button>

              {/* 3D Print Optimization (Admin Only) */}
              {isAdmin && modelUrl && (
                <Dialog open={showOptimizeDialog} onOpenChange={setShowOptimizeDialog}>
                  <DialogTrigger asChild>
                    <button className="text-primary hover:underline text-sm inline-flex items-center gap-1">
                      <Wrench className="h-3 w-3" />
                      {tDownload('printOptimization.button')}
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{tDownload('printOptimization.title')}</DialogTitle>
                    </DialogHeader>
                    <OptimizePanel
                      modelUrl={modelUrl}
                      pipelineId={pipelineId || undefined}
                      jobId={pipeline?.meshyMeshTaskId}
                      onOptimized={(url) => {
                        console.log('Optimized model URL:', url);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </>
        ) : (
          <div className="aspect-[4/3] lg:aspect-[16/9] bg-gradient-to-br from-green-500/5 to-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20">
            <div className="text-center">
              <div className="bg-green-500/10 p-5 rounded-full inline-block mb-4">
                <CheckCircle className="h-14 w-14 text-green-500" />
              </div>
              <p className="text-xl font-semibold">
                {hasTexture ? t('step3.completed') : t('step2.title')}
              </p>
            </div>
          </div>
        )}

        {/* Info and actions below viewer */}
        {pipeline && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Step 4: Print & Delivery - Coming Soon */}
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-primary/10 p-1.5 rounded-full">
                  <Printer className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-medium">{t('step4.title')}</h4>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 mt-0.5">
                    {t('step4.comingSoon')}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('step4.description')}
              </p>
            </div>

            {/* Previous outputs (collapsible) */}
            <div className="md:col-span-1 lg:col-span-1">
              <PreviousOutputs pipeline={pipeline} showImages={true} defaultCollapsed={true} />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row md:flex-col gap-3">
              <Button
                className="flex-1"
                onClick={() => {
                  setPipelineId(null);
                  setUploadedImages([]);
                  router.push('/generate', { scroll: false });
                }}
              >
                {t('completion.createNew')}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push('/dashboard')}
              >
                {t('completion.viewHistory')}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Handle retry for failed pipelines
  const handleRetry = async () => {
    if (!pipelineId || !pipeline) return;

    setActionLoading(true);
    try {
      // Retry based on which step failed
      if (pipeline.errorStep === 'generating-images') {
        await generateImages(pipelineId);
      } else if (pipeline.errorStep === 'generating-mesh') {
        // Use the provider from pipeline settings (what was originally selected)
        await startMeshGeneration(pipeline.settings.provider, pipeline.settings.providerOptions);
      } else if (pipeline.errorStep === 'generating-texture') {
        await startTextureGeneration();
      }
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Render error state - cleaner design
  const renderErrorState = () => {
    const errorStep = pipeline?.errorStep;
    const canRetry = errorStep === 'generating-images' ||
                     errorStep === 'generating-mesh' ||
                     errorStep === 'generating-texture';

    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-destructive/10 p-4 rounded-full mb-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <p className="text-lg font-medium mb-2">{t('error.title')}</p>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-2">
          {error || pipeline?.error || t('error.defaultMessage')}
        </p>
        {errorStep && (
          <p className="text-xs text-muted-foreground mb-6">
            {t('error.failedStep')}: {errorStep === 'generating-images' ? t('error.steps.generatingImages') :
                     errorStep === 'generating-mesh' ? t('error.steps.generatingMesh') :
                     errorStep === 'generating-texture' ? t('error.steps.generatingTexture') : errorStep}
          </p>
        )}
        <div className="flex justify-center gap-4">
          {canRetry && (
            <Button
              onClick={handleRetry}
              disabled={actionLoading}
              variant="default"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('error.retrying')}
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('error.retry')}
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setPipelineId(null);
              setUploadedImages([]);
              router.push('/generate', { scroll: false });
            }}
          >
            {t('error.restart')}
          </Button>
        </div>
      </div>
    );
  };

  // Main render
  if (pipelineLoading && pipelineId) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Check if currently processing (image generation in progress)
  // Draft with analysis is NOT processing - user is previewing
  const isDraftWithAnalysis = pipeline?.status === 'draft' && pipeline?.imageAnalysis;
  const isProcessing = pipeline?.status?.includes('generating') ||
    pipeline?.status === 'batch-queued' ||
    pipeline?.status === 'batch-processing';

  return (
    <div className="space-y-6">
      <PipelineProgressBar
        currentStep={displayStep}
        isFailed={isFailed}
        isProcessing={isProcessing}
        credits={credits}
        creditsLoading={creditsLoading}
        onStepClick={handleStepClick}
      />

      {pipeline?.status === 'failed' || error ? (
        <PipelineErrorState
          pipeline={pipeline}
          error={error}
          onRetry={handleRetry}
          onReset={() => {
            setPipelineId(null);
            setUploadedImages([]);
            router.push('/generate', { scroll: false });
          }}
          isRetrying={actionLoading}
        />
      ) : !pipelineId ? (
        // No pipeline yet - initial upload
        renderUploadStep()
      ) : isDraftWithAnalysis ? (
        // Draft with analysis - show analysis preview, let user edit and proceed
        renderDraftWithAnalysis()
      ) : pipeline?.status === 'batch-queued' || pipeline?.status === 'batch-processing' || pipeline?.status === 'generating-images' ? (
        // Image generation in progress
        renderProcessingStep()
      ) : pipeline?.status === 'images-ready' ? (
        // All 6 images ready - preview and proceed to mesh (Step 1 complete)
        renderImagesReadyStep()
      ) : pipeline?.status === 'generating-mesh' ? (
        // Step 2: Mesh generation in progress
        renderMeshGeneratingStep()
      ) : pipeline?.status === 'mesh-ready' ? (
        // Step 2 complete: Mesh preview, proceed to texture
        renderMeshPreviewStep()
      ) : pipeline?.status === 'generating-texture' ? (
        // Step 3: Texture generation in progress
        renderTextureGeneratingStep()
      ) : pipeline?.status === 'completed' ? (
        // Step 3 complete: Show completed model + Step 4 Coming Soon
        renderCompleteStep()
      ) : (
        renderUploadStep()
      )}

      {/* Regenerate dialog */}
      <RegenerateDialog
        open={regenerateDialogOpen}
        onOpenChange={(open) => {
          setRegenerateDialogOpen(open);
          if (!open) setRegenerateTarget(null);
        }}
        viewType={regenerateTarget?.viewType || 'mesh'}
        angle={regenerateTarget?.angle || 'front'}
        onConfirm={handleRegenerateConfirm}
        loading={regenerateLoading}
      />

      <ResetStepDialog
        open={resetDialogOpen}
        onOpenChange={(open) => {
          setResetDialogOpen(open);
          if (!open) setResetTargetStep(null);
        }}
        targetStep={resetTargetStep || 'images-ready'}
        currentStep={pipeline?.status || 'draft'}
        onConfirm={handleResetStepConfirm}
        loading={resetLoading}
      />
    </div>
  );
}
