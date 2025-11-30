'use client';

import { useReducer, useCallback, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useGenerateModel } from '@/hooks/useJobs';
import { functions, storage } from '@/lib/firebase';
import type {
  H2CStep,
  H2COptimizeStatus,
  H2COptimizeResponse,
  H2CUploadEditedResponse,
  QualityLevel,
  ModelProvider,
  H2C_CREDIT_COSTS,
} from '@/types';

// ============================================
// State Types
// ============================================

interface OriginalImage {
  file: File | null;
  url: string | null;
  storagePath: string | null;
}

interface OptimizedImage {
  url: string | null;
  storagePath: string | null;
}

interface H2CState {
  step: H2CStep;

  // Step 1: Original image
  originalImage: OriginalImage;
  uploadProgress: number;
  uploadError: string | null;

  // Step 2: Optimization
  optimizeStatus: H2COptimizeStatus;
  optimizedImage: OptimizedImage;
  colorPalette: string[];
  optimizeError: string | null;

  // Step 3: 3D Generation
  provider: ModelProvider;
  quality: QualityLevel;
  generateJobId: string | null;
  generating: boolean;
  generateError: string | null;
}

// ============================================
// Action Types
// ============================================

type H2CAction =
  | { type: 'SET_STEP'; payload: H2CStep }
  | { type: 'SET_UPLOAD_PROGRESS'; payload: number }
  | { type: 'SET_UPLOAD_ERROR'; payload: string | null }
  | {
      type: 'SET_ORIGINAL_IMAGE';
      payload: { file: File | null; url: string | null; storagePath: string | null };
    }
  | { type: 'SET_OPTIMIZE_STATUS'; payload: H2COptimizeStatus }
  | { type: 'SET_OPTIMIZED_IMAGE'; payload: OptimizedImage }
  | { type: 'SET_COLOR_PALETTE'; payload: string[] }
  | { type: 'SET_OPTIMIZE_ERROR'; payload: string | null }
  | { type: 'SET_PROVIDER'; payload: ModelProvider }
  | { type: 'SET_QUALITY'; payload: QualityLevel }
  | { type: 'SET_GENERATE_JOB_ID'; payload: string | null }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'SET_GENERATE_ERROR'; payload: string | null }
  | { type: 'GO_TO_OPTIMIZE' }
  | { type: 'GO_TO_GENERATE' }
  | { type: 'RESET' };

// ============================================
// Initial State
// ============================================

const initialState: H2CState = {
  step: 'upload',
  originalImage: { file: null, url: null, storagePath: null },
  uploadProgress: 0,
  uploadError: null,
  optimizeStatus: 'idle',
  optimizedImage: { url: null, storagePath: null },
  colorPalette: [],
  optimizeError: null,
  provider: 'meshy',
  quality: 'standard',
  generateJobId: null,
  generating: false,
  generateError: null,
};

// ============================================
// Reducer
// ============================================

function h2cReducer(state: H2CState, action: H2CAction): H2CState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload };

    case 'SET_UPLOAD_PROGRESS':
      return { ...state, uploadProgress: action.payload };

    case 'SET_UPLOAD_ERROR':
      return { ...state, uploadError: action.payload };

    case 'SET_ORIGINAL_IMAGE':
      return { ...state, originalImage: action.payload };

    case 'SET_OPTIMIZE_STATUS':
      return { ...state, optimizeStatus: action.payload };

    case 'SET_OPTIMIZED_IMAGE':
      return { ...state, optimizedImage: action.payload };

    case 'SET_COLOR_PALETTE':
      return { ...state, colorPalette: action.payload };

    case 'SET_OPTIMIZE_ERROR':
      return { ...state, optimizeError: action.payload };

    case 'SET_PROVIDER':
      return { ...state, provider: action.payload };

    case 'SET_QUALITY':
      return { ...state, quality: action.payload };

    case 'SET_GENERATE_JOB_ID':
      return { ...state, generateJobId: action.payload };

    case 'SET_GENERATING':
      return { ...state, generating: action.payload };

    case 'SET_GENERATE_ERROR':
      return { ...state, generateError: action.payload };

    case 'GO_TO_OPTIMIZE':
      return { ...state, step: 'optimize' };

    case 'GO_TO_GENERATE':
      return { ...state, step: 'generate' };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============================================
// Hook
// ============================================

