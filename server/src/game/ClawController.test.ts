import { describe, expect, it } from 'vitest';
import { CapsulePhysics } from './CapsulePhysics.js';
import {
  CAPSULE_RADIUS,
  CLAW_X_MAX,
  FIXED_TIMESTEP_MS,
  RESULT_DURATION_MS,
  TURN_DURATION_MS,
} from './constants.js';
import { GameRoom } from './GameRoom.js';

function createGame(now: () => number = () => 0): GameRoom {
  return new GameRoom('1234', () => 0.5, now, () => 'session-1');
}

function tickFrames(game: GameRoom, frames: number): void {
  for (let frame = 0; frame < frames; frame += 1) {
    game.tick(FIXED_TIMESTEP_MS);
  }
}

describe('server-authoritative claw turns', () => {
  it('moves continuously, clamps bounds, and cancels opposite directions', () => {
    const game = createGame();
    game.join('손님');

    game.setDirection(0, 'left', true);
    game.setDirection(0, 'right', true);
    tickFrames(game, 30);
    expect(game.serialize().claws[0]!.x).toBe(600);

    game.setDirection(0, 'left', false);
    tickFrames(game, 300);
    expect(game.serialize().claws[0]!.x).toBe(CLAW_X_MAX);
  });

  it('accepts only one drop per turn', () => {
    const game = createGame();
    game.join('손님');

    expect(game.requestDrop(0)).toBe(true);
    expect(game.requestDrop(0)).toBe(false);
    expect(game.serialize().claws[0]!.phase).toBe('dropping');
  });

  it('auto-drops at the exact server deadline', () => {
    let now = 0;
    const game = createGame(() => now);
    game.join('손님');
    expect(game.getTurnStart(0)?.endsAt).toBe(TURN_DURATION_MS);

    now = TURN_DURATION_MS;
    game.tick(FIXED_TIMESTEP_MS);
    expect(game.serialize().claws[0]!.phase).toBe('dropping');
  });

  it('uses the exact 2 × radius × 1.2 hit boundary', () => {
    const threshold = 2 * CAPSULE_RADIUS * 1.2;
    const hitPhysics = new CapsulePhysics(() => 0.5);
    const hitTarget = hitPhysics.serialize().at(-1)!;
    expect(
      hitPhysics.takeNearest(hitTarget.x + threshold, hitTarget.z, threshold),
    ).not.toBeNull();

    const missPhysics = new CapsulePhysics(() => 0.5);
    const missTarget = missPhysics.serialize().at(-1)!;
    expect(
      missPhysics.takeNearest(
        missTarget.x + threshold + 0.01,
        missTarget.z,
        threshold,
      ),
    ).toBeNull();
  });

  it('completes drop, lift, dispense, and result phases deterministically', () => {
    const game = createGame();
    game.join('손님');
    expect(game.requestDrop(0)).toBe(true);

    tickFrames(game, 45);
    expect(game.serialize().claws[0]!.phase).toBe('lifting');
    tickFrames(game, 45);
    expect(game.serialize().claws[0]!.phase).toBe('dispensing');
    tickFrames(game, 58);
    expect(game.serialize().claws[0]!.phase).toBe('result');
    expect(game.drainTurnResults()).toEqual([{ slot: 0, success: true }]);
    expect(game.physics.count).toBe(35);

    tickFrames(game, Math.ceil(RESULT_DURATION_MS / FIXED_TIMESTEP_MS) + 1);
    expect(game.serialize().claws[0]!.phase).toBe('waiting');
  });
});
