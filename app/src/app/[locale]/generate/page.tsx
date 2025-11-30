'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/layout/Header';
import { GeneratorTabs } from '@/components/home';
import { NoCreditsModal } from '@/components/credits/NoCreditsModal';
import { useAuth } from '@/hooks/useAuth';

/**
 * GeneratePage - Dedicated page for 3D model generation
 * Contains the Quick Generate and Advanced Flow tabs
 */
export default function GeneratePage() {
  const t = useTranslations();
  const { user } = useAuth();
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {t('generate.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('generate.subtitle')}
          </p>
        </div>

        {/* Generator Tabs */}
        <GeneratorTabs onNoCredits={() => setShowNoCreditsModal(true)} />
      </main>

      {/* No Credits Modal */}
      <NoCreditsModal
        isOpen={showNoCreditsModal}
        onClose={() => setShowNoCreditsModal(false)}
      />
    </div>
  );
}
