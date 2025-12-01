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
} from '@/types';

interface UsePipelineReturn {
  // Pipeline state
  pipeline: Pipeline | null;
  loading: boolean;
  error: string | null;

  // Actions
  createPipeline: (
    imageUrls: string[],
    settings?: Partial<PipelineSettings>,
    generationMode?: GenerationModeId
  ) => Promise<string>;
  generateImages: (overridePipelineId?: string) => Promise<GeneratePipelineImagesResponse>;
  regenerateImage: (viewType: 'mesh' | 'texture', angle: string) => Promise<void>;
  startMeshGeneration: () => Promise<StartPipelineMeshResponse>;
  checkStatus: () => Promise<CheckPipelineStatusResponse>;
  startTextureGeneration: () => Promise<StartPipelineTextureResponse>;

  // Navigation helpers
  currentStep: number;
  canProceed: boolean;
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
      generationMode?: GenerationModeId
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
          },
          CreatePipelineResponse
        >(functions, 'createPipeline');

        const result = await createPipelineFn({ imageUrls, settings, generationMode });
        return result.data.pipelineId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create pipeline';
        setError(message);
        throw err;
      }
    },
    []
  );

  // Generate all 6 images
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
      >(functions, 'generatePipelineImages');

      const result = await generateFn({ pipelineId: targetPipelineId });
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate images';
      setError(message);
      throw err;
    }
  }, [pipelineId]);

  // Regenerate single image
  const regenerateImage = useCallback(
    async (viewType: 'mesh' | 'texture', angle: string): Promise<void> => {
      if (!pipelineId) {
        throw new Error('No pipeline ID');
      }
      if (!functions) {
        throw new Error('Firebase not initialized');
      }

      try {
        const regenerateFn = httpsCallable<
          { pipelineId: string; viewType: string; angle: string },
          { viewType: string; angle: string }
        >(functions, 'regeneratePipelineImage');

        await regenerateFn({ pipelineId, viewType, angle });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to regenerate image';
        setError(message);
        throw err;
      }
    },
    [pipelineId]
  );

  // Start mesh generation
  const startMeshGeneration = useCallback(async (): Promise<StartPipelineMeshResponse> => {
    if (!pipelineId) {
      throw new Error('No pipeline ID');
    }
    if (!functions) {
      throw new Error('Firebase not initialized');
    }

    try {
      const startMeshFn = httpsCallable<
        { pipelineId: string },
        StartPipelineMeshResponse
      >(functions, 'startPipelineMesh');

      const result = await startMeshFn({ pipelineId });
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

  // Computed values
  const currentStep = pipeline ? getStepFromStatus(pipeline.status) : 0;

  const canProceed = pipeline
    ? (pipeline.status === 'images-ready' ||
        pipeline.status === 'mesh-ready' ||
        pipeline.status === 'completed')
    : false;

  return {
    pipeline,
    loading,
    error,
    createPipeline,
    generateImages,
    regenerateImage,
    startMeshGeneration,
    checkStatus,
    startTextureGeneration,
    currentStep,
    canProceed,
  };
}
