'use client';

import { PipelineFlow } from '@/components/generate';

interface GeneratorTabsProps {
  onNoCredits: () => void;
  className?: string;
}

/**
 * GeneratorTabs - Simplified to only show PipelineFlow
 * Legacy tabs have been removed
 */
export function GeneratorTabs({ onNoCredits, className }: GeneratorTabsProps) {
  return (
    <div className={className}>
      <PipelineFlow onNoCredits={onNoCredits} />
    </div>
  );
}
