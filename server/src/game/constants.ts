import type { CapsuleColor } from '@capsule-claw/shared';

export const PHYSICS_WIDTH = 1200;
export const PHYSICS_HEIGHT = 620;
export const PHYSICS_DEPTH = 620;
export const CAPSULE_RADIUS = 38;
export const INITIAL_CAPSULE_COUNT = 36;
export const FIXED_TIMESTEP_MS = 1000 / 60;
export const SNAPSHOT_INTERVAL_MS = 1000 / 20;
export const TURN_DURATION_MS = 30_000;
export const CLAW_X_MIN = 70;
export const CLAW_X_MAX = PHYSICS_WIDTH - 70;
export const CLAW_Z_MIN = 50;
export const CLAW_Z_MAX = PHYSICS_DEPTH - 50;
export const CLAW_MOVE_SPEED = 300;
export const CLAW_DROP_DEPTH = 360;
export const DROP_DURATION_MS = 700;
export const LIFT_DURATION_MS = 700;
export const DISPENSE_DURATION_MS = 900;
export const RESULT_DURATION_MS = 3_000;
export const OUTLET_X = PHYSICS_WIDTH - 105;
export const OUTLET_Z = PHYSICS_DEPTH / 2;

export const CAPSULE_COLORS: readonly CapsuleColor[] = [
  'coral',
  'gold',
  'mint',
  'sky',
  'violet',
  'pink',
];
