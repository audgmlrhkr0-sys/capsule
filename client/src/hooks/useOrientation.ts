import { useEffect, useState } from 'react';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

type FullscreenTarget = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function usePortrait(): boolean {
  const [portrait, setPortrait] = useState(
    () => window.matchMedia('(orientation: portrait)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(orientation: portrait)');
    const update = () => setPortrait(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, []);

  return portrait;
}

export function needsHomeScreenForFullscreen(): boolean {
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  return /iPhone|iPod/.test(navigator.userAgent) && !standalone;
}

export async function enterLandscapeFullscreen(): Promise<void> {
  const root = document.documentElement as FullscreenTarget;
  if (!isFullscreen()) {
    try {
      if (root.requestFullscreen) {
        await root.requestFullscreen();
      } else {
        await root.webkitRequestFullscreen?.();
      }
    } catch {
      try {
        await root.webkitRequestFullscreen?.();
      } catch {
        // Fullscreen is unavailable (iPhone Safari, in-app browsers); play continues windowed.
      }
    }
  }
  await requestLandscape();
}

export async function requestLandscape(): Promise<void> {
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: 'landscape') => Promise<void>;
  };
  try {
    await orientation.lock?.('landscape');
  } catch {
    // Orientation lock is optional and commonly requires fullscreen support.
  }
}

function isFullscreen(): boolean {
  const fullscreenDocument = document as FullscreenDocument;
  return Boolean(
    fullscreenDocument.fullscreenElement || fullscreenDocument.webkitFullscreenElement,
  );
}
