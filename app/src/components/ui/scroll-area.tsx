'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, orientation = 'vertical', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'h-full w-full rounded-[inherit]',
          orientation === 'horizontal' ? 'overflow-x-auto' : 'overflow-y-auto'
        )}
      >
        {children}
      </div>
    </div>
  )
);
ScrollArea.displayName = 'ScrollArea';

const ScrollBar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' &&
        'h-full w-2.5 border-l border-l-transparent p-[1px]',
      orientation === 'horizontal' &&
        'h-2.5 flex-col border-t border-t-transparent p-[1px]',
      className
    )}
    {...props}
  />
));
ScrollBar.displayName = 'ScrollBar';

export { ScrollArea, ScrollBar };
