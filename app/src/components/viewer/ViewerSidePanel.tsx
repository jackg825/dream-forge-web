'use client';

import { ReactNode } from 'react';
import { X, ChevronLeft, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ViewerSidePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  title?: string;
}

/**
 * Floating side panel for the 3D viewer page.
 *
 * Features:
 * - Glassmorphism design consistent with toolbar
 * - Smooth slide animation
 * - Collapsible with toggle button
 * - Fixed position that doesn't affect viewer layout
 */
export function ViewerSidePanel({
  isOpen,
  onToggle,
  children,
  title = '詳細資訊',
}: ViewerSidePanelProps) {
  return (
    <>
      {/* Floating Side Panel */}
      <div
        className={cn(
          // Position & sizing
          'fixed top-[72px] right-4 bottom-4 w-80 z-40',
          // Glassmorphism styling
          'bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-2xl',
          // Animation
          'transition-transform duration-300 ease-out',
          // Overflow handling
          'overflow-hidden flex flex-col',
          // Transform based on open state
          isOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h2 className="font-medium text-white/90 text-sm">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {children}
        </div>
      </div>

      {/* Toggle Button (visible when panel is closed) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className={cn(
          // Position
          'fixed top-1/2 right-2 -translate-y-1/2 z-50',
          // Styling
          'h-10 w-10 rounded-full',
          'bg-gray-900/90 backdrop-blur-xl border border-white/10',
          'text-white/70 hover:text-white hover:bg-gray-800/90',
          'shadow-lg',
          // Animation
          'transition-all duration-300',
          // Visibility
          isOpen ? 'opacity-0 pointer-events-none translate-x-4' : 'opacity-100'
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
    </>
  );
}

/**
 * Toggle button to be used in ViewerToolbar
 */
export function PanelToggleButton({
  onClick,
  isOpen,
}: {
  onClick: () => void;
  isOpen: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        'h-9 w-9 p-0 text-white/70 hover:text-white hover:bg-white/10',
        isOpen && 'bg-white/20 text-white'
      )}
    >
      <PanelRight className="w-4 h-4" />
    </Button>
  );
}
