'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Box,
  Palette,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
  RefreshCw,
  Wrench,
  History,
} from 'lucide-react';
import type {
  AdminPipeline,
  PipelineStatus,
  PipelineMeshAngle,
  PipelineTextureAngle,
  ModelProvider,
  AdminAction,
} from '@/types';
import { ProviderBadge } from '@/components/ui/provider-badge';
import { PROVIDER_OPTIONS } from '@/types';
import { useAdminPipelineRegeneration } from '@/hooks/useAdminPipelineRegeneration';

interface PipelineDetailModalProps {
  pipeline: AdminPipeline | null;
  open: boolean;
  onClose: () => void;
  onPipelineUpdated?: () => void;
}

// Status display configuration
const STATUS_CONFIG: Record<
  PipelineStatus,
  { label: string; icon: typeof Box; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: '草稿', icon: Clock, variant: 'secondary' },
  'batch-queued': { label: '排隊中', icon: Clock, variant: 'secondary' },
  'batch-processing': { label: '批次處理中', icon: Loader2, variant: 'default' },
  'generating-images': { label: '生成圖片中', icon: Loader2, variant: 'default' },
  'images-ready': { label: '圖片就緒', icon: CheckCircle, variant: 'secondary' },
  'generating-mesh': { label: '生成網格中', icon: Loader2, variant: 'default' },
  'mesh-ready': { label: '網格就緒', icon: Box, variant: 'secondary' },
  'generating-texture': { label: '生成貼圖中', icon: Loader2, variant: 'default' },
  completed: { label: '完成', icon: CheckCircle, variant: 'default' },
  failed: { label: '失敗', icon: AlertCircle, variant: 'destructive' },
};

const MESH_ANGLES: PipelineMeshAngle[] = ['front', 'back', 'left', 'right'];
const TEXTURE_ANGLES: PipelineTextureAngle[] = ['front', 'back'];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

interface ImageGalleryProps {
  images: { url: string; label: string; angle?: string }[];
  title: string;
  previewImages?: { url: string; label: string; angle?: string }[];
  onRegenerate?: (angle: string) => Promise<void>;
  onConfirm?: (angle: string) => Promise<void>;
  onReject?: (angle: string) => Promise<void>;
  isRegenerating?: boolean;
  showActions?: boolean;
}

