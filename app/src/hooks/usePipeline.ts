/**
 * usePipeline Hook
 *
 * Manages pipeline state for the new simplified 3D generation workflow.
 * Provides real-time Firestore subscription and API call wrappers.
 */

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import type {
  Pipeline,
  PipelineStatus,
  PipelineSettings,
  CreatePipelineResponse,
  GeneratePipelineImagesResponse,
  StartPipelineMeshResponse,
  CheckPipelineStatusResponse,
  StartPipelineTextureResponse,
  PipelineMeshAngle,
  PipelineTextureAngle,
  GenerationModeId,
  ProcessingMode,
  ImageAnalysisResult,
  ModelProvider,
  ProviderOptions,
} from '@/types';

interface SubmitBatchResponse {
  success: boolean;
  batchJobId: string;
  status: PipelineStatus;
}

interface UpdatePipelineAnalysisResponse {
  success: boolean;
  pipelineId: string;
}

interface UsePipelineReturn {
  // Pipeline state
  pipeline: Pipeline | null;
  loading: boolean;
  error: string | null;

  // Actions
  createPipeline: (
    imageUrls: string[],
    settings?: Partial<PipelineSettings>,
    generationMode?: GenerationModeId,
    processingMode?: ProcessingMode,
    userDescription?: string,
    imageAnalysis?: ImageAnalysisResult
  ) => Promise<string>;
  generateImages: (overridePipelineId?: string) => Promise<GeneratePipelineImagesResponse>;
  submitBatch: (overridePipelineId?: string) => Promise<SubmitBatchResponse>;
  regenerateImage: (viewType: 'mesh' | 'texture', angle: string, hint?: string) => Promise<void>;
  startMeshGeneration: (provider?: ModelProvider, providerOptions?: ProviderOptions) => Promise<StartPipelineMeshResponse>;
  checkStatus: () => Promise<CheckPipelineStatusResponse>;
  startTextureGeneration: () => Promise<StartPipelineTextureResponse>;
  updateAnalysis: (imageAnalysis: ImageAnalysisResult, userDescription?: string) => Promise<void>;

  // Navigation helpers
  currentStep: number;
  canProceed: boolean;
  isBatchProcessing: boolean;
}

/**
 * Convert Firestore timestamps to Date objects
 */
