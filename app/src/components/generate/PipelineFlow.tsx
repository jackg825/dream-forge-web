'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
} from 'lucide-react';
import { ModelViewer, type ModelViewerRef } from '@/components/viewer/ModelViewer';
import { ModelViewerErrorBoundary } from '@/components/viewer/ModelViewerErrorBoundary';
import { ViewerToolbar } from '@/components/viewer/ViewerToolbar';
import { usePipeline } from '@/hooks/usePipeline';
import type { ViewMode } from '@/types';
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
import { MultiViewGrid } from './MultiViewGrid';
import { useImageAnalysis } from '@/hooks/useImageAnalysis';
import type {
  PipelineMeshAngle,
  PipelineTextureAngle,
  GenerationModeId,
  ProcessingMode,
  MeshPrecision,
  ModelProvider,
  ProviderOptions,
  GeminiModelId,
} from '@/types';
import {
  GENERATION_MODE_OPTIONS,
  DEFAULT_GENERATION_MODE,
  DEFAULT_PROCESSING_MODE,
  DEFAULT_MESH_PRECISION,
  DEFAULT_GEMINI_MODEL,
  PROVIDER_OPTIONS,
  GEMINI_MODEL_OPTIONS,
} from '@/types';
import { GeminiModelSelector } from './GeminiModelSelector';
import { ProviderSelector } from './ProviderSelector';

interface PipelineFlowProps {
  onNoCredits: () => void;
}

