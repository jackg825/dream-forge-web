'use client';

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface StartGenerationResult {
  success: boolean;
  jobId: string;
  status: string;
}

interface CheckStatusResult {
  status: 'pending' | 'generating-model' | 'completed' | 'failed';
  outputModelUrl?: string;
  error?: string;
}

/**
 * Hook for model generation operations in the multi-step flow
 */
export function useModelActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Start 3D model generation from session views
   */
  const startModelGeneration = useCallback(
    async (sessionId: string): Promise<StartGenerationResult | null> => {
      if (!functions) return null;

      setLoading(true);
      setError(null);

      try {
        const startGenerationFn = httpsCallable<
          { sessionId: string },
          StartGenerationResult
        >(functions, 'startSessionModelGeneration');

        const result = await startGenerationFn({ sessionId });
        return result.data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to start generation';
        setError(message);
        console.error('Error starting model generation:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Check model generation status and get result
   */
  const checkModelStatus = useCallback(
    async (sessionId: string): Promise<CheckStatusResult | null> => {
      if (!functions) return null;

      setLoading(true);
      setError(null);

      try {
        const checkStatusFn = httpsCallable<
          { sessionId: string },
          CheckStatusResult
        >(functions, 'checkSessionModelStatus');

        const result = await checkStatusFn({ sessionId });
        return result.data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to check status';
        setError(message);
        console.error('Error checking model status:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    startModelGeneration,
    checkModelStatus,
    loading,
    error,
    clearError: () => setError(null),
  };
}
