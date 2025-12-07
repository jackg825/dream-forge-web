'use client';

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type {
  AdminPreview,
  PipelineMeshAngle,
  PipelineTextureAngle,
  PipelineProcessedImage,
  ModelProvider,
  ProviderOptions,
  DownloadFile,
} from '@/types';

type PreviewStatus = 'idle' | 'generating' | 'processing' | 'ready' | 'confirming' | 'failed';

interface UseAdminPipelineRegenerationReturn {
  // State
  isRegenerating: boolean;
  previewStatus: PreviewStatus;
  previewData: AdminPreview | null;
  error: string | null;

  // Image regeneration
  regenerateImage: (
    pipelineId: string,
    viewType: 'mesh' | 'texture',
    angle: PipelineMeshAngle | PipelineTextureAngle,
    hint?: string
  ) => Promise<PipelineProcessedImage | null>;

  // Mesh regeneration
  regenerateMesh: (
    pipelineId: string,
    provider: ModelProvider,
    providerOptions?: ProviderOptions
  ) => Promise<{ taskId: string; provider: ModelProvider } | null>;

  // Check preview status (for mesh)
  checkPreviewStatus: (pipelineId: string) => Promise<{
    status: string;
    progress?: number;
    meshUrl?: string;
    downloadFiles?: DownloadFile[];
    error?: string;
  } | null>;

  // Confirm/Reject
  confirmPreview: (
    pipelineId: string,
    targetField: 'meshImages' | 'textureImages' | 'mesh',
    angle?: string
  ) => Promise<boolean>;

  rejectPreview: (
    pipelineId: string,
    targetField: 'meshImages' | 'textureImages' | 'mesh' | 'all',
    angle?: string
  ) => Promise<boolean>;

  // Utilities
  clearError: () => void;
  setPreviewData: (data: AdminPreview | null) => void;
}

// Response types for Cloud Functions
interface RegenerateImageResponse {
  success: boolean;
  viewType: 'mesh' | 'texture';
  angle: string;
  previewImage: PipelineProcessedImage;
}

interface StartMeshResponse {
  success: boolean;
  taskId: string;
  provider: ModelProvider;
}

interface CheckPreviewStatusResponse {
  success: boolean;
  status: string;
  progress?: number;
  meshUrl?: string;
  downloadFiles?: DownloadFile[];
  error?: string;
  preview?: AdminPreview;
}

interface ConfirmPreviewResponse {
  success: boolean;
  confirmedField: string;
}

interface RejectPreviewResponse {
  success: boolean;
  rejectedField: string;
}