// Map pipeline status to step (new 4-step flow)
// Step 1: 準備圖片 (draft → images-ready)
// Step 2: 生成網格 (generating-mesh → mesh-ready)
// Step 3: 生成貼圖 (generating-texture → completed)
// Step 4: 打印配送 (Coming Soon - no status maps here)
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
      return 2; // 生成 3D 網格
    case 'generating-texture':
    case 'completed':
      return 3; // 生成貼圖 (completed 也停在 step 3，顯示 step 4 Coming Soon)
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

  const { user, loading: authLoading } = useAuth();
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

  // Provider selection state - default to Tripo for 3D printing optimization
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider>('tripo');
  const [providerOptions, setProviderOptions] = useState<ProviderOptions>({});

  // Gemini model selection state
  const [geminiModel, setGeminiModel] = useState<GeminiModelId>(DEFAULT_GEMINI_MODEL);

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
  const TEXTURE_COST = 10;

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

  // Handle image upload and pipeline creation
  // Uses fire-and-forget pattern: release UI immediately after createPipeline,
  // let Firestore subscription handle updates from submitBatch/generateImages
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

        // Release button immediately - Firestore subscription handles updates
        setActionLoading(false);

        // Start generation on existing pipeline
        if (processingMode === 'batch') {
          submitBatch(pipelineId).catch((err) => {
            console.error('Batch submission failed:', err);
          });
        } else {
          generateImages(pipelineId).catch((err) => {
            console.error('Image generation failed:', err);
          });
        }
        return;
      }

      // Create new pipeline (no prior analysis)
      const imageUrls = uploadedImages.map((img) => img.url);
      const finalDescription = imageAnalysis?.description || userDescription.trim() || undefined;
      const newPipelineId = await createPipeline(
        imageUrls,
        { meshPrecision, colorCount },
        generationMode,
        processingMode,
        finalDescription,
        imageAnalysis || undefined
      );
      setPipelineId(newPipelineId);

      // Update URL with pipeline ID
      router.push(`?id=${newPipelineId}`, { scroll: false });

      // Release button immediately - Firestore subscription handles updates
      setActionLoading(false);

      // Fire-and-forget: Start image generation based on processing mode
      if (processingMode === 'batch') {
        submitBatch(newPipelineId).catch((err) => {
          console.error('Batch submission failed:', err);
        });
      } else {
        generateImages(newPipelineId).catch((err) => {
          console.error('Image generation failed:', err);
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
      // Run analysis
      const result = await analyzeImage(uploadedImages[0].url, colorCount, 'fdm');

      // Create draft pipeline with analysis results
      const imageUrls = uploadedImages.map((img) => img.url);
      const newPipelineId = await createPipeline(
        imageUrls,
        { meshPrecision, colorCount },
        generationMode,
        processingMode,
        result.description,
        result
      );

      // Update state and URL so user can return to this draft
      setPipelineId(newPipelineId);
      router.push(`?id=${newPipelineId}`, { scroll: false });
    } catch (err) {
      console.error('Analysis failed:', err);
      // Error is handled by useImageAnalysis hook
    }
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

  // Handle texture generation
  const handleStartTexture = async () => {
    if (credits < TEXTURE_COST) {
      onNoCredits();
      return;
    }

    setActionLoading(true);
    try {
      await startTextureGeneration();
    } catch (err) {
      console.error('Failed to start texture generation:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Open regenerate dialog
  const openRegenerateDialog = (viewType: 'mesh' | 'texture', angle: string) => {
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

          {/* Provider selector and Start button - only show after analysis completes */}
          {imageAnalysis && (
            <>
              {/* 3D Provider selector (Hunyuan3D + Tripo3D only) */}
              <ProviderSelector
                value={selectedProvider}
                onChange={setSelectedProvider}
                disabled={actionLoading}
                showCredits={true}
                providers={['hunyuan', 'tripo']}
              />

              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={handleStartPipeline}
                  disabled={uploadedImages.length === 0 || actionLoading || authLoading}
                  className="px-8"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      處理中...
                    </>
                  ) : (
                    <>
                      開始生成 ({GEMINI_MODEL_OPTIONS[geminiModel].creditCost} 點)
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">請先登入以上傳圖片</p>
            <Button onClick={() => router.push('/auth')}>
              登入
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
    const hasAllTextureImages = pipeline?.textureImages &&
      Object.keys(pipeline.textureImages).length === 2;
    const hasAllImages = hasAllMeshImages && hasAllTextureImages;

    // Check if any multi-view images exist
    const hasSomeImages = (pipeline?.meshImages && Object.keys(pipeline.meshImages).length > 0) ||
      (pipeline?.textureImages && Object.keys(pipeline.textureImages).length > 0);

    // Check if image generation is in progress (prevents double-click)
    const isGeneratingImages = pipeline?.status === 'generating-images' ||
      pipeline?.status === 'batch-queued' ||
      pipeline?.status === 'batch-processing';

    return (
      <div className="space-y-6">
        {/* Reference image preview */}
        {pipeline?.inputImages && pipeline.inputImages.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">參考圖片</h3>
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
            textureImages={{}} // Hide texture images for simplified 3D printing workflow
            isGenerating={false}
            onUploadView={(viewType, angle, file) => {
              // TODO: Implement view upload
              console.log('Upload view:', viewType, angle, file);
            }}
            onRegenerateView={(viewType, angle) => openRegenerateDialog(viewType, angle)}
            disabled={actionLoading}
          />
        )}

        {/* 3D Provider selection (Hunyuan3D + Tripo3D only) */}
        <ProviderSelector
          value={selectedProvider}
          onChange={setSelectedProvider}
          disabled={actionLoading || isGeneratingImages}
          showCredits={true}
          providers={['hunyuan', 'tripo']}
        />

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
                  生成中...
                </>
              ) : (
                <>
                  <Images className="mr-2 h-4 w-4" />
                  生成多視角圖片 ({GEMINI_MODEL_OPTIONS[geminiModel].creditCost} 點)
                </>
              )}
            </Button>
          ) : hasAllImages ? (
            // All 6 images ready - proceed to mesh generation
            <Button
              size="lg"
              onClick={handleStartMesh}
              disabled={actionLoading}
              className="px-8"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  <Box className="mr-2 h-4 w-4" />
                  下一步: 生成 3D 網格 ({PROVIDER_OPTIONS[selectedProvider].creditCost} 點)
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
                {actionLoading || isGeneratingImages ? '生成中...' : '重新生成全部視角'}
              </Button>
              <Button
                size="lg"
                onClick={handleStartMesh}
                disabled={actionLoading || !hasAllMeshImages}
                className="px-8"
              >
                <Box className="mr-2 h-4 w-4" />
                下一步: 生成 3D 網格 ({PROVIDER_OPTIONS[selectedProvider].creditCost} 點)
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  // Step 1c: Images ready - preview all 6 views, can replace individual, then proceed to mesh
  const renderImagesReadyStep = () => {
    const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
    const textureAngles: PipelineTextureAngle[] = ['front', 'back'];

    // Get mode info for display
    const currentMode = pipeline?.generationMode || generationMode;
    const modeInfo = GENERATION_MODE_OPTIONS[currentMode];

    return (
      <div className="space-y-6">
        {/* Reference images - collapsed */}
        {pipeline?.inputImages && pipeline.inputImages.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">參考圖片</h3>
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
              <h4 className="text-sm font-medium">網格用圖片</h4>
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
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openRegenerateDialog('mesh', angle)}
                        disabled={actionLoading || regenerateLoading}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        重新生成
                      </Button>
                    </div>
                    <span className="absolute bottom-2 left-2 text-xs font-medium text-white bg-black/50 px-2 py-0.5 rounded">
                      {angle === 'front' ? '正面' : angle === 'back' ? '背面' : angle === 'left' ? '左側' : '右側'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Texture images - hidden for simplified 3D printing workflow */}
          {/* <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium">貼圖用圖片</h4>
              <Badge variant="outline" className="text-xs">{modeInfo?.textureStyle || '全彩'}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              {textureAngles.map((angle) => {
                const image = pipeline?.textureImages[angle];
                return (
                  <div key={angle} className="relative group rounded-xl overflow-hidden bg-muted">
                    {image ? (
                      <img
                        src={image.url}
                        alt={`${angle} texture view`}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <Skeleton className="w-full aspect-square" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openRegenerateDialog('texture', angle)}
                        disabled={actionLoading || regenerateLoading}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        重新生成
                      </Button>
                    </div>
                    <span className="absolute bottom-2 left-2 text-xs font-medium text-white bg-black/50 px-2 py-0.5 rounded">
                      {angle === 'front' ? '正面' : '背面'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div> */}
        </div>

        {/* 3D Provider selection (Hunyuan3D + Tripo3D only) */}
        <ProviderSelector
          value={selectedProvider}
          onChange={setSelectedProvider}
          disabled={actionLoading}
          showCredits={true}
          providers={['hunyuan', 'tripo']}
        />

        {/* Action button - proceed to mesh generation */}
        <div className="flex justify-center pt-4">
          <Button size="lg" onClick={handleStartMesh} disabled={actionLoading} className="px-8">
            {actionLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                處理中...
              </>
            ) : (
              <>
                <Box className="mr-2 h-4 w-4" />
                下一步: 生成 3D 網格 ({PROVIDER_OPTIONS[selectedProvider].creditCost} 點)
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

    // Progress values: mesh (0-4), texture (0-2)
    const meshCompleted = progress?.meshViewsCompleted ?? 0;
    const textureCompleted = progress?.textureViewsCompleted ?? 0;
    const phase = progress?.phase ?? 'mesh-views';

    // View labels for display (used in realtime mode grid)
    const meshLabels = ['正面', '背面', '左側', '右側'];
    const textureLabels = ['正面', '背面'];

    // For submitting (draft) and batch modes, use the unified indicator
    if (pipeline?.status === 'draft' || isBatch) {
      return (
        <div className="py-16">
          <UnifiedProgressIndicator
            status={pipeline?.status || 'batch-queued'}
            processingMode={pipeline?.processingMode || 'batch'}
            progress={{
              meshViewsCompleted: meshCompleted,
              textureViewsCompleted: textureCompleted,
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
        <p className="text-lg font-medium mt-6">正在生成視角圖片</p>
        <p className="text-sm text-muted-foreground mt-2">
          {phase === 'mesh-views'
            ? `正在生成網格用圖片 (${meshCompleted}/4)...`
            : phase === 'texture-views'
              ? `正在生成貼圖用圖片 (${textureCompleted}/2)...`
              : 'AI 正在分析您的圖片並生成多角度視圖'}
        </p>

        {/* Visual progress grid - 6 boxes: 4 green (mesh) + 2 blue (texture) */}
        <div className="w-full max-w-lg mt-8">
          {/* Mesh views - green theme */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Box className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">網格視圖</span>
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

          {/* Texture views - blue theme */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Palette className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">貼圖視圖</span>
              <span className="text-xs text-muted-foreground">({textureCompleted}/2)</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {textureLabels.map((label, index) => {
                const isCompleted = index < textureCompleted;
                const isProcessingView = index === textureCompleted && phase === 'texture-views';
                return (
                  <div
                    key={`texture-${index}`}
                    className={`
                      aspect-square rounded-lg border-2 flex flex-col items-center justify-center
                      transition-all duration-300
                      ${isCompleted
                        ? 'border-blue-500 bg-blue-500/10'
                        : isProcessingView
                          ? 'border-blue-500/50 bg-blue-500/5 animate-pulse'
                          : 'border-border bg-muted/30'}
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-6 w-6 text-blue-500" />
                    ) : isProcessingView ? (
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    ) : (
                      <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30" />
                    )}
                    <span className="text-xs text-muted-foreground mt-1">{label}</span>
                  </div>
                );
              })}
              {/* Empty slots to maintain grid alignment */}
              <div className="aspect-square" />
              <div className="aspect-square" />
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

  // Step 2 complete: Mesh preview - user can add texture or finish with mesh only
  const renderMeshPreviewStep = () => {
    // Check if provider outputs textured mesh (e.g., Hunyuan 3D Pro)
    const provider = pipeline?.settings?.provider;
    const providerHasTexturedMesh = provider
      ? PROVIDER_OPTIONS[provider]?.capabilities?.texturedMesh === true
      : false;

    return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Main content - 3D viewer */}
      <div className="lg:col-span-3 space-y-4">
        {pipeline?.meshUrl ? (
          <>
            {/* 3D Viewer with Toolbar */}
            <div
              ref={meshContainerRef}
              className="relative aspect-[4/3] bg-muted/30 rounded-2xl overflow-hidden border border-border/50"
            >
              <ModelViewerErrorBoundary>
                <ModelViewer
                  ref={meshViewerRef}
                  modelUrl={pipeline.meshUrl}
                  viewMode={meshViewMode}
                  backgroundColor={meshBgColor}
                  showGrid={meshShowGrid}
                  showAxes={meshShowAxes}
                  autoRotate={meshAutoRotate}
                />
              </ModelViewerErrorBoundary>
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

            {/* Download link */}
            <div className="text-center">
              <a
                href={pipeline.meshUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm inline-flex items-center gap-1"
              >
                <Box className="h-3 w-3" />
                下載 GLB 檔案
              </a>
            </div>
          </>
        ) : (
          <Skeleton className="aspect-[4/3] rounded-2xl" />
        )}
      </div>

      {/* Sidebar - previous outputs + actions */}
      {pipeline && (
        <div className="lg:col-span-1">
          <PreviousOutputs pipeline={pipeline} showImages={true} defaultCollapsed={false}>
            {/* Action buttons in sidebar */}
            <div className="space-y-3 pt-4">
              <Button
                className="w-full"
                size="lg"
                onClick={handleStartTexture}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    處理中...
                  </>
                ) : (
                  <>
                    <Palette className="mr-2 h-4 w-4" />
                    添加貼圖 (+{TEXTURE_COST} 點)
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push('/dashboard')}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                完成 (僅網格)
              </Button>
            </div>
          </PreviousOutputs>
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content - 3D viewer */}
        <div className="lg:col-span-3 space-y-4">
          {modelUrl ? (
            <>
              {/* 3D Viewer with Toolbar */}
              <div
                ref={texturedContainerRef}
                className="relative aspect-[4/3] bg-muted/30 rounded-2xl overflow-hidden border border-green-500/20"
              >
                <ModelViewerErrorBoundary>
                  <ModelViewer
                    ref={texturedViewerRef}
                    modelUrl={modelUrl}
                    viewMode={texturedViewMode}
                    backgroundColor={texturedBgColor}
                    showGrid={texturedShowGrid}
                    showAxes={texturedShowAxes}
                    autoRotate={texturedAutoRotate}
                  />
                </ModelViewerErrorBoundary>
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

              {/* Download link */}
              <div className="text-center">
                <a
                  href={modelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm inline-flex items-center gap-1"
                >
                  {hasTexture ? <Palette className="h-3 w-3" /> : <Box className="h-3 w-3" />}
                  下載 GLB 檔案
                </a>
              </div>
            </>
          ) : (
            <div className="aspect-[4/3] bg-gradient-to-br from-green-500/5 to-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20">
              <div className="text-center">
                <div className="bg-green-500/10 p-5 rounded-full inline-block mb-4">
                  <CheckCircle className="h-14 w-14 text-green-500" />
                </div>
                <p className="text-xl font-semibold">
                  {hasTexture ? '3D 模型已完成' : '3D 網格已完成'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - previous outputs + print service + actions */}
        {pipeline && (
          <div className="lg:col-span-1">
            <PreviousOutputs pipeline={pipeline} showImages={true} defaultCollapsed={true}>
              {/* Step 4: Print & Delivery - Coming Soon */}
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-primary/10 p-1.5 rounded-full">
                    <Printer className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">步驟 4: 列印&配送</h4>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 mt-0.5">
                      Coming Soon
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  很快你就可以直接訂購 3D 列印成品並寄送到府
                </p>
              </div>

              {/* Action buttons */}
              <div className="space-y-3 pt-4">
                <Button
                  className="w-full"
                  onClick={() => {
                    setPipelineId(null);
                    setUploadedImages([]);
                    router.push('/generate', { scroll: false });
                  }}
                >
                  創建新作品
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/dashboard')}
                >
                  查看我的作品
                </Button>
              </div>
            </PreviousOutputs>
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
        <p className="text-lg font-medium mb-2">處理失敗</p>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-2">
          {error || pipeline?.error || '發生錯誤，請重試'}
        </p>
        {errorStep && (
          <p className="text-xs text-muted-foreground mb-6">
            失敗步驟: {errorStep === 'generating-images' ? '生成視角圖片' :
                     errorStep === 'generating-mesh' ? '生成 3D 網格' :
                     errorStep === 'generating-texture' ? '生成貼圖' : errorStep}
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
                  重試中...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  重試
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
            重新開始
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
