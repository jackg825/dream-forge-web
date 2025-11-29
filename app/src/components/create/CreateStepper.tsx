'use client';

import { useTranslations } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Check, Upload, Image, Eye, Box, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

import type { SessionStatus } from '@/types';

// Step definitions with icons
const STEPS = [
  { id: 1, key: 'upload', icon: Upload, path: 'upload' },
  { id: 2, key: 'views', icon: Sparkles, path: 'views' },
  { id: 3, key: 'preview', icon: Eye, path: 'preview' },
  { id: 4, key: 'generate', icon: Box, path: 'generate' },
  { id: 5, key: 'result', icon: Image, path: 'result' },
] as const;

// Map session status to accessible steps
function getAccessibleSteps(status: SessionStatus | undefined): number[] {
  switch (status) {
    case 'draft':
      return [1]; // Only upload accessible
    case 'generating-views':
      return [1, 2]; // Can go back to upload, currently on views
    case 'views-ready':
      return [1, 2, 3]; // Can access upload, views (to regenerate), and preview
    case 'generating-model':
      return [1, 2, 3, 4]; // Can go back to any previous step
    case 'completed':
      return [1, 2, 3, 4, 5]; // All steps accessible
    case 'failed':
      return [1, 2, 3]; // Can go back to fix and retry
    default:
      return [1];
  }
}

// Get current step from pathname
function getCurrentStep(pathname: string): number {
  if (pathname.includes('/upload')) return 1;
  if (pathname.includes('/views')) return 2;
  if (pathname.includes('/preview')) return 3;
  if (pathname.includes('/generate')) return 4;
  if (pathname.includes('/result')) return 5;
  return 1;
}

interface CreateStepperProps {
  sessionId?: string | null;
  sessionStatus?: SessionStatus;
  className?: string;
}

/**
 * CreateStepper - Visual progress indicator for multi-step flow
 *
 * Features:
 * - Shows all 5 steps with icons
 * - Highlights current step
 * - Shows completed steps with checkmarks
 * - Allows navigation to accessible steps (based on session status)
 */
export function CreateStepper({
  sessionId,
  sessionStatus,
  className,
}: CreateStepperProps) {
  const t = useTranslations('create.steps');
  const tStepper = useTranslations('create.stepper');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentStep = getCurrentStep(pathname);
  const accessibleSteps = getAccessibleSteps(sessionStatus);

  // Handle step click
  const handleStepClick = (stepId: number, path: string) => {
    // Can only navigate to accessible steps
    if (!accessibleSteps.includes(stepId)) return;

    // Don't navigate to current step
    if (stepId === currentStep) return;

    // Build URL with sessionId if available
    const url = sessionId ? `./${path}?sessionId=${sessionId}` : `./${path}`;
    router.push(url);
  };

  return (
    <nav className={cn('w-full', className)} aria-label="Progress">
      {/* Desktop: Horizontal stepper */}
      <ol className="hidden md:flex items-center justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isAccessible = accessibleSteps.includes(step.id);

          return (
            <li key={step.id} className="flex-1 relative">
              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'absolute top-5 left-1/2 w-full h-0.5',
                    isCompleted ? 'bg-primary' : 'bg-muted'
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Step button */}
              <button
                onClick={() => handleStepClick(step.id, step.path)}
                disabled={!isAccessible}
                className={cn(
                  'relative flex flex-col items-center group',
                  isAccessible && !isCurrent && 'cursor-pointer',
                  !isAccessible && 'cursor-not-allowed opacity-50'
                )}
              >
                {/* Step circle */}
                <span
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors',
                    isCompleted && 'bg-primary border-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-primary/10 text-primary',
                    !isCompleted && !isCurrent && 'border-muted bg-background text-muted-foreground',
                    isAccessible && !isCurrent && 'group-hover:border-primary/50'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </span>

                {/* Step label */}
                <span
                  className={cn(
                    'mt-2 text-xs font-medium text-center',
                    isCurrent && 'text-primary',
                    !isCurrent && 'text-muted-foreground'
                  )}
                >
                  {t(step.key)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Mobile: Compact stepper */}
      <div className="md:hidden flex items-center justify-between px-2">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((step) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div
                key={step.id}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  isCompleted && 'bg-primary',
                  isCurrent && 'bg-primary w-4',
                  !isCompleted && !isCurrent && 'bg-muted'
                )}
              />
            );
          })}
        </div>

        {/* Current step label */}
        <span className="text-sm font-medium">
          {tStepper('stepOf', { step: currentStep, total: STEPS.length })}
        </span>
      </div>
    </nav>
  );
}
