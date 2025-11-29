'use client';

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type { ViewAngle } from '@/types';

interface GenerateViewsResult {
  success: boolean;
  viewCount: number;
  angles: ViewAngle[];
}

interface RegenerateViewResult {
  success: boolean;
  angle: ViewAngle;
  url: string;
}

interface UploadCustomViewResult {
  success: boolean;
  angle: ViewAngle;
}

/**
 * Hook for view generation operations in the multi-step flow
 */
export function useViewActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generate all views for a session using Gemini AI
   * This is called after the user uploads an image and selects angles
   */
  const generateViews = useCallback(
    async (sessionId: string): Promise<GenerateViewsResult | null> => {
      if (!functions) return null;

      setLoading(true);
      setError(null);

      try {
        const generateViewsFn = httpsCallable<
          { sessionId: string },
          GenerateViewsResult
        >(functions, 'generateSessionViews');

        const result = await generateViewsFn({ sessionId });
        return result.data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to generate views';
        setError(message);
        console.error('Error generating views:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Regenerate a single view (charges 1 credit)
   */
  const regenerateView = useCallback(
    async (
      sessionId: string,
      angle: ViewAngle
    ): Promise<RegenerateViewResult | null> => {
      if (!functions) return null;

      setLoading(true);
      setError(null);

      try {
        const regenerateViewFn = httpsCallable<
          { sessionId: string; angle: ViewAngle },
          RegenerateViewResult
        >(functions, 'regenerateView');

        const result = await regenerateViewFn({ sessionId, angle });
        return result.data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to regenerate view';
        setError(message);
        console.error('Error regenerating view:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Upload a custom view image (no credit charge)
   */
  const uploadCustomView = useCallback(
    async (
      sessionId: string,
      angle: ViewAngle,
      imageUrl: string,
      storagePath: string
    ): Promise<UploadCustomViewResult | null> => {
      if (!functions) return null;

      setLoading(true);
      setError(null);

      try {
        const uploadCustomViewFn = httpsCallable<
          {
            sessionId: string;
            angle: ViewAngle;
            imageUrl: string;
            storagePath: string;
          },
          UploadCustomViewResult
        >(functions, 'uploadCustomView');

        const result = await uploadCustomViewFn({
          sessionId,
          angle,
          imageUrl,
          storagePath,
        });
        return result.data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to upload custom view';
        setError(message);
        console.error('Error uploading custom view:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    generateViews,
    regenerateView,
    uploadCustomView,
    loading,
    error,
    clearError: () => setError(null),
  };
}
