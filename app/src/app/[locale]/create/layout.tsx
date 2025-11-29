'use client';

import { Suspense } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Header } from '@/components/layout/Header';
import { StepperWrapper } from '@/components/create/StepperWrapper';

interface CreateLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout for the multi-step creation flow
 * Wraps all /create/* pages with AuthGuard, Header, and Stepper
 */
export default function CreateLayout({ children }: CreateLayoutProps) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6">
          {/* Stepper navigation - wrapped in Suspense for searchParams */}
          <Suspense fallback={<div className="h-16 mb-6" />}>
            <StepperWrapper />
          </Suspense>
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
