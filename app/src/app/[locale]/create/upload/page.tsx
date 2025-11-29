'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Upload, X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QualitySelector } from '@/components/upload/QualitySelector';
import { PrinterTypeSelector } from '@/components/upload/PrinterTypeSelector';
import { AngleSelector } from '@/components/create/AngleSelector';

import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useSession, useSessionActions } from '@/hooks/useSession';
import { uploadImage, validateImage } from '@/lib/storage';

import type { ViewAngle, QualityLevel, PrinterType } from '@/types';
import { SESSION_CREDIT_COSTS } from '@/types';

/**
 * Step 1: Upload original image and select angles
 *
 * User actions:
 * - Upload original image (front view)
 * - Select which angles to generate via AI (back, left, right, top)
 * - Configure generation settings (quality, printer type)
 * - Proceed to Step 2 (view generation) - charges 1 credit
 */
export default function UploadPage() {
  const t = useTranslations('create');
  const tUpload = useTranslations('upload');
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const { user } = useAuth();
  const { credits } = useCredits(user?.uid);
  const { session } = useSession(sessionId);
  const { createSession, updateSession, loading: actionLoading } = useSessionActions();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [uploadedImage, setUploadedImage] = useState<{
    file: File | null;
    preview: string;
    uploadResult?: { downloadUrl: string; storagePath: string };
  } | null>(null);
  const [selectedAngles, setSelectedAngles] = useState<ViewAngle[]>(['back', 'left', 'right']);
  const [quality, setQuality] = useState<QualityLevel>('standard');
  const [printerType, setPrinterType] = useState<PrinterType>('fdm');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Load existing session data
  useEffect(() => {
    if (session) {
      if (session.originalImage) {
        setUploadedImage({
          file: null,
          preview: session.originalImage.url,
          uploadResult: {
            downloadUrl: session.originalImage.url,
            storagePath: session.originalImage.storagePath,
          },
        });
      }
      setSelectedAngles(session.selectedAngles || ['back', 'left', 'right']);
      setQuality(session.settings.quality);
      setPrinterType(session.settings.printerType);
    }
  }, [session]);

  // Handle file selection
  const handleFile = useCallback(
    async (file: File) => {
      if (!file || !user) return;

      setUploadError(null);

      // Validate file
      const validation = await validateImage(file);
      if (!validation.valid) {
        setUploadError(validation.error || 'Invalid image');
        return;
      }

      // Create preview
      const preview = URL.createObjectURL(file);
      setUploadedImage({ file, preview });

      // Upload to Storage
      setUploading(true);
      try {
        const uploadResult = await uploadImage(file, user.uid);
        setUploadedImage((prev) =>
          prev ? { ...prev, uploadResult } : null
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setUploadError(message);
        setUploadedImage(null);
      } finally {
        setUploading(false);
      }
    },
    [user]
  );

  // Handle file input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  // Remove uploaded image
  const handleRemoveImage = () => {
    if (uploadedImage?.preview && uploadedImage.file) {
      URL.revokeObjectURL(uploadedImage.preview);
    }
    setUploadedImage(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Proceed to next step
  const handleProceed = async () => {
    if (!user || !uploadedImage?.uploadResult) return;

    // Check credits
    if (credits < SESSION_CREDIT_COSTS.VIEW_GENERATION) {
      setUploadError('Not enough credits');
      return;
    }

    try {
      let currentSessionId = sessionId;

      // Create session if not exists
      if (!currentSessionId) {
        currentSessionId = await createSession({
          quality,
          printerType,
          format: 'stl',
        });
      }

      if (!currentSessionId) {
        throw new Error('Failed to create session');
      }

      // Update session with image and settings
      await updateSession({
        sessionId: currentSessionId,
        originalImageUrl: uploadedImage.uploadResult.downloadUrl,
        originalStoragePath: uploadedImage.uploadResult.storagePath,
        selectedAngles,
        settings: { quality, printerType, format: 'stl' },
      });

      // Navigate to views generation page
      router.push(`./views?sessionId=${currentSessionId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to proceed';
      setUploadError(message);
    }
  };

  const canProceed =
    uploadedImage?.uploadResult &&
    selectedAngles.length > 0 &&
    credits >= SESSION_CREDIT_COSTS.VIEW_GENERATION &&
    !uploading &&
    !actionLoading;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('upload.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('upload.description')}</p>
      </div>

      {/* Image Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('steps.upload')}</CardTitle>
          <CardDescription>{tUpload('supportedFormats')}</CardDescription>
        </CardHeader>
        <CardContent>
          {uploadedImage ? (
            <div className="relative">
              <div className="relative aspect-square max-w-sm mx-auto rounded-lg overflow-hidden border">
                <Image
                  src={uploadedImage.preview}
                  alt="Uploaded image"
                  fill
                  className="object-contain"
                />
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleRemoveImage}
                disabled={uploading || actionLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                transition-colors
                ${isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleInputChange}
                className="hidden"
              />
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm font-medium">{tUpload('dragDrop')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {tUpload('orClickToUpload')}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {tUpload('maxFileSize')}
              </p>
            </div>
          )}

          {uploadError && (
            <p className="text-sm text-destructive mt-2">{uploadError}</p>
          )}
        </CardContent>
      </Card>

      {/* Angle Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('upload.selectAngles')}</CardTitle>
          <CardDescription>{t('upload.anglesHelp')}</CardDescription>
        </CardHeader>
        <CardContent>
          <AngleSelector
            selectedAngles={selectedAngles}
            onChange={setSelectedAngles}
            disabled={actionLoading}
          />
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('upload.settingsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-medium mb-3">{tUpload('quality.title')}</h4>
            <QualitySelector
              value={quality}
              onChange={setQuality}
              disabled={actionLoading}
            />
          </div>

          <div>
            <h4 className="text-sm font-medium mb-3">{tUpload('printerType.title')}</h4>
            <PrinterTypeSelector
              value={printerType}
              onChange={setPrinterType}
              disabled={actionLoading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span>
            {t('upload.creditCost')} ({SESSION_CREDIT_COSTS.VIEW_GENERATION} credit)
          </span>
          <span className="ml-2">
            • 目前點數: {credits}
          </span>
        </div>
        <Button
          size="lg"
          onClick={handleProceed}
          disabled={!canProceed}
        >
          {actionLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              處理中...
            </>
          ) : (
            t('upload.proceedButton')
          )}
        </Button>
      </div>
    </div>
  );
}
