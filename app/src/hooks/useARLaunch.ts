'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';

type ARPlatform = 'ios' | 'android' | 'unsupported';

interface UseARLaunchOptions {
  glbUrl: string;
  usdzUrl?: string;  // Optional USDZ URL for iOS (if pre-converted)
  fallbackUrl?: string;  // Fallback URL when AR is not available
}

interface UseARLaunchReturn {
  isARSupported: boolean;
  platform: ARPlatform;
  isLoading: boolean;
  error: string | null;
  launchAR: () => Promise<void>;
}

/**
 * Detect AR platform support
 */
function detectPlatform(): ARPlatform {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'unsupported';
  }

  const ua = navigator.userAgent;

  // iOS detection - iPad, iPhone, iPod
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;

  // Check for AR Quick Look support on iOS
  if (isIOS) {
    const a = document.createElement('a');
    // Check if rel="ar" is supported
    if (a.relList?.supports?.('ar')) {
      return 'ios';
    }
    // Fallback: assume iOS 12+ supports AR Quick Look
    return 'ios';
  }

  // Android detection
  const isAndroid = /android/i.test(ua);
  if (isAndroid) {
    return 'android';
  }

  return 'unsupported';
}

/**
 * Launch iOS AR Quick Look
 *
 * Requirements:
 * - Must have USDZ file URL
 * - Anchor must have rel="ar" attribute
 * - First child must be an <img> element
 *
 * @see https://developer.apple.com/augmented-reality/quick-look/
 */
function launchIOSQuickLook(usdzUrl: string): void {
  const anchor = document.createElement('a');
  anchor.setAttribute('rel', 'ar');
  anchor.setAttribute('href', usdzUrl);

  // REQUIRED: img must be the first child for AR Quick Look to work
  const img = document.createElement('img');
  img.style.display = 'none';
  anchor.appendChild(img);

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Launch Android Scene Viewer
 *
 * Uses intent URL to open Google's Scene Viewer with the GLB model.
 *
 * @see https://developers.google.com/ar/develop/scene-viewer
 */
function launchAndroidSceneViewer(glbUrl: string, fallbackUrl?: string): void {
  const params = new URLSearchParams({
    file: glbUrl,
    mode: 'ar_only',
  });

  // Build the intent URL
  let intentUrl = `intent://arvr.google.com/scene-viewer/1.0?${params.toString()}`;
  intentUrl += '#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;';

  if (fallbackUrl) {
    intentUrl += `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};`;
  }

  intentUrl += 'end;';

  window.location.href = intentUrl;
}

/**
 * Hook for launching AR preview on mobile devices.
 *
 * Supports:
 * - iOS: AR Quick Look (requires USDZ format)
 * - Android: Scene Viewer (supports GLB directly)
 *
 * @example
 * ```tsx
 * const { isARSupported, platform, isLoading, launchAR } = useARLaunch({
 *   glbUrl: 'https://storage.example.com/model.glb',
 *   usdzUrl: 'https://storage.example.com/model.usdz', // Optional
 * });
 *
 * return isARSupported && (
 *   <button onClick={launchAR} disabled={isLoading}>
 *     {isLoading ? 'Loading...' : 'View in AR'}
 *   </button>
 * );
 * ```
 */
export function useARLaunch(options: UseARLaunchOptions): UseARLaunchReturn {
  const { glbUrl, usdzUrl, fallbackUrl } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<ARPlatform>('unsupported');

  // Detect platform on mount
  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  // AR is supported if we have a valid platform and required URLs
  const isARSupported = useMemo(() => {
    if (platform === 'unsupported') return false;
    if (platform === 'android' && glbUrl) return true;
    if (platform === 'ios' && (usdzUrl || glbUrl)) return true;  // iOS can try GLB but USDZ preferred
    return false;
  }, [platform, glbUrl, usdzUrl]);

  const launchAR = useCallback(async () => {
    if (!isARSupported) {
      setError('AR is not supported on this device');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (platform === 'android') {
        // Android: Use Scene Viewer with GLB directly
        launchAndroidSceneViewer(glbUrl, fallbackUrl);
      } else if (platform === 'ios') {
        if (usdzUrl) {
          // iOS: Use AR Quick Look with USDZ
          launchIOSQuickLook(usdzUrl);
        } else {
          // iOS without USDZ: Show message that USDZ is needed
          setError('iOS AR requires USDZ format (coming soon)');
          console.info('iOS AR 需要 USDZ 格式，此功能即將推出');
        }
      }
    } catch (err) {
      console.error('Failed to launch AR:', err);
      setError(err instanceof Error ? err.message : 'Failed to launch AR');
    } finally {
      setIsLoading(false);
    }
  }, [isARSupported, platform, glbUrl, usdzUrl, fallbackUrl]);

  return {
    isARSupported,
    platform,
    isLoading,
    error,
    launchAR,
  };
}