function ImageGallery({
  images,
  title,
  previewImages,
  onRegenerate,
  onConfirm,
  onReject,
  isRegenerating,
  showActions = false,
}: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync selectedImage when images prop changes (e.g., after confirm)
  useEffect(() => {
    if (selectedAngle) {
      const currentImage = images.find((img) => img.angle === selectedAngle);
      if (currentImage && currentImage.url !== selectedImage) {
        setSelectedImage(currentImage.url);
      }
    }
  }, [images, selectedAngle, selectedImage]);

  // Find preview for selected angle
  const previewForSelected = previewImages?.find((p) => p.angle === selectedAngle);
  const isDisabled = isRegenerating || isProcessing;

  if (images.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>尚無{title}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Selected image preview with comparison */}
      {selectedImage && (
        <div className="mb-4">
          <div className="flex gap-2 items-stretch">
            {/* Current image */}
            <div className="flex-1 bg-black rounded-lg overflow-hidden">
              <p className="text-xs text-center py-1 bg-muted/50">目前</p>
              <img
                src={selectedImage}
                alt="Current"
                className="w-full h-56 object-contain"
              />
            </div>
            {/* Preview image (if exists) */}
            {previewForSelected && (
              <div className="flex-1 bg-black rounded-lg overflow-hidden border-2 border-yellow-500">
                <p className="text-xs text-center py-1 bg-yellow-500/20 text-yellow-600">預覽</p>
                <img
                  src={previewForSelected.url}
                  alt="Preview"
                  className="w-full h-56 object-contain"
                />
              </div>
            )}
          </div>
          {/* Actions for selected */}
          {showActions && selectedAngle && (
            <div className="flex gap-2 mt-2 justify-center">
              {previewForSelected ? (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={async () => {
                      setIsProcessing(true);
                      try {
                        await onConfirm?.(selectedAngle);
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    disabled={isDisabled}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-1" />
                    )}
                    確認覆蓋
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setIsProcessing(true);
                      try {
                        await onReject?.(selectedAngle);
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    disabled={isDisabled}
                  >
                    取消
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    setIsProcessing(true);
                    try {
                      await onRegenerate?.(selectedAngle);
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  disabled={isDisabled}
                >
                  {isDisabled ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  重新生成
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Thumbnail grid */}
      <div className="grid grid-cols-4 gap-2">
        {images.map((img, idx) => {
          const hasPreview = previewImages?.some((p) => p.angle === img.angle);
          return (
            <button
              key={idx}
              onClick={() => {
                setSelectedImage(img.url);
                setSelectedAngle(img.angle || null);
              }}
              className={`relative aspect-square bg-black rounded-md overflow-hidden border-2 transition-colors ${
                selectedImage === img.url ? 'border-primary' : 'border-transparent hover:border-muted'
              }`}
            >
              <img
                src={img.url}
                alt={img.label}
                className="w-full h-full object-contain"
              />
              {hasPreview && (
                <div className="absolute top-1 right-1 w-3 h-3 bg-yellow-500 rounded-full" />
              )}
              <span className="absolute bottom-0 left-0 right-0 text-xs bg-black/60 text-white text-center py-0.5">
                {img.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PipelineDetailModal({ pipeline, open, onClose, onPipelineUpdated }: PipelineDetailModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider>('meshy');
  const [activeTab, setActiveTab] = useState('input');

  const {
    isRegenerating,
    previewStatus,
    previewData,
    error: regenError,
    regenerateImage,
    regenerateMesh,
    checkPreviewStatus,
    confirmPreview,
    rejectPreview,
    clearError,
    setPreviewData,
  } = useAdminPipelineRegeneration();

  // Initialize preview data from pipeline
  useEffect(() => {
    if (pipeline?.adminPreview) {
      setPreviewData(pipeline.adminPreview);
    } else {
      setPreviewData(null);
    }
  }, [pipeline?.adminPreview, setPreviewData]);

  // Reset provider selection when pipeline changes
  useEffect(() => {
    if (pipeline?.settings?.provider) {
      setSelectedProvider(pipeline.settings.provider);
    }
  }, [pipeline?.settings?.provider]);

  // Poll for mesh preview status
  useEffect(() => {
    if (!pipeline || previewStatus !== 'processing') return;

    const interval = setInterval(async () => {
      const result = await checkPreviewStatus(pipeline.id);
      if (result?.status === 'completed' || result?.status === 'failed') {
        clearInterval(interval);
        onPipelineUpdated?.();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pipeline, previewStatus, checkPreviewStatus, onPipelineUpdated]);

  if (!pipeline) return null;

  const statusConfig = STATUS_CONFIG[pipeline.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  const isProcessing =
    pipeline.status === 'batch-queued' ||
    pipeline.status === 'batch-processing' ||
    pipeline.status === 'generating-images' ||
    pipeline.status === 'generating-mesh' ||
    pipeline.status === 'generating-texture';
  const totalCredits = pipeline.creditsCharged.mesh + pipeline.creditsCharged.texture;

  // Handlers for image regeneration
  const handleRegenerateMeshImage = async (angle: string) => {
    await regenerateImage(pipeline.id, 'mesh', angle as PipelineMeshAngle);
  };

  const handleRegenerateTextureImage = async (angle: string) => {
    await regenerateImage(pipeline.id, 'texture', angle as PipelineTextureAngle);
  };

  const handleConfirmMeshImage = async (angle: string) => {
    const success = await confirmPreview(pipeline.id, 'meshImages', angle);
    if (success) onPipelineUpdated?.();
  };

  const handleConfirmTextureImage = async (angle: string) => {
    const success = await confirmPreview(pipeline.id, 'textureImages', angle);
    if (success) onPipelineUpdated?.();
  };

  const handleRejectMeshImage = async (angle: string) => {
    await rejectPreview(pipeline.id, 'meshImages', angle);
  };

  const handleRejectTextureImage = async (angle: string) => {
    await rejectPreview(pipeline.id, 'textureImages', angle);
  };

  const handleRegenerateMesh = async () => {
    await regenerateMesh(pipeline.id, selectedProvider);
  };

  const handleConfirmMesh = async () => {
    const success = await confirmPreview(pipeline.id, 'mesh');
    if (success) onPipelineUpdated?.();
  };

  const handleRejectMesh = async () => {
    await rejectPreview(pipeline.id, 'mesh');
  };

  // Prepare image galleries
  const inputImages = pipeline.inputImages.map((img, idx) => ({
    url: img.url,
    label: `輸入 ${idx + 1}`,
  }));

  const meshImages = MESH_ANGLES
    .filter((angle) => pipeline.meshImages[angle])
    .map((angle) => ({
      url: pipeline.meshImages[angle]!.url,
      label: angle,
      angle,
    }));

  const textureImages = TEXTURE_ANGLES
    .filter((angle) => pipeline.textureImages[angle])
    .map((angle) => ({
      url: pipeline.textureImages[angle]!.url,
      label: angle,
      angle,
    }));

  // Preview images
  const meshPreviewImages = previewData?.meshImages
    ? Object.entries(previewData.meshImages).map(([angle, img]) => ({
        url: img!.url,
        label: angle,
        angle,
      }))
    : [];

  const texturePreviewImages = previewData?.textureImages
    ? Object.entries(previewData.textureImages).map(([angle, img]) => ({
        url: img!.url,
        label: angle,
        angle,
      }))
    : [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <span>Pipeline 詳情</span>
            <Badge variant={statusConfig.variant} className="gap-1">
              <StatusIcon className={`h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`} />
              {statusConfig.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* User info and metadata */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={pipeline.userPhotoURL || undefined} />
                  <AvatarFallback>
                    {pipeline.userDisplayName?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{pipeline.userDisplayName}</p>
                  <p className="text-sm text-muted-foreground">{pipeline.userEmail}</p>
                </div>
              </div>

              <div className="text-right text-sm">
                <p className="text-muted-foreground">建立時間</p>
                <p>{formatDate(pipeline.createdAt)}</p>
                {pipeline.completedAt && (
                  <>
                    <p className="text-muted-foreground mt-2">完成時間</p>
                    <p>{formatDate(pipeline.completedAt)}</p>
                  </>
                )}
              </div>
            </div>

            {/* Error display */}
            {pipeline.status === 'failed' && pipeline.error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">錯誤</span>
                </div>
                <p className="text-sm text-destructive">{pipeline.error}</p>
              </div>
            )}

            {/* Settings summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">供應商</p>
                <ProviderBadge provider={pipeline.settings.provider} />
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">品質</p>
                <p className="font-medium capitalize">{pipeline.settings.quality}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">點數消耗</p>
                <p className="font-medium">{totalCredits} 點</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">處理模式</p>
                <p className="font-medium capitalize">{pipeline.processingMode}</p>
              </div>
            </div>

            {/* User description */}
            {pipeline.userDescription && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">用戶描述</p>
                <p className="text-sm">{pipeline.userDescription}</p>
              </div>
            )}

            {/* Error display for regeneration */}
            {regenError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive flex-1">{regenError}</p>
                <Button size="sm" variant="ghost" onClick={clearError}>
                  關閉
                </Button>
              </div>
            )}

            {/* Images tabs with admin actions */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="input" className="gap-1 text-xs">
                  <ImageIcon className="h-3 w-3" />
                  輸入 ({inputImages.length})
                </TabsTrigger>
                <TabsTrigger value="mesh" className="gap-1 text-xs">
                  <Box className="h-3 w-3" />
                  網格 ({meshImages.length})
                </TabsTrigger>
                <TabsTrigger value="texture" className="gap-1 text-xs">
                  <Palette className="h-3 w-3" />
                  貼圖 ({textureImages.length})
                </TabsTrigger>
                <TabsTrigger value="admin" className="gap-1 text-xs">
                  <Wrench className="h-3 w-3" />
                  管理
                </TabsTrigger>
              </TabsList>

              <TabsContent value="input" className="mt-4">
                <ImageGallery images={inputImages} title="輸入圖片" />
              </TabsContent>

              <TabsContent value="mesh" className="mt-4">
                <ImageGallery
                  images={meshImages}
                  title="網格圖片"
                  previewImages={meshPreviewImages}
                  onRegenerate={handleRegenerateMeshImage}
                  onConfirm={handleConfirmMeshImage}
                  onReject={handleRejectMeshImage}
                  isRegenerating={isRegenerating}
                  showActions={true}
                />
              </TabsContent>

              <TabsContent value="texture" className="mt-4">
                <ImageGallery
                  images={textureImages}
                  title="貼圖圖片"
                  previewImages={texturePreviewImages}
                  onRegenerate={handleRegenerateTextureImage}
                  onConfirm={handleConfirmTextureImage}
                  onReject={handleRejectTextureImage}
                  isRegenerating={isRegenerating}
                  showActions={true}
                />
              </TabsContent>

              <TabsContent value="admin" className="mt-4 space-y-4">
                {/* Mesh regeneration with provider selection */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Box className="h-4 w-4" />
                    重新生成 3D 網格
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    使用不同供應商重新生成網格模型（不扣點）
                  </p>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={selectedProvider}
                      onValueChange={(v: string) => setSelectedProvider(v as ModelProvider)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="選擇供應商" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PROVIDER_OPTIONS).map(([key, opt]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <span>{opt.label}</span>
                              {opt.badge && (
                                <Badge variant="secondary" className="text-xs">
                                  {opt.badge}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleRegenerateMesh}
                      disabled={isRegenerating || previewStatus === 'processing'}
                    >
                      {previewStatus === 'processing' ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          重新生成
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Mesh preview comparison */}
                  {previewData?.meshUrl && (
                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <p className="text-sm font-medium text-yellow-600 mb-2">
                        預覽準備就緒
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleConfirmMesh}
                          disabled={isRegenerating}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          確認覆蓋
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRejectMesh}
                          disabled={isRegenerating}
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                        >
                          <a
                            href={previewData.meshUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            預覽模型
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Audit log */}
                {pipeline.adminActions && pipeline.adminActions.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-3">
                      <History className="h-4 w-4" />
                      管理員操作紀錄
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {pipeline.adminActions.slice().reverse().map((action, idx) => (
                        <div
                          key={idx}
                          className="text-xs bg-background/50 rounded p-2 flex justify-between items-start"
                        >
                          <div>
                            <span className="font-medium">{action.actionType}</span>
                            <span className="text-muted-foreground mx-1">→</span>
                            <span>{action.targetField}</span>
                            {action.provider && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {action.provider}
                              </Badge>
                            )}
                          </div>
                          <span className="text-muted-foreground">
                            {action.adminEmail}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* 3D Model links */}
            {(pipeline.meshUrl || pipeline.texturedModelUrl) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">3D 模型</p>
                <div className="flex flex-wrap gap-2">
                  {pipeline.meshUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={pipeline.meshUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gap-2"
                      >
                        <Box className="h-4 w-4" />
                        下載網格
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                  {pipeline.texturedModelUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={pipeline.texturedModelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gap-2"
                      >
                        <Palette className="h-4 w-4" />
                        下載貼圖模型
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Pipeline ID */}
            <div className="text-xs text-muted-foreground pt-4 border-t">
              <p>Pipeline ID: {pipeline.id}</p>
              <p>User ID: {pipeline.userId}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