export function useAdminPipelineRegeneration(): UseAdminPipelineRegenerationReturn {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [previewData, setPreviewData] = useState<AdminPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const regenerateImage = useCallback(async (
    pipelineId: string,
    viewType: 'mesh' | 'texture',
    angle: PipelineMeshAngle | PipelineTextureAngle,
    hint?: string
  ): Promise<PipelineProcessedImage | null> => {
    if (!functions) {
      setError('Firebase not initialized');
      return null;
    }

    setIsRegenerating(true);
    setPreviewStatus('generating');
    setError(null);

    try {
      const adminRegenerateFunc = httpsCallable<
        { pipelineId: string; viewType: string; angle: string; hint?: string },
        RegenerateImageResponse
      >(functions, 'adminRegeneratePipelineImage');

      const result = await adminRegenerateFunc({
        pipelineId,
        viewType,
        angle,
        hint,
      });

      if (result.data.success) {
        // Update local preview data
        setPreviewData((prev) => {
          const updated = { ...prev } as AdminPreview;
          if (viewType === 'mesh') {
            updated.meshImages = {
              ...updated.meshImages,
              [angle]: result.data.previewImage,
            };
          } else {
            updated.textureImages = {
              ...updated.textureImages,
              [angle]: result.data.previewImage,
            };
          }
          return updated;
        });
        setPreviewStatus('ready');
        return result.data.previewImage;
      }

      setPreviewStatus('idle');
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image regeneration failed';
      setError(message);
      setPreviewStatus('failed');
      console.error('Error regenerating image:', err);
      return null;
    } finally {
      setIsRegenerating(false);
    }
  }, []);

  const regenerateMesh = useCallback(async (
    pipelineId: string,
    provider: ModelProvider,
    providerOptions?: ProviderOptions
  ): Promise<{ taskId: string; provider: ModelProvider } | null> => {
    if (!functions) {
      setError('Firebase not initialized');
      return null;
    }

    setIsRegenerating(true);
    setPreviewStatus('generating');
    setError(null);

    try {
      const adminStartMeshFunc = httpsCallable<
        { pipelineId: string; provider: ModelProvider; providerOptions?: ProviderOptions },
        StartMeshResponse
      >(functions, 'adminStartPipelineMesh');

      const result = await adminStartMeshFunc({
        pipelineId,
        provider,
        providerOptions,
      });

      if (result.data.success) {
        setPreviewData((prev) => ({
          ...prev,
          provider: result.data.provider,
          taskId: result.data.taskId,
          taskStatus: 'pending',
        }));
        setPreviewStatus('processing');
        return {
          taskId: result.data.taskId,
          provider: result.data.provider,
        };
      }

      setPreviewStatus('idle');
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mesh regeneration failed';
      setError(message);
      setPreviewStatus('failed');
      console.error('Error regenerating mesh:', err);
      return null;
    } finally {
      setIsRegenerating(false);
    }
  }, []);

  const checkPreviewStatus = useCallback(async (pipelineId: string) => {
    if (!functions) {
      setError('Firebase not initialized');
      return null;
    }

    try {
      const checkStatusFunc = httpsCallable<
        { pipelineId: string },
        CheckPreviewStatusResponse
      >(functions, 'adminCheckPreviewStatus');

      const result = await checkStatusFunc({ pipelineId });

      if (result.data.success) {
        if (result.data.status === 'completed') {
          setPreviewData((prev) => ({
            ...prev,
            meshUrl: result.data.meshUrl,
            meshDownloadFiles: result.data.downloadFiles,
            taskStatus: 'completed',
          }));
          setPreviewStatus('ready');
        } else if (result.data.status === 'failed') {
          setPreviewStatus('failed');
          setError(result.data.error || 'Mesh generation failed');
        } else if (result.data.status === 'processing') {
          setPreviewStatus('processing');
        }

        return {
          status: result.data.status,
          progress: result.data.progress,
          meshUrl: result.data.meshUrl,
          downloadFiles: result.data.downloadFiles,
          error: result.data.error,
        };
      }

      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Status check failed';
      setError(message);
      console.error('Error checking preview status:', err);
      return null;
    }
  }, []);

  const confirmPreview = useCallback(async (
    pipelineId: string,
    targetField: 'meshImages' | 'textureImages' | 'mesh',
    angle?: string
  ): Promise<boolean> => {
    if (!functions) {
      setError('Firebase not initialized');
      return false;
    }

    setPreviewStatus('confirming');
    setError(null);

    try {
      const confirmFunc = httpsCallable<
        { pipelineId: string; targetField: string; angle?: string },
        ConfirmPreviewResponse
      >(functions, 'adminConfirmPreview');

      const result = await confirmFunc({
        pipelineId,
        targetField,
        angle,
      });

      if (result.data.success) {
        // Clear the confirmed preview data
        setPreviewData((prev) => {
          if (!prev) return null;
          const updated = { ...prev };

          if (targetField === 'meshImages' && angle) {
            if (updated.meshImages) {
              delete updated.meshImages[angle as PipelineMeshAngle];
            }
          } else if (targetField === 'textureImages' && angle) {
            if (updated.textureImages) {
              delete updated.textureImages[angle as PipelineTextureAngle];
            }
          } else if (targetField === 'mesh') {
            delete updated.meshUrl;
            delete updated.meshStoragePath;
            delete updated.meshDownloadFiles;
            delete updated.taskId;
            delete updated.taskStatus;
            delete updated.provider;
          }

          // Check if preview is now empty
          const hasContent =
            (updated.meshImages && Object.keys(updated.meshImages).length > 0) ||
            (updated.textureImages && Object.keys(updated.textureImages).length > 0) ||
            updated.meshUrl;

          return hasContent ? updated : null;
        });

        setPreviewStatus('idle');
        return true;
      }

      setPreviewStatus('ready');
      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Confirm failed';
      setError(message);
      setPreviewStatus('ready');
      console.error('Error confirming preview:', err);
      return false;
    }
  }, []);

  const rejectPreview = useCallback(async (
    pipelineId: string,
    targetField: 'meshImages' | 'textureImages' | 'mesh' | 'all',
    angle?: string
  ): Promise<boolean> => {
    if (!functions) {
      setError('Firebase not initialized');
      return false;
    }

    setError(null);

    try {
      const rejectFunc = httpsCallable<
        { pipelineId: string; targetField: string; angle?: string },
        RejectPreviewResponse
      >(functions, 'adminRejectPreview');

      const result = await rejectFunc({
        pipelineId,
        targetField,
        angle,
      });

      if (result.data.success) {
        if (targetField === 'all') {
          setPreviewData(null);
        } else {
          setPreviewData((prev) => {
            if (!prev) return null;
            const updated = { ...prev };

            if (targetField === 'meshImages' && angle) {
              if (updated.meshImages) {
                delete updated.meshImages[angle as PipelineMeshAngle];
              }
            } else if (targetField === 'textureImages' && angle) {
              if (updated.textureImages) {
                delete updated.textureImages[angle as PipelineTextureAngle];
              }
            } else if (targetField === 'mesh') {
              delete updated.meshUrl;
              delete updated.meshStoragePath;
              delete updated.meshDownloadFiles;
              delete updated.taskId;
              delete updated.taskStatus;
              delete updated.provider;
            }

            const hasContent =
              (updated.meshImages && Object.keys(updated.meshImages).length > 0) ||
              (updated.textureImages && Object.keys(updated.textureImages).length > 0) ||
              updated.meshUrl;

            return hasContent ? updated : null;
          });
        }

        setPreviewStatus('idle');
        return true;
      }

      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reject failed';
      setError(message);
      console.error('Error rejecting preview:', err);
      return false;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isRegenerating,
    previewStatus,
    previewData,
    error,
    regenerateImage,
    regenerateMesh,
    checkPreviewStatus,
    confirmPreview,
    rejectPreview,
    clearError,
    setPreviewData,
  };
}
