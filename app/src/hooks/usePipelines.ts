'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { deferStateUpdate } from '@/lib/defer-state-update';
import type { Pipeline, PipelineStatus } from '@/types';

interface PipelineInputImageData {
  url: string;
  storagePath: string;
  uploadedAt?: { toDate?: () => Date };
}

interface UsePipelinesReturn {
  pipelines: Pipeline[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook for fetching user's pipelines with real-time updates
 */
export function usePipelines(
  userId: string | undefined,
  filterStatus?: PipelineStatus,
  maxItems: number = 50
): UsePipelinesReturn {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !db) {
      return deferStateUpdate(() => {
        setPipelines([]);
        setLoading(false);
      });
    }

    const cancelPendingState = deferStateUpdate(() => {
      setLoading(true);
      setError(null);
    });

    // Build query
    const q = query(
      collection(db, 'pipelines'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(maxItems)
    );

    // Note: Adding status filter requires composite index
    // For now, we filter client-side

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const pipelineList: Pipeline[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();

          // Convert Firestore timestamps to Dates
          const pipeline: Pipeline = {
            id: doc.id,
            userId: data.userId,
            status: data.status,
            processingMode: data.processingMode || 'batch',
            batchJobId: data.batchJobId,
            batchProgress: data.batchProgress,
            estimatedCompletionTime: data.estimatedCompletionTime?.toDate?.(),
            generationMode: data.generationMode || 'simplified-mesh',
            inputImages: ((data.inputImages || []) as PipelineInputImageData[]).map((img) => ({
              url: img.url,
              storagePath: img.storagePath,
              uploadedAt: img.uploadedAt?.toDate?.() || new Date(),
            })),
            meshImages: data.meshImages || {},
            meshyMeshTaskId: data.meshyMeshTaskId,
            meshUrl: data.meshUrl,
            meshStoragePath: data.meshStoragePath,
            meshDownloadFiles: data.meshDownloadFiles,
            meshyTextureTaskId: data.meshyTextureTaskId,
            texturedModelUrl: data.texturedModelUrl,
            texturedModelStoragePath: data.texturedModelStoragePath,
            texturedDownloadFiles: data.texturedDownloadFiles,
            creditsCharged: data.creditsCharged || { mesh: 0, texture: 0 },
            settings: data.settings || { quality: 'standard', printerType: 'fdm', format: 'glb' },
            userDescription: data.userDescription,
            error: data.error,
            errorStep: data.errorStep,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
            completedAt: data.completedAt?.toDate?.(),
          };

          // Client-side status filter
          if (!filterStatus || pipeline.status === filterStatus) {
            pipelineList.push(pipeline);
          }
        });

        setPipelines(pipelineList);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching pipelines:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      cancelPendingState();
      unsubscribe();
    };
  }, [userId, filterStatus, maxItems]);

  return { pipelines, loading, error };
}
