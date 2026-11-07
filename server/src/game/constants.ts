import type { CapsuleColor } from '@capsule-claw/shared';

export const PHYSICS_WIDTH = 1200;
export const PHYSICS_HEIGHT = 620;
export const PHYSICS_DEPTH = 620;
export const CAPSULE_RADIUS = 42;
export const INITIAL_CAPSULE_COUNT = 40;
export const BALL_RADIUS = 38;
export const FILLER_BALL_COUNT = 60;
export const DEPTH_LAYERS: ReadonlyArray<readonly [number, number]> = [
  [40, 200],
  [220, 380],
  [400, 580],
];
export const CHUTE_LEFT = 1030;
export const CLAW_GRAB_RADIUS = 2 * CAPSULE_RADIUS * 1.2;
export const HELD_CAPSULE_OFFSET = 180;
export const FIXED_TIMESTEP_MS = 1000 / 60;
export const SNAPSHOT_INTERVAL_MS = 1000 / 20;
export const TURN_DURATION_MS = 30_000;
export const CLAW_X_MIN = 70;
export const CLAW_X_MAX = PHYSICS_WIDTH - 70;
export const CLAW_Z_MIN = 50;
export const CLAW_Z_MAX = PHYSICS_DEPTH - 50;
export const CLAW_MOVE_SPEED = 300;
export const CLAW_DROP_DEPTH = 400;
export const DROP_DURATION_MS = 700;
export const LIFT_DURATION_MS = 700;
export const DISPENSE_DURATION_MS = 900;
export const RESULT_DURATION_MS = 3_000;
export const DISCONNECT_GRACE_MS = 10_000;
export const COOLDOWN_DURATION_MS = 10_000;
export const IDLE_TIMEOUT_MS = 60_000;
export const REFILL_THRESHOLD = 5;
export const OUTLET_X = (CHUTE_LEFT + PHYSICS_WIDTH) / 2;
export const OUTLET_Z = PHYSICS_DEPTH - 110;

export const CAPSULE_COLORS: readonly CapsuleColor[] = [
  'coral',
  'gold',
  'mint',
  'sky',
  'violet',
  'pink',
];
