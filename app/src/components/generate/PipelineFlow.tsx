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
import { BatchProgressIndicator } from './BatchProgressIndicator';
import { PreviousOutputs } from './PreviousOutputs';
import { RegenerateDialog } from './RegenerateDialog';
import { PipelineErrorState } from './PipelineErrorState';
import type {
  PipelineMeshAngle,
  PipelineTextureAngle,
  GenerationModeId,
  ProcessingMode,
} from '@/types';
import { GENERATION_MODE_OPTIONS, DEFAULT_GENERATION_MODE, DEFAULT_PROCESSING_MODE } from '@/types';

interface PipelineFlowProps {
  onNoCredits: () => void;
}

// Simplified step configuration - 4 core stages
const STEPS = [
  { id: 1, key: 'upload', icon: Upload, label: '上傳' },
  { id: 2, key: 'images', icon: Images, label: '視角圖片' },
  { id: 3, key: 'mesh', icon: Box, label: '3D 網格' },
  { id: 4, key: 'complete', icon: CheckCircle, label: '完成' },
] as const;

// Map pipeline status to step
const getStepFromStatus = (status: string | undefined, hasId: boolean): number => {
  if (!hasId) return 1;
  if (status === 'batch-queued' || status === 'batch-processing' || status === 'generating-images') return 2;
  if (status === 'images-ready') return 2;
  if (status === 'generating-mesh' || status === 'mesh-ready' || status === 'generating-texture') return 3;
  if (status === 'completed') return 4;
  return 1;
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
  const [processingMode, setProcessingMode] = useState<ProcessingMode>(DEFAULT_PROCESSING_MODE);
  const [userDescription, setUserDescription] = useState<string>('');

  // 3D Viewer state - mesh preview (Step 5)
  const meshViewerRef = useRef<ModelViewerRef>(null);
  const meshContainerRef = useRef<HTMLDivElement>(null);
  const [meshViewMode, setMeshViewMode] = useState<ViewMode>('clay');
  const [meshBgColor, setMeshBgColor] = useState('#1f2937');
  const [meshShowGrid, setMeshShowGrid] = useState(true);
  const [meshShowAxes, setMeshShowAxes] = useState(false);
  const [meshAutoRotate, setMeshAutoRotate] = useState(false);
  const [meshFullscreen, setMeshFullscreen] = useState(false);

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
      // Create pipeline with image URLs, generation mode, processing mode, and optional description
      const imageUrls = uploadedImages.map((img) => img.url);
      const newPipelineId = await createPipeline(
        imageUrls,
        undefined,
        generationMode,
        processingMode,
        userDescription.trim() || undefined
      );
      setPipelineId(newPipelineId);

      // Update URL with pipeline ID
      router.push(`?id=${newPipelineId}`, { scroll: false });

      // Start image generation based on processing mode
      if (processingMode === 'batch') {
        // Batch mode: submit to Gemini Batch API for async processing
        await submitBatch(newPipelineId);
      } else {
        // Realtime mode: generate images immediately
        await generateImages(newPipelineId);
      }
    } catch (err) {
      console.error('Failed to start pipeline:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle mesh generation
  const handleStartMesh = async () => {
    if (credits < MESH_COST) {
      onNoCredits();
      return;
    }

    setActionLoading(true);
    try {
      await startMeshGeneration();
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

  // Calculate current step from status
  const displayStep = getStepFromStatus(pipeline?.status, !!pipelineId);
  const isFailed = pipeline?.status === 'failed';

  // Render step indicator - cleaner design
  const renderStepper = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center gap-0">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = displayStep === step.id;
          const isCompleted = displayStep > step.id;

          return (
            <div key={step.id} className="flex items-center">
              {/* Step circle and label */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                    ${isActive && !isFailed ? 'border-primary bg-primary text-primary-foreground' : ''}
                    ${isCompleted ? 'border-green-500 bg-green-500 text-white' : ''}
                    ${!isActive && !isCompleted ? 'border-muted-foreground/30 bg-background text-muted-foreground' : ''}
                    ${isFailed && isActive ? 'border-destructive bg-destructive text-destructive-foreground' : ''}
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span className={`
                  mt-2 text-xs font-medium
                  ${isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'}
                `}>
                  {step.label}
                </span>
              </div>
              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div className={`
                  w-12 sm:w-20 h-0.5 mx-2
                  ${displayStep > step.id ? 'bg-green-500' : 'bg-muted-foreground/30'}
                `} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render credit display - more subtle
  const renderCredits = () => (
    <div className="flex items-center justify-center gap-3 mb-6 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">
        {creditsLoading ? '...' : credits} 點
      </span>
      <span className="text-muted-foreground/50">|</span>
      <span>網格 {MESH_COST} 點</span>
      <span className="text-muted-foreground/50">|</span>
      <span>貼圖 +{TEXTURE_COST} 點</span>
    </div>
  );

  // Step 1: Upload - cleaner without card wrapper
  const renderUploadStep = () => (
    <div className="space-y-6">
      {user ? (
        <>
          {/* Processing mode selector - batch (default) or realtime */}
          <ProcessingModeSelector
            value={processingMode}
            onChange={setProcessingMode}
            disabled={actionLoading}
          />

          {/* Generation mode selector - show before upload */}
          <ModeSelector
            value={generationMode}
            onChange={setGenerationMode}
            disabled={actionLoading}
          />

          {/* User description input - optional */}
          <div className="space-y-2">
            <Label htmlFor="user-description" className="text-sm font-medium">
              物件描述（可選）
            </Label>
            <Textarea
              id="user-description"
              placeholder="描述物件的特徵，幫助 AI 更準確地生成多角度視圖。例如：「藍色貓咪玩偶，有大眼睛、長尾巴和粉色蝴蝶結」"
              value={userDescription}
              onChange={(e) => setUserDescription(e.target.value)}
              maxLength={300}
              disabled={actionLoading}
              className="resize-none"
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {userDescription.length}/300 字元
            </p>
          </div>

          <PipelineUploader
            userId={user.uid}
            images={uploadedImages}
            onImagesChange={setUploadedImages}
            maxImages={4}
            disabled={actionLoading}
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
                  開始生成
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
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

  // Step 2: Processing - shows batch or realtime progress
  const renderProcessingStep = () => {
    const isBatch = pipeline?.processingMode === 'batch' || isBatchProcessing;

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
          {isBatch
            ? 'AI 正在批次處理您的圖片，您可以離開此頁面稍後回來'
            : 'AI 正在分析您的圖片並生成多角度視圖，約需 30-60 秒'}
        </p>

        {/* Show batch progress indicator for batch mode */}
        {isBatch && pipeline && (
          <div className="w-full max-w-md mt-6">
            <BatchProgressIndicator
              status={pipeline.status}
              progress={pipeline.batchProgress}
              estimatedCompletionTime={pipeline.estimatedCompletionTime}
            />
          </div>
        )}

        {/* Show link to history for batch mode */}
        {isBatch && (
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => router.push('/dashboard/history')}
          >
            前往歷史記錄查看
          </Button>
        )}
      </div>
    );
  };

  // Step 3: Image Preview - cleaner grid layout
  const renderImagePreviewStep = () => {
    const meshAngles: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
    const textureAngles: PipelineTextureAngle[] = ['front', 'back'];

    // Get mode info for display
    const currentMode = pipeline?.generationMode || generationMode;
    const modeInfo = GENERATION_MODE_OPTIONS[currentMode];

    return (
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

        {/* Texture images */}
        <div>
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
        </div>

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
                生成 3D 網格 ({MESH_COST} 點)
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // Step 4: Mesh generation - with previous outputs sidebar
  const renderMeshGeneratingStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content - loading indicator */}
      <div className="lg:col-span-2 flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
          <div className="relative bg-primary/10 p-6 rounded-full">
            <Box className="h-10 w-10 text-primary animate-pulse" />
          </div>
        </div>
        <p className="text-lg font-medium mt-6">正在生成 3D 網格</p>
        <p className="text-sm text-muted-foreground mt-2">
          Meshy AI 正在將您的圖片轉換為 3D 模型，約需 2-5 分鐘
        </p>
        <Progress className="w-full max-w-xs mt-6" value={50} />
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

  // Step 5: Mesh preview - with 3D viewer and sidebar
  const renderMeshPreviewStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Main content - 3D viewer */}
      <div className="lg:col-span-3 space-y-6">
        {pipeline?.meshUrl ? (
          <div className="space-y-4">
            {/* 3D Preview Header */}
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">3D 網格預覽</span>
            </div>

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
                hasTextures={false}
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
          </div>
        ) : (
          <Skeleton className="aspect-[4/3] rounded-2xl" />
        )}
      </div>

      {/* Sidebar - previous outputs + actions */}
      {pipeline && (
        <div className="lg:col-span-1 lg:pt-7">
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

  // Step 6: Texture generation - with previous outputs sidebar
  const renderTextureGeneratingStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content - loading indicator */}
      <div className="lg:col-span-2 flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
          <div className="relative bg-primary/10 p-6 rounded-full">
            <Palette className="h-10 w-10 text-primary animate-pulse" />
          </div>
        </div>
        <p className="text-lg font-medium mt-6">正在生成貼圖</p>
        <p className="text-sm text-muted-foreground mt-2">
          正在為您的 3D 模型添加精美貼圖，約需 2-5 分鐘
        </p>
        <Progress className="w-full max-w-xs mt-6" value={50} />
      </div>

      {/* Sidebar - previous outputs (images + mesh) */}
      {pipeline && (
        <div className="lg:col-span-1">
          <PreviousOutputs pipeline={pipeline} showImages={true} showMesh={true} />
        </div>
      )}
    </div>
  );

  // Step 7: Complete - with 3D viewer and sidebar
  const renderCompleteStep = () => {
    const modelUrl = pipeline?.texturedModelUrl || pipeline?.meshUrl;
    const hasTexture = !!pipeline?.texturedModelUrl;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content - 3D viewer */}
        <div className="lg:col-span-3 space-y-6">
          {modelUrl ? (
            <div className="space-y-4">
              {/* 3D Preview Header */}
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">
                  {hasTexture ? '3D 模型預覽 (含貼圖)' : '3D 網格預覽'}
                </span>
              </div>

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
            </div>
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
          <div className="lg:col-span-1 lg:pt-7">
            <PreviousOutputs pipeline={pipeline} showImages={true} defaultCollapsed={true}>
              {/* Print service coming soon */}
              <div className="bg-muted/30 rounded-xl p-4 text-center border border-border/50">
                <Printer className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <h4 className="text-sm font-medium">3D 列印服務即將推出</h4>
                <p className="text-xs text-muted-foreground mt-1">
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
        await startMeshGeneration();
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

  return (
    <div className="space-y-6">
      {renderStepper()}
      {renderCredits()}

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
        renderUploadStep()
      ) : pipeline?.status === 'batch-queued' || pipeline?.status === 'batch-processing' || pipeline?.status === 'generating-images' ? (
        renderProcessingStep()
      ) : pipeline?.status === 'images-ready' ? (
        renderImagePreviewStep()
      ) : pipeline?.status === 'generating-mesh' ? (
        renderMeshGeneratingStep()
      ) : pipeline?.status === 'mesh-ready' ? (
        renderMeshPreviewStep()
      ) : pipeline?.status === 'generating-texture' ? (
        renderTextureGeneratingStep()
      ) : pipeline?.status === 'completed' ? (
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
    </div>
  );
}
