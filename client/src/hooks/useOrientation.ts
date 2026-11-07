import { useEffect, useState } from 'react';

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
