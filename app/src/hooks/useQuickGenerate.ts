'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useGenerateModel } from '@/hooks/useJobs';
import type {
  UploadedImage,
  InputMode,
  ViewAngle,
  QualityLevel,
  PrinterType,
  ModelProvider,
} from '@/types';
import { CREDIT_COSTS } from '@/types';

/**
 * Custom hook for Quick Generate functionality
 * Manages all state for the simplified homepage generation flow
 */
export function useQuickGenerate() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { credits, loading: creditsLoading } = useCredits(user?.uid);
  const { generate: generateModel, generating, error: generateError } = useGenerateModel();

  // Image state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>('single');
  const [selectedAngles, setSelectedAngles] = useState<ViewAngle[]>(['back', 'left', 'right']);

  // Settings (always visible with smart defaults)
  const [quality, setQuality] = useState<QualityLevel>('standard');
  const [printerType, setPrinterType] = useState<PrinterType>('fdm');
  const [provider, setProvider] = useState<ModelProvider>('meshy');

  // Handle image changes from MultiImageUploader
  const handleImagesChange = useCallback((images: UploadedImage[], mode: InputMode) => {
    setUploadedImages(images);
    setInputMode(mode);

    // Update selected angles if in AI-generated mode
    if (mode === 'ai-generated') {
      const angles = images
        .filter((img) => !img.isAiGenerated && img.angle !== 'front')
        .map((img) => img.angle);
      if (angles.length > 0) {
        setSelectedAngles(angles);
      }
    }
  }, []);

  // Calculate credit cost based on input mode
  const creditCost = useMemo(() => CREDIT_COSTS[inputMode], [inputMode]);

  // Check if user can generate
  const canGenerate = useMemo(() => {
    return (
      uploadedImages.length > 0 &&
      !generating &&
      (authLoading || credits >= creditCost)
    );
  }, [uploadedImages.length, generating, authLoading, credits, creditCost]);

  // Handle generate action
  const handleGenerate = useCallback(async (): Promise<string | null> => {
    // Redirect to auth if not logged in
    if (!user) {
      router.push('/auth');
      return null;
    }

    // Check credits
    if (credits < creditCost) {
      return null; // Parent component should show NoCreditsModal
    }

    // Validate images
    if (uploadedImages.length === 0) {
      return null;
    }

    // Find primary image (front view or first image)
    const primaryImage = uploadedImages.find((img) => img.angle === 'front') || uploadedImages[0];

    // Call generate API
    const jobId = await generateModel({
      imageUrl: primaryImage.url,
      imageUrls: uploadedImages.map((img) => img.url),
      viewAngles: uploadedImages.map((img) => img.angle),
      quality,
      printerType,
      inputMode,
      generateAngles: inputMode === 'ai-generated' ? selectedAngles : undefined,
      provider,
    });

    // Redirect to viewer on success
    if (jobId) {
      router.push(`/viewer?id=${jobId}`);
    }

    return jobId;
  }, [
    user,
    router,
    credits,
    creditCost,
    uploadedImages,
    generateModel,
    quality,
    printerType,
    inputMode,
    selectedAngles,
    provider,
  ]);

  // Reset all state
  const reset = useCallback(() => {
    setUploadedImages([]);
    setInputMode('single');
    setSelectedAngles(['back', 'left', 'right']);
    setQuality('standard');
    setPrinterType('fdm');
    setProvider('meshy');
  }, []);

  return {
    // Auth state
    user,
    authLoading,

    // Credits state
    credits,
    creditsLoading,
    creditCost,

    // Image state
    uploadedImages,
    inputMode,
    selectedAngles,
    handleImagesChange,
    setSelectedAngles,

    // Settings state
    quality,
    setQuality,
    printerType,
    setPrinterType,
    provider,
    setProvider,

    // Generation state
    generating,
    generateError,
    canGenerate,
    handleGenerate,

    // Actions
    reset,
  };
}