/**
 * Custom hook for H2C 7-color optimization workflow
 * Manages the complete flow: Upload → Optimize → Generate 3D
 */
export function useH2COptimize() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { credits, loading: creditsLoading } = useCredits(user?.uid);
  const { generate: generateModel } = useGenerateModel();

  const [state, dispatch] = useReducer(h2cReducer, initialState);

  // ============================================
  // Step 1: Upload Original Image
  // ============================================

  const uploadOriginal = useCallback(
    async (file: File): Promise<boolean> => {
      if (!user || !storage) {
        dispatch({ type: 'SET_UPLOAD_ERROR', payload: '請先登入' });
        return false;
      }

      try {
        dispatch({ type: 'SET_UPLOAD_ERROR', payload: null });
        dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 0 });

        // Validate file
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          dispatch({ type: 'SET_UPLOAD_ERROR', payload: '不支援的圖片格式' });
          return false;
        }

        if (file.size > 10 * 1024 * 1024) {
          dispatch({ type: 'SET_UPLOAD_ERROR', payload: '圖片過大，請上傳小於 10MB 的圖片' });
          return false;
        }

        // Upload to Firebase Storage
        const timestamp = Date.now();
        const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png';
        const storagePath = `h2c/${user.uid}/${timestamp}_original.${extension}`;
        const storageRef = ref(storage, storagePath);

        dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 30 });

        await uploadBytes(storageRef, file);
        dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 70 });

        const url = await getDownloadURL(storageRef);
        dispatch({ type: 'SET_UPLOAD_PROGRESS', payload: 100 });

        dispatch({
          type: 'SET_ORIGINAL_IMAGE',
          payload: { file, url, storagePath },
        });

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : '上傳失敗';
        dispatch({ type: 'SET_UPLOAD_ERROR', payload: message });
        return false;
      }
    },
    [user]
  );

  // ============================================
  // Step 2: Optimize Colors
  // ============================================

  const optimizeColors = useCallback(async (): Promise<boolean> => {
    if (!user || !functions || !state.originalImage.url) {
      dispatch({ type: 'SET_OPTIMIZE_ERROR', payload: '請先上傳圖片' });
      return false;
    }

    try {
      dispatch({ type: 'SET_OPTIMIZE_STATUS', payload: 'optimizing' });
      dispatch({ type: 'SET_OPTIMIZE_ERROR', payload: null });
      dispatch({ type: 'SET_STEP', payload: 'optimize' });

      const optimizeFunction = httpsCallable<
        { imageUrl: string; storagePath?: string },
        H2COptimizeResponse
      >(functions, 'optimizeColorsForH2C');

      const result = await optimizeFunction({
        imageUrl: state.originalImage.url,
        storagePath: state.originalImage.storagePath || undefined,
      });

      if (result.data.success) {
        dispatch({
          type: 'SET_OPTIMIZED_IMAGE',
          payload: {
            url: result.data.optimizedImageUrl,
            storagePath: result.data.optimizedStoragePath,
          },
        });
        dispatch({ type: 'SET_COLOR_PALETTE', payload: result.data.colorPalette });
        dispatch({ type: 'SET_OPTIMIZE_STATUS', payload: 'optimized' });
        // Credits update automatically via realtime listener
        return true;
      } else {
        throw new Error('優化失敗');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '色彩優化失敗';
      dispatch({ type: 'SET_OPTIMIZE_ERROR', payload: message });
      dispatch({ type: 'SET_OPTIMIZE_STATUS', payload: 'error' });
      return false;
    }
  }, [user, state.originalImage]);

  // Re-optimize (costs credit)
  const reOptimize = useCallback(async (): Promise<boolean> => {
    // Reset optimized state and re-run
    dispatch({ type: 'SET_OPTIMIZED_IMAGE', payload: { url: null, storagePath: null } });
    dispatch({ type: 'SET_COLOR_PALETTE', payload: [] });
    return optimizeColors();
  }, [optimizeColors]);

  // ============================================
  // Download Optimized Image
  // ============================================

  const downloadOptimized = useCallback(async () => {
    if (!state.optimizedImage.url) return;

    try {
      const response = await fetch(state.optimizedImage.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `h2c_optimized_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [state.optimizedImage.url]);

  // ============================================
  // Upload Edited Image (free, replaces AI result)
  // ============================================

  const uploadEditedImage = useCallback(
    async (file: File): Promise<boolean> => {
      if (!user || !functions) {
        dispatch({ type: 'SET_OPTIMIZE_ERROR', payload: '請先登入' });
        return false;
      }

      try {
        dispatch({ type: 'SET_OPTIMIZE_STATUS', payload: 'optimizing' });

        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const uploadFunction = httpsCallable<
          { imageBase64: string; mimeType: string },
          H2CUploadEditedResponse
        >(functions, 'uploadEditedH2CImage');

        const result = await uploadFunction({
          imageBase64: base64,
          mimeType: file.type,
        });

        if (result.data.success) {
          dispatch({
            type: 'SET_OPTIMIZED_IMAGE',
            payload: {
              url: result.data.imageUrl,
              storagePath: result.data.storagePath,
            },
          });
          // Clear color palette since user provided their own image
          dispatch({ type: 'SET_COLOR_PALETTE', payload: [] });
          dispatch({ type: 'SET_OPTIMIZE_STATUS', payload: 'optimized' });
          return true;
        } else {
          throw new Error('上傳失敗');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '上傳編輯圖片失敗';
        dispatch({ type: 'SET_OPTIMIZE_ERROR', payload: message });
        dispatch({ type: 'SET_OPTIMIZE_STATUS', payload: 'error' });
        return false;
      }
    },
    [user]
  );

  // ============================================
  // Step 3: Generate 3D Model
  // ============================================

  const generate3D = useCallback(async (): Promise<string | null> => {
    if (!user || !state.optimizedImage.url) {
      dispatch({ type: 'SET_GENERATE_ERROR', payload: '請先完成色彩優化' });
      return null;
    }

    try {
      dispatch({ type: 'SET_GENERATING', payload: true });
      dispatch({ type: 'SET_GENERATE_ERROR', payload: null });

      const jobId = await generateModel({
        imageUrl: state.optimizedImage.url,
        quality: state.quality,
        printerType: 'fdm', // H2C is FDM
        inputMode: 'single',
        provider: state.provider,
      });

      if (jobId) {
        dispatch({ type: 'SET_GENERATE_JOB_ID', payload: jobId });
        // Credits update automatically via realtime listener
        router.push(`/viewer?id=${jobId}`);
        return jobId;
      } else {
        throw new Error('生成失敗');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '3D 模型生成失敗';
      dispatch({ type: 'SET_GENERATE_ERROR', payload: message });
      return null;
    } finally {
      dispatch({ type: 'SET_GENERATING', payload: false });
    }
  }, [user, state.optimizedImage.url, state.quality, state.provider, generateModel, router]);

  // ============================================
  // Navigation & Reset
  // ============================================

  const goToOptimize = useCallback(() => {
    dispatch({ type: 'GO_TO_OPTIMIZE' });
  }, []);

  const goToGenerate = useCallback(() => {
    dispatch({ type: 'GO_TO_GENERATE' });
  }, []);

  const goToUpload = useCallback(() => {
    dispatch({ type: 'SET_STEP', payload: 'upload' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // ============================================
  // Computed Values
  // ============================================

  const canOptimize = useMemo(() => {
    return (
      state.originalImage.url !== null &&
      state.optimizeStatus !== 'optimizing' &&
      credits >= 1
    );
  }, [state.originalImage.url, state.optimizeStatus, credits]);

  const canGenerate = useMemo(() => {
    return (
      state.optimizedImage.url !== null &&
      !state.generating &&
      credits >= 1
    );
  }, [state.optimizedImage.url, state.generating, credits]);

  // ============================================
  // Return
  // ============================================

  return {
    // State
    state,
    dispatch,

    // Auth
    user,
    authLoading,

    // Credits
    credits,
    creditsLoading,

    // Step 1: Upload
    uploadOriginal,

    // Step 2: Optimize
    optimizeColors,
    reOptimize,
    downloadOptimized,
    uploadEditedImage,

    // Step 3: Generate
    generate3D,

    // Navigation
    goToUpload,
    goToOptimize,
    goToGenerate,
    reset,

    // Computed
    canOptimize,
    canGenerate,

    // Settings
    setProvider: (provider: ModelProvider) =>
      dispatch({ type: 'SET_PROVIDER', payload: provider }),
    setQuality: (quality: QualityLevel) =>
      dispatch({ type: 'SET_QUALITY', payload: quality }),
  };
}
