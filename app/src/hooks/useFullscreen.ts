'use client';

import { useState, useCallback, useEffect, RefObject } from 'react';

interface UseFullscreenOptions {
  onEnter?: () => void;
  onExit?: () => void;
}

interface UseFullscreenReturn {
  isFullscreen: boolean;
  isPseudoFullscreen: boolean;
  isNativeSupported: boolean;
  toggleFullscreen: () => void;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
}

/**
 * Hook for cross-platform fullscreen support with iOS fallback.
 *
 * Uses native Fullscreen API when available (desktop, Android).
 * Falls back to CSS-based pseudo-fullscreen on iOS Safari where
 * the Fullscreen API is not supported.
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { isFullscreen, isPseudoFullscreen, toggleFullscreen } = useFullscreen(containerRef);
 *
 * return (
 *   <div
 *     ref={containerRef}
 *     className={isPseudoFullscreen ? 'pseudo-fullscreen' : ''}
 *   >
 *     <button onClick={toggleFullscreen}>Toggle Fullscreen</button>
 *   </div>
 * );
 * ```
 */
export function useFullscreen(
  containerRef: RefObject<HTMLElement | null>,
  options?: UseFullscreenOptions
): UseFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

  // Detect native fullscreen support
  // iOS Safari does not support the Fullscreen API
  const isNativeSupported =
    typeof document !== 'undefined' &&
    (document.fullscreenEnabled ||
      // @ts-expect-error - webkit prefix for Safari
      document.webkitFullscreenEnabled ||
      false);

  // Listen for native fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFullscreen = !!(
        document.fullscreenElement ||
        // @ts-expect-error - webkit prefix
        document.webkitFullscreenElement
      );

      if (isNativeFullscreen) {
        setIsFullscreen(true);
      } else if (!isPseudoFullscreen) {
        setIsFullscreen(false);
        options?.onExit?.();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isPseudoFullscreen, options]);

  // Lock body scroll when in pseudo-fullscreen mode
  useEffect(() => {
    if (!isPseudoFullscreen) return;

    // Save current scroll position
    const scrollY = window.scrollY;

    // Lock body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      // Restore body scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      // Restore scroll position
      window.scrollTo(0, scrollY);
    };
  }, [isPseudoFullscreen]);

  // Handle Escape key for pseudo-fullscreen
  useEffect(() => {
    if (!isPseudoFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPseudoFullscreen(false);
        setIsFullscreen(false);
        options?.onExit?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPseudoFullscreen, options]);

  const enterFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    if (isNativeSupported) {
      try {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
          await (containerRef.current as HTMLElement & { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
        options?.onEnter?.();
      } catch (err) {
        // Native fullscreen failed, fall back to pseudo-fullscreen
        console.warn('Native fullscreen failed, using pseudo-fullscreen:', err);
        setIsPseudoFullscreen(true);
        setIsFullscreen(true);
        options?.onEnter?.();
      }
    } else {
      // Use pseudo-fullscreen (iOS Safari)
      setIsPseudoFullscreen(true);
      setIsFullscreen(true);
      options?.onEnter?.();
    }
  }, [containerRef, isNativeSupported, options]);

  const exitFullscreen = useCallback(async () => {
    if (isPseudoFullscreen) {
      setIsPseudoFullscreen(false);
      setIsFullscreen(false);
      options?.onExit?.();
      return;
    }

    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen) {
        await (document as Document & { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen();
      }
    } catch (err) {
      console.error('Error exiting fullscreen:', err);
    }
  }, [isPseudoFullscreen, options]);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  return {
    isFullscreen,
    isPseudoFullscreen,
    isNativeSupported,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
  };
}