function convertTimestamps(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object') {
      if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
        result[key] = (value as { toDate: () => Date }).toDate();
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'object' ? convertTimestamps(item as Record<string, unknown>) : item
        );
      } else {
        result[key] = convertTimestamps(value as Record<string, unknown>);
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Get step number from pipeline status
 */
function getStepFromStatus(status: PipelineStatus): number {
  switch (status) {
    case 'draft':
      return 1;
    case 'batch-queued':
    case 'batch-processing':
    case 'generating-images':
      return 2;
    case 'images-ready':
      return 3;
    case 'generating-mesh':
      return 4;
    case 'mesh-ready':
      return 5;
    case 'generating-texture':
      return 6;
    case 'completed':
      return 7;
    case 'failed':
      return 0;
    default:
      return 1;
  }
}

export function usePipeline(pipelineId: string | null): UsePipelineReturn {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to pipeline document
  useEffect(() => {
    if (!pipelineId) {
      setPipeline(null);
      setLoading(false);
      return;
    }

    // Check if Firebase is available
    if (!db) {
      setError('Firebase not initialized');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      doc(db, 'pipelines', pipelineId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const converted = convertTimestamps(data) as Omit<Pipeline, 'id'>;
          setPipeline({
            id: snapshot.id,
            ...converted,
          } as Pipeline);
        } else {
          setPipeline(null);
          setError('Pipeline not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Pipeline subscription error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [pipelineId]);

  // Create new pipeline
  const createPipeline = useCallback(
    async (
      imageUrls: string[],
      settings?: Partial<PipelineSettings>,
      generationMode?: GenerationModeId,
      processingMode?: ProcessingMode,
      userDescription?: string,
      imageAnalysis?: ImageAnalysisResult
    ): Promise<string> => {
      if (!functions) {
        throw new Error('Firebase not initialized');
      }

      try {
        const createPipelineFn = httpsCallable<
          {
            imageUrls: string[];
            settings?: Partial<PipelineSettings>;
            generationMode?: GenerationModeId;
            processingMode?: ProcessingMode;
            userDescription?: string;
            imageAnalysis?: ImageAnalysisResult;
          },
          CreatePipelineResponse
        >(functions, 'createPipeline');

        const result = await createPipelineFn({
          imageUrls,
          settings,
          generationMode,
          processingMode,
          userDescription,
          imageAnalysis,
        });
        return result.data.pipelineId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create pipeline';
        setError(message);
        throw err;
      }
    },
    []
  );

  // Generate all 6 images (realtime mode)
  // Accepts optional overridePipelineId for immediate use after creation
  const generateImages = useCallback(async (overridePipelineId?: string): Promise<GeneratePipelineImagesResponse> => {
    const targetPipelineId = overridePipelineId || pipelineId;
    if (!targetPipelineId) {
      throw new Error('No pipeline ID');
    }
    if (!functions) {
      throw new Error('Firebase not initialized');
    }

    try {
      const generateFn = httpsCallable<
        { pipelineId: string },
        GeneratePipelineImagesResponse
      >(functions, 'generatePipelineImages', { timeout: 120000 });

      const result = await generateFn({ pipelineId: targetPipelineId });
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate images';
      setError(message);
      throw err;
    }
  }, [pipelineId]);

  // Submit batch job for image generation (batch mode)
  // Uses Gemini Batch API for 50% cost savings, async processing
  const submitBatch = useCallback(async (overridePipelineId?: string): Promise<SubmitBatchResponse> => {
    const targetPipelineId = overridePipelineId || pipelineId;
    if (!targetPipelineId) {
      throw new Error('No pipeline ID');
    }
    if (!functions) {
      throw new Error('Firebase not initialized');
    }

    try {
      const submitBatchFn = httpsCallable<
        { pipelineId: string },
        SubmitBatchResponse
      >(functions, 'submitGeminiBatch');

      const result = await submitBatchFn({ pipelineId: targetPipelineId });
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit batch job';
      setError(message);
      throw err;
    }
  }, [pipelineId]);

  // Regenerate single image with optional hint for adjustments
  const regenerateImage = useCallback(
    async (viewType: 'mesh' | 'texture', angle: string, hint?: string): Promise<void> => {
      if (!pipelineId) {
        throw new Error('No pipeline ID');
      }
      if (!functions) {
        throw new Error('Firebase not initialized');
      }

      try {
        const regenerateFn = httpsCallable<
          { pipelineId: string; viewType: string; angle: string; hint?: string },
          { viewType: string; angle: string }
        >(functions, 'regeneratePipelineImage');

        await regenerateFn({ pipelineId, viewType, angle, hint });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to regenerate image';
        setError(message);
        throw err;
      }
    },
    [pipelineId]
  );

  // Start mesh generation with optional provider selection
  const startMeshGeneration = useCallback(async (
    provider?: ModelProvider,
    providerOptions?: ProviderOptions
  ): Promise<StartPipelineMeshResponse> => {
    if (!pipelineId) {
      throw new Error('No pipeline ID');
    }
    if (!functions) {
      throw new Error('Firebase not initialized');
    }

    try {
      const startMeshFn = httpsCallable<
        { pipelineId: string; provider?: ModelProvider; providerOptions?: ProviderOptions },
        StartPipelineMeshResponse
      >(functions, 'startPipelineMesh');

      const result = await startMeshFn({ pipelineId, provider, providerOptions });
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start mesh generation';
      setError(message);
      throw err;
    }
  }, [pipelineId]);

  // Check pipeline status
  const checkStatus = useCallback(async (): Promise<CheckPipelineStatusResponse> => {
    if (!pipelineId) {
      throw new Error('No pipeline ID');
    }
    if (!functions) {
      throw new Error('Firebase not initialized');
    }

    try {
      const checkStatusFn = httpsCallable<
        { pipelineId: string },
        CheckPipelineStatusResponse
      >(functions, 'checkPipelineStatus');

      const result = await checkStatusFn({ pipelineId });
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check status';
      setError(message);
      throw err;
    }
  }, [pipelineId]);

  // Start texture generation
  const startTextureGeneration = useCallback(async (): Promise<StartPipelineTextureResponse> => {
    if (!pipelineId) {
      throw new Error('No pipeline ID');
    }
    if (!functions) {
      throw new Error('Firebase not initialized');
    }

    try {
      const startTextureFn = httpsCallable<
        { pipelineId: string },
        StartPipelineTextureResponse
      >(functions, 'startPipelineTexture');

      const result = await startTextureFn({ pipelineId });
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start texture generation';
      setError(message);
      throw err;
    }
  }, [pipelineId]);

  // Update pipeline analysis (for draft pipelines)
  const updateAnalysis = useCallback(async (
    imageAnalysis: ImageAnalysisResult,
    userDescription?: string
  ): Promise<void> => {
    if (!pipelineId) {
      throw new Error('No pipeline ID');
    }
    if (!functions) {
      throw new Error('Firebase not initialized');
    }

    try {
      const updateFn = httpsCallable<
        { pipelineId: string; imageAnalysis: ImageAnalysisResult; userDescription?: string },
        UpdatePipelineAnalysisResponse
      >(functions, 'updatePipelineAnalysis');

      await updateFn({ pipelineId, imageAnalysis, userDescription });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update analysis';
      setError(message);
      throw err;
    }
  }, [pipelineId]);

  // Computed values
  const currentStep = pipeline ? getStepFromStatus(pipeline.status) : 0;

  const canProceed = pipeline
    ? (pipeline.status === 'images-ready' ||
        pipeline.status === 'mesh-ready' ||
        pipeline.status === 'completed')
    : false;

  // Check if pipeline is in batch processing state
  const isBatchProcessing = pipeline
    ? (pipeline.status === 'batch-queued' || pipeline.status === 'batch-processing')
    : false;

  return {
    pipeline,
    loading,
    error,
    createPipeline,
    generateImages,
    submitBatch,
    regenerateImage,
    startMeshGeneration,
    checkStatus,
    startTextureGeneration,
    updateAnalysis,
    currentStep,
    canProceed,
    isBatchProcessing,
  };
}
