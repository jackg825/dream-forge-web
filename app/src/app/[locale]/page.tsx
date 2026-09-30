'use client';

import { Header } from '@/components/layout/Header';
import {
  HeroSection,
  ShowcaseSection,
  HowItWorksSection,
  FeaturesSection,
  CreatorHubSection,
  UseCasesSection,
  PricingSection,
  PrintServiceSection,
  FinalCTASection,
  Footer,
} from '@/components/landing';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main>
        <HeroSection />
        <ShowcaseSection />
        <HowItWorksSection />
        <FeaturesSection />
        <CreatorHubSection />
        <UseCasesSection />
        <PricingSection />
        <PrintServiceSection />
        <FinalCTASection />
      </main>

      <Footer />
    </div>
  );
}
