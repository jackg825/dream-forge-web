'use client';

/**
 * React hook for mesh optimization API
 *
 * Provides functions to analyze and optimize 3D meshes for printing.
 */

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

// ============================================
// Types
// ============================================

export interface MeshStats {
  vertexCount: number;
  faceCount: number;
  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };
  isWatertight: boolean;
  volume: number | null;
}

export interface MeshAnalysis extends MeshStats {
  issues: string[];
  recommendations: string[];
  printabilityScore: number;
}

export interface OptimizationPreview {
  original: MeshStats;
  optimized: MeshStats;
  reductionPercent: number;
  operations: string[];
  warnings: string[];
}

export interface SimplifyOptions {
  enabled: boolean;
  targetRatio?: number;
  preserveTopology?: boolean;
}

export interface RepairOptions {
  enabled: boolean;
  fillHoles?: boolean;
  fixNormals?: boolean;
  makeWatertight?: boolean;
}

export interface ScaleOptions {
  enabled: boolean;
  targetSize?: {
    width?: number;
    height?: number;
    depth?: number;
  };
  uniformScale?: number;
  printBedSize?: {
    width: number;
    height: number;
    depth: number;
  };
}

export interface OptimizationOptions {
  simplify?: SimplifyOptions;
  repair?: RepairOptions;
  scale?: ScaleOptions;
}

export interface OptimizeRequest {
  pipelineId?: string;
  jobId?: string;
  modelUrl?: string;
  options: OptimizationOptions;
  outputFormat?: 'glb' | 'stl';
  previewOnly?: boolean;
}

export interface OptimizeResponse {
  success: boolean;
  preview: OptimizationPreview;
  optimizedModelUrl?: string;
  optimizedStoragePath?: string;
  error?: string;
}

export interface AnalyzeResponse {
  success: boolean;
  analysis?: MeshAnalysis;
  error?: string;
}

// ============================================
// Hook
// ============================================

export function useMeshOptimization() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MeshAnalysis | null>(null);
  const [preview, setPreview] = useState<OptimizationPreview | null>(null);
  const [optimizedUrl, setOptimizedUrl] = useState<string | null>(null);

  /**
   * Analyze a mesh without modifying it
   */
  const analyze = useCallback(
    async (params: {
      pipelineId?: string;
      jobId?: string;
      modelUrl?: string;
    }): Promise<AnalyzeResponse> => {
      if (!functions) {
        return { success: false, error: 'Firebase not initialized' };
      }

      setIsAnalyzing(true);
      setError(null);

      try {
        const analyzeFn = httpsCallable<
          { pipelineId?: string; jobId?: string; modelUrl?: string },
          AnalyzeResponse
        >(functions, 'analyzeMeshForPrint');

        const result = await analyzeFn(params);

        if (result.data.success && result.data.analysis) {
          setAnalysis(result.data.analysis);
        } else {
          setError(result.data.error || 'Analysis failed');
        }

        return result.data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  /**
   * Preview optimization results without saving
   */
  const previewOptimization = useCallback(
    async (request: OptimizeRequest): Promise<OptimizeResponse> => {
      if (!functions) {
        return {
          success: false,
          error: 'Firebase not initialized',
          preview: {
            original: { vertexCount: 0, faceCount: 0, boundingBox: { width: 0, height: 0, depth: 0 }, isWatertight: false, volume: null },
            optimized: { vertexCount: 0, faceCount: 0, boundingBox: { width: 0, height: 0, depth: 0 }, isWatertight: false, volume: null },
            reductionPercent: 0, operations: [], warnings: [],
          },
        };
      }

      setIsAnalyzing(true);
      setError(null);

      try {
        const optimizeFn = httpsCallable<OptimizeRequest, OptimizeResponse>(
          functions,
          'optimizeMeshForPrint'
        );

        const result = await optimizeFn({
          ...request,
          previewOnly: true,
        });

        if (result.data.success) {
          setPreview(result.data.preview);
        } else {
          setError(result.data.error || 'Preview failed');
        }

        return result.data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Preview failed';
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          preview: {
            original: {
              vertexCount: 0,
              faceCount: 0,
              boundingBox: { width: 0, height: 0, depth: 0 },
              isWatertight: false,
              volume: null,
            },
            optimized: {
              vertexCount: 0,
              faceCount: 0,
              boundingBox: { width: 0, height: 0, depth: 0 },
              isWatertight: false,
              volume: null,
            },
            reductionPercent: 0,
            operations: [],
            warnings: [],
          },
        };
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  /**
   * Run full optimization and save result
   */
  const optimize = useCallback(
    async (request: OptimizeRequest): Promise<OptimizeResponse> => {
      if (!functions) {
        return {
          success: false,
          error: 'Firebase not initialized',
          preview: {
            original: { vertexCount: 0, faceCount: 0, boundingBox: { width: 0, height: 0, depth: 0 }, isWatertight: false, volume: null },
            optimized: { vertexCount: 0, faceCount: 0, boundingBox: { width: 0, height: 0, depth: 0 }, isWatertight: false, volume: null },
            reductionPercent: 0, operations: [], warnings: [],
          },
        };
      }

      setIsOptimizing(true);
      setError(null);

      try {
        const optimizeFn = httpsCallable<OptimizeRequest, OptimizeResponse>(
          functions,
          'optimizeMeshForPrint'
        );

        const result = await optimizeFn({
          ...request,
          previewOnly: false,
        });

        if (result.data.success) {
          setPreview(result.data.preview);
          if (result.data.optimizedModelUrl) {
            setOptimizedUrl(result.data.optimizedModelUrl);
          }
        } else {
          setError(result.data.error || 'Optimization failed');
        }

        return result.data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Optimization failed';
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          preview: {
            original: {
              vertexCount: 0,
              faceCount: 0,
              boundingBox: { width: 0, height: 0, depth: 0 },
              isWatertight: false,
              volume: null,
            },
            optimized: {
              vertexCount: 0,
              faceCount: 0,
              boundingBox: { width: 0, height: 0, depth: 0 },
              isWatertight: false,
              volume: null,
            },
            reductionPercent: 0,
            operations: [],
            warnings: [],
          },
        };
      } finally {
        setIsOptimizing(false);
      }
    },
    []
  );

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setError(null);
    setAnalysis(null);
    setPreview(null);
    setOptimizedUrl(null);
  }, []);

  return {
    // State
    isAnalyzing,
    isOptimizing,
    isLoading: isAnalyzing || isOptimizing,
    error,
    analysis,
    preview,
    optimizedUrl,

    // Actions
    analyze,
    previewOptimization,
    optimize,
    reset,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format dimension in mm
 */
export function formatDimension(mm: number): string {
  if (mm < 1) {
    return `${(mm * 10).toFixed(1)} μm`;
  }
  if (mm < 10) {
    return `${mm.toFixed(2)} mm`;
  }
  if (mm < 100) {
    return `${mm.toFixed(1)} mm`;
  }
  return `${mm.toFixed(0)} mm`;
}

/**
 * Get printability badge color
 */
export function getPrintabilityColor(score: number): string {
  if (score >= 4) return 'text-green-600';
  if (score >= 3) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Get printability label
 */
export function getPrintabilityLabel(score: number): string {
  if (score >= 5) return 'Excellent';
  if (score >= 4) return 'Good';
  if (score >= 3) return 'Fair';
  if (score >= 2) return 'Poor';
  return 'Not Printable';
}
