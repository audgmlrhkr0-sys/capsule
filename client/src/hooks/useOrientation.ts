import { useEffect, useState } from 'react';

type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
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

export function useFullscreen(): boolean {
  const [fullscreen, setFullscreen] = useState(isFullscreen);

  useEffect(() => {
    const update = () => setFullscreen(isFullscreen());
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('webkitfullscreenchange', update);
    };
  }, []);

  return fullscreen;
}

export function canEnterFullscreen(): boolean {
  const fullscreenDocument = document as FullscreenDocument;
  return Boolean(
    fullscreenDocument.fullscreenEnabled || fullscreenDocument.webkitFullscreenEnabled,
  );
}

export async function enterLandscapeFullscreen(): Promise<void> {
  const root = document.documentElement as FullscreenTarget;
  if (!isFullscreen()) {
    try {
      if (root.requestFullscreen) {
        await root.requestFullscreen({ navigationUI: 'hide' });
      } else {
        await root.webkitRequestFullscreen?.();
      }
    } catch {
      // Fullscreen can be refused; the rotate prompt remains as the fallback.
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
