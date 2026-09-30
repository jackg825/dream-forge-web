'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { UserHeader } from '@/components/layout/headers';
import { GeneratorTabs } from '@/components/home';
import { NoCreditsModal } from '@/components/credits/NoCreditsModal';

/**
 * GeneratePage - Dedicated page for 3D model generation
 * Contains the Quick Generate and Advanced Flow tabs
 */
export default function GeneratePage() {
  const t = useTranslations('generate');
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <UserHeader />

      <main className="studio-shell">
        <div className="mb-10 sm:mb-12">
          <p className="store-eyebrow mb-3">DreamForge Studio</p>
          <h1 className="studio-page-title">{t('title')}</h1>
          <p className="studio-page-subtitle">{t('subtitle')}</p>
        </div>
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
