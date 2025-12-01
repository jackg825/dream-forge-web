'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { GeneratorTabs } from '@/components/home';
import { NoCreditsModal } from '@/components/credits/NoCreditsModal';

/**
 * GeneratePage - Dedicated page for 3D model generation
 * Contains the Quick Generate and Advanced Flow tabs
 */
export default function GeneratePage() {
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
