import type { CapsuleColor } from '@capsule-claw/shared';

export const PHYSICS_WIDTH = 1200;
export const PHYSICS_HEIGHT = 620;
export const CAPSULE_RADIUS = 38;
export const INITIAL_CAPSULE_COUNT = 36;
export const FIXED_TIMESTEP_MS = 1000 / 60;
export const SNAPSHOT_INTERVAL_MS = 1000 / 20;

export const CAPSULE_COLORS: readonly CapsuleColor[] = [
  'coral',
  'gold',
  'mint',
  'sky',
  'violet',
  'pink',
];
