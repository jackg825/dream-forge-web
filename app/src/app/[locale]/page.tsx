'use client';

import { Header } from '@/components/layout/Header';
import {
  HeroSection,
  ShowcaseSection,
  HowItWorksSection,
  FeaturesSection,
  UseCasesSection,
  PricingSection,
  FinalCTASection,
  Footer,
} from '@/components/landing';

/**
 * HomePage - Marketing landing page for DreamForge
 *
 * Sections:
 * - Hero: Bold headline with gradient background and floating shapes
 * - Showcase: Interactive before/after 3D transformation gallery
 * - How It Works: 3-step process visualization
 * - Features: Bento grid of key features
 * - Use Cases: Target audience personas
 * - Pricing: Credit-based pricing tiers
 * - Final CTA: Conversion-focused call to action
 * - Footer: Navigation and copyright
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main>
        <HeroSection />
        <ShowcaseSection />
        <HowItWorksSection />
        <FeaturesSection />
        <UseCasesSection />
        <PricingSection />
        <FinalCTASection />
      </main>

      <Footer />
    </div>
  );
}
