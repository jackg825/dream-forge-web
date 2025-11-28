'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { MultiImageUploader } from '@/components/upload/MultiImageUploader';
import { QualitySelector } from '@/components/upload/QualitySelector';
import { PrinterTypeSelector } from '@/components/upload/PrinterTypeSelector';
import { CreditBadge } from '@/components/credits/CreditBadge';
import { NoCreditsModal } from '@/components/credits/NoCreditsModal';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useGenerateModel } from '@/hooks/useJobs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Download, Shield, Upload, Loader2, Sparkles } from 'lucide-react';
import type { QualityLevel, PrinterType, InputMode, UploadedImage, ViewAngle } from '@/types';
import { CREDIT_COSTS } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { credits, loading: creditsLoading, hasCredits } = useCredits(user?.uid);
  const { generate, generating, error: generateError } = useGenerateModel();

  // Image upload state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [inputMode, setInputMode] = useState<InputMode>('single');
  const [selectedAngles, setSelectedAngles] = useState<ViewAngle[]>(['back', 'left', 'right']);

  // Generation options
  const [quality, setQuality] = useState<QualityLevel>('standard');
  const [printerType, setPrinterType] = useState<PrinterType>('fdm');
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);

  const handleImagesChange = useCallback((images: UploadedImage[], mode: InputMode) => {
    setUploadedImages(images);
    setInputMode(mode);
    // Extract selected angles from AI mode
    if (mode === 'ai-generated') {
      const angles = images
        .filter((img) => !img.isAiGenerated && img.angle !== 'front')
        .map((img) => img.angle);
      if (angles.length > 0) {
        setSelectedAngles(angles);
      }
    }
  }, []);

  const handleGenerate = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    const creditCost = CREDIT_COSTS[inputMode];
    if (credits < creditCost) {
      setShowNoCreditsModal(true);
      return;
    }

    if (uploadedImages.length === 0) return;

    const primaryImage = uploadedImages.find((img) => img.angle === 'front') || uploadedImages[0];

    const jobId = await generate({
      imageUrl: primaryImage.url,
      imageUrls: uploadedImages.map((img) => img.url),
      viewAngles: uploadedImages.map((img) => img.angle),
      quality,
      printerType,
      inputMode,
      generateAngles: inputMode === 'ai-generated' ? selectedAngles : undefined,
    });

    if (jobId) {
      router.push(`/viewer?id=${jobId}`);
    }
  };

  const creditCost = CREDIT_COSTS[inputMode];
  const canGenerate = uploadedImages.length > 0 && !generating && (authLoading || credits >= creditCost);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="mr-1 h-3 w-3" />
            AI-Powered 3D Generation
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Transform Photos into 3D Models
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload a photo and watch it transform into a stunning 3D model.
            Perfect for 3D printing, gaming, or digital art.
          </p>
        </div>

        {/* Main card */}
        <Card className="mb-16">
          <CardContent className="pt-6">
            {/* Credit display for logged in users */}
            {user && !authLoading && (
              <div className="flex items-center justify-between mb-6 pb-6 border-b">
                <div className="flex items-center gap-3">
                  <CreditBadge credits={credits} loading={creditsLoading} />
                  <span className="text-sm text-muted-foreground">
                    {credits === 0
                      ? 'No credits remaining'
                      : credits === 1
                      ? '1 generation available'
                      : `${credits} generations available`}
                  </span>
                </div>
              </div>
            )}

            {/* Step 1: Image uploader */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  1
                </div>
                <h2 className="text-lg font-semibold">Upload Your Photo</h2>
              </div>
              {user ? (
                <MultiImageUploader
                  userId={user.uid}
                  onImagesChange={handleImagesChange}
                />
              ) : (
                <div
                  onClick={() => router.push('/auth')}
                  className="relative rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center cursor-pointer hover:border-muted-foreground/50 bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-foreground">
                      <span className="text-primary font-medium">Sign in</span> to upload photos
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      New users get 3 free credits
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Quality selector */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  2
                </div>
                <h2 className="text-lg font-semibold">Choose Quality</h2>
              </div>
              <QualitySelector
                value={quality}
                onChange={setQuality}
                disabled={uploadedImages.length === 0}
              />
            </div>

            {/* Step 3: Printer type selector */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  3
                </div>
                <h2 className="text-lg font-semibold">Select Printer Type</h2>
              </div>
              <PrinterTypeSelector
                value={printerType}
                onChange={setPrinterType}
                disabled={uploadedImages.length === 0}
              />
            </div>

            {/* Step 4: Generate button */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  4
                </div>
                <h2 className="text-lg font-semibold">Generate 3D Model</h2>
              </div>

              {generateError && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">{generateError}</p>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                size="lg"
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg transition-all hover:shadow-xl"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Starting Generation...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate 3D Model
                    <Badge variant="secondary" className="ml-2">
                      {creditCost} credit{creditCost > 1 ? 's' : ''}
                    </Badge>
                  </>
                )}
              </Button>

              {!user && (
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  Sign in to start generating 3D models
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Features section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title="AI-Powered"
            description="Advanced Rodin Gen-2 technology transforms your photos into detailed 3D models"
          />
          <FeatureCard
            icon={<Download className="h-6 w-6" />}
            title="Multiple Formats"
            description="Download in GLB, OBJ, FBX, or STL format for any use case"
          />
          <FeatureCard
            icon={<Shield className="h-6 w-6" />}
            title="Print Ready"
            description="Models are optimized for 3D printing with proper mesh quality"
          />
        </div>
      </main>

      {/* No credits modal */}
      <NoCreditsModal
        isOpen={showNoCreditsModal}
        onClose={() => setShowNoCreditsModal(false)}
      />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="text-center">
      <CardContent className="pt-6">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <CardTitle className="text-lg mb-2">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
