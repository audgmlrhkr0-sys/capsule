import type { PublicGameState } from '@capsule-claw/shared';
import { useEffect, useRef } from 'react';
import { interpolateState, renderMachine } from './renderer';

interface SnapshotPair {
  previous: PublicGameState | null;
  current: PublicGameState | null;
  receivedAt: number;
}

export function GameCanvas({ snapshot }: { snapshot: PublicGameState | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snapshotsRef = useRef<SnapshotPair>({
    previous: null,
    current: null,
    receivedAt: performance.now(),
  });

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    snapshotsRef.current = {
      previous: snapshotsRef.current.current,
      current: snapshot,
      receivedAt: performance.now(),
    };
  }, [snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    let animationFrame = 0;
    const draw = (time: number) => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.max(1, Math.round(bounds.width * pixelRatio));
      const nextHeight = Math.max(1, Math.round(bounds.height * pixelRatio));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }

      const pair = snapshotsRef.current;
      const state = pair.current
        ? interpolateState(pair.previous, pair.current, (time - pair.receivedAt) / 50)
        : null;
      renderMachine(context, state, bounds.width, bounds.height, pixelRatio);
      animationFrame = requestAnimationFrame(draw);
    };

    animationFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="machine-canvas"
      aria-label="Server-simulated capsule machine"
    />
  );
}
