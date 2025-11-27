'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { ImageUploader } from '@/components/upload/ImageUploader';
import { QualitySelector } from '@/components/upload/QualitySelector';
import { CreditBadge } from '@/components/credits/CreditBadge';
import { NoCreditsModal } from '@/components/credits/NoCreditsModal';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useGenerateModel } from '@/hooks/useJobs';
import type { QualityLevel } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { credits, loading: creditsLoading, hasCredits } = useCredits(user?.uid);
  const { generate, generating, error: generateError } = useGenerateModel();

  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityLevel>('standard');
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);

  const handleUploadComplete = useCallback((imageUrl: string) => {
    setUploadedImageUrl(imageUrl);
  }, []);

  const handleGenerate = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    if (!hasCredits) {
      setShowNoCreditsModal(true);
      return;
    }

    if (!uploadedImageUrl) return;

    const jobId = await generate(uploadedImageUrl, quality);
    if (jobId) {
      router.push(`/viewer?id=${jobId}`);
    }
  };

  const canGenerate = uploadedImageUrl && !generating && (authLoading || hasCredits);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Transform Photos into 3D Models
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Upload a photo and watch it transform into a stunning 3D model.
            Perfect for 3D printing, gaming, or digital art.
          </p>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Credit display for logged in users */}
          {user && !authLoading && (
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <CreditBadge credits={credits} loading={creditsLoading} />
                <span className="text-sm text-gray-500">
                  {credits === 0
                    ? 'No credits remaining'
                    : credits === 1
                    ? '1 generation available'
                    : `${credits} generations available`}
                </span>
              </div>
            </div>
          )}

          {/* Image uploader */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              1. Upload Your Photo
            </h2>
            {user ? (
              <ImageUploader
                userId={user.uid}
                onUploadComplete={handleUploadComplete}
              />
            ) : (
              <div
                onClick={() => router.push('/auth')}
                className="relative rounded-lg border-2 border-dashed border-gray-300 p-8 text-center cursor-pointer hover:border-gray-400 bg-gray-50 transition-colors"
              >
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-600">
                    <span className="text-indigo-600 font-medium">Sign in</span> to upload photos
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    New users get 3 free credits
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quality selector */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              2. Choose Quality
            </h2>
            <QualitySelector
              value={quality}
              onChange={setQuality}
              disabled={!uploadedImageUrl}
            />
          </div>

          {/* Generate button */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              3. Generate 3D Model
            </h2>

            {generateError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{generateError}</p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full py-3 px-6 text-lg font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Starting Generation...
                </span>
              ) : (
                'Generate 3D Model'
              )}
            </button>

            {!user && (
              <p className="mt-3 text-center text-sm text-gray-500">
                Sign in to start generating 3D models
              </p>
            )}
          </div>
        </div>

        {/* Features section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            title="AI-Powered"
            description="Advanced Rodin Gen-2 technology transforms your photos into detailed 3D models"
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            }
            title="Multiple Formats"
            description="Download in GLB, OBJ, FBX, or STL format for any use case"
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
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
    <div className="text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
