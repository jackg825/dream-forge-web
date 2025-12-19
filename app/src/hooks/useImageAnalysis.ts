/**
 * useImageAnalysis Hook
 *
 * Manages image analysis state for the pre-upload Gemini analysis feature.
 * Provides analysis API calls and local state management for editing.
 */

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type {
  ImageAnalysisResult,
  AnalyzeImageResponse,
  PrinterType,
  StyleId,
} from '@/types';

interface UseImageAnalysisReturn {
  // Analysis state
  analysis: ImageAnalysisResult | null;
  loading: boolean;
  error: string | null;

  // Actions
  analyzeImage: (
    imageUrl: string,
    colorCount?: number,
    printerType?: PrinterType,
    locale?: string,
    selectedStyle?: StyleId
  ) => Promise<ImageAnalysisResult>;
  setAnalysis: (analysis: ImageAnalysisResult | null) => void;
  updateDescription: (description: string) => void;
  updateColors: (colors: string[]) => void;
  addColor: (color: string) => void;
  removeColor: (index: number) => void;
  updateColor: (index: number, color: string) => void;
  reset: () => void;

  // Derived state
  hasEdits: boolean;
}

/**
 * Hook for managing image analysis
 */
export function useImageAnalysis(): UseImageAnalysisReturn {
  const [analysis, setAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [originalAnalysis, setOriginalAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Analyze an uploaded image with optional style context
   */
  const analyzeImage = useCallback(
    async (
      imageUrl: string,
      colorCount: number = 7,
      printerType: PrinterType = 'fdm',
      locale: string = 'zh-TW',
      selectedStyle?: StyleId
    ): Promise<ImageAnalysisResult> => {
      if (!functions) {
        throw new Error('Firebase not initialized');
      }

      setLoading(true);
      setError(null);

      try {
        const analyzeFn = httpsCallable<
          { imageUrl: string; colorCount: number; printerType: PrinterType; locale: string; selectedStyle?: StyleId },
          AnalyzeImageResponse
        >(functions, 'analyzeUploadedImage');

        const result = await analyzeFn({ imageUrl, colorCount, printerType, locale, selectedStyle });
        const analysisResult = result.data.analysis;

        // Convert timestamp to Date
        const analysisWithDate: ImageAnalysisResult = {
          ...analysisResult,
          analyzedAt: new Date(
            (analysisResult.analyzedAt as unknown as { _seconds: number })._seconds * 1000
          ),
        };

        setAnalysis(analysisWithDate);
        setOriginalAnalysis(analysisWithDate);

        return analysisWithDate;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Set analysis from external source (e.g., loaded from Firestore)
   * This is used to restore analysis when loading a draft pipeline
   */
  const setAnalysisExternal = useCallback((newAnalysis: ImageAnalysisResult | null) => {
    setAnalysis(newAnalysis);
    setOriginalAnalysis(newAnalysis);
    setError(null);
  }, []);

  /**
   * Update the description
   */
  const updateDescription = useCallback((description: string) => {
    setAnalysis((prev) => {
      if (!prev) return prev;
      return { ...prev, description };
    });
  }, []);

  /**
   * Update all colors at once
   */
  const updateColors = useCallback((colors: string[]) => {
    setAnalysis((prev) => {
      if (!prev) return prev;
      return { ...prev, colorPalette: colors };
    });
  }, []);

  /**
   * Add a new color
   */
  const addColor = useCallback((color: string) => {
    setAnalysis((prev) => {
      if (!prev) return prev;
      // Max 12 colors
      if (prev.colorPalette.length >= 12) return prev;
      return {
        ...prev,
        colorPalette: [...prev.colorPalette, color.toUpperCase()],
      };
    });
  }, []);

  /**
   * Remove a color by index
   */
  const removeColor = useCallback((index: number) => {
    setAnalysis((prev) => {
      if (!prev) return prev;
      // Min 3 colors
      if (prev.colorPalette.length <= 3) return prev;
      const newColors = [...prev.colorPalette];
      newColors.splice(index, 1);
      return { ...prev, colorPalette: newColors };
    });
  }, []);

  /**
   * Update a single color by index
   */
  const updateColor = useCallback((index: number, color: string) => {
    setAnalysis((prev) => {
      if (!prev || index < 0 || index >= prev.colorPalette.length) return prev;
      const newColors = [...prev.colorPalette];
      newColors[index] = color.toUpperCase();
      return { ...prev, colorPalette: newColors };
    });
  }, []);

  /**
   * Reset to original analysis
   */
  const reset = useCallback(() => {
    setAnalysis(originalAnalysis);
    setError(null);
  }, [originalAnalysis]);

  /**
   * Check if there are any edits
   */
  const hasEdits =
    analysis !== null &&
    originalAnalysis !== null &&
    (analysis.description !== originalAnalysis.description ||
      JSON.stringify(analysis.colorPalette) !==
        JSON.stringify(originalAnalysis.colorPalette));

  return {
    analysis,
    loading,
    error,
    analyzeImage,
    setAnalysis: setAnalysisExternal,
    updateDescription,
    updateColors,
    addColor,
    removeColor,
    updateColor,
    reset,
    hasEdits,
  };
}
