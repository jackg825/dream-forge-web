'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { MarketingHero, GeneratorTabs } from '@/components/home';
import { NoCreditsModal } from '@/components/credits/NoCreditsModal';
import { useAuth } from '@/hooks/useAuth';

/**
 * HomePage - Main landing page with marketing hero and tabbed generation interface
 *
 * Features:
 * - Marketing Hero with value proposition and conditional CTA
 * - Tabbed interface: Quick Generate (simplified) and Advanced (preview + link)
 * - Responsive design for mobile and desktop
 */
export default function HomePage() {
  const { user } = useAuth();
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Marketing Hero Section */}
        <MarketingHero user={user} />

        {/* Generator Tabs Section */}
        <div id="generator-tabs">
          <GeneratorTabs onNoCredits={() => setShowNoCreditsModal(true)} />
        </div>
      </main>

      {/* No Credits Modal */}
      <NoCreditsModal
        isOpen={showNoCreditsModal}
        onClose={() => setShowNoCreditsModal(false)}
      />
    </div>
  );
}
