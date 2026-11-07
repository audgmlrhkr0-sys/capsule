import { describe, expect, it } from 'vitest';
import { CapsulePhysics } from './CapsulePhysics.js';
import { FIXED_TIMESTEP_MS, INITIAL_CAPSULE_COUNT } from './constants.js';
import { GameRoom } from './GameRoom.js';

describe('CapsulePhysics', () => {
  it('starts with 36 capsules distributed across all six colors', () => {
    const physics = new CapsulePhysics(() => 0.5);
    const state = physics.serialize();

    expect(state).toHaveLength(INITIAL_CAPSULE_COUNT);
    expect(new Set(state.map((capsule) => capsule.color)).size).toBe(6);
  });

  it('refills removed capsules to the requested count', () => {
    const physics = new CapsulePhysics(() => 0.5);
    const [first] = physics.serialize();

    expect(physics.removeCapsule(first!.id)).toBe(true);
    expect(physics.count).toBe(35);
    physics.refill();
    expect(physics.count).toBe(36);
  });

  it('advances bodies with a fixed physics tick and serializes finite values', () => {
    const physics = new CapsulePhysics(() => 0.5);
    const before = physics.serialize();
    physics.tick(FIXED_TIMESTEP_MS);
    const after = physics.serialize();

    expect(after.some((capsule, index) => capsule.y !== before[index]!.y)).toBe(true);
    expect(
      after.every((capsule) =>
        [capsule.x, capsule.y, capsule.angle, capsule.z].every(Number.isFinite),
      ),
    ).toBe(true);
  });
});

describe('GameRoom serialization', () => {
  it('publishes a complete waiting-state snapshot', () => {
    const game = new GameRoom('0420', () => 0.5, () => 123_456);
    const state = game.serialize();

    expect(state.roomCode).toBe('0420');
    expect(state.serverTime).toBe(123_456);
    expect(state.capsules).toHaveLength(36);
    expect(state.claws).toHaveLength(3);
    expect(state.players).toEqual([null, null, null]);
    expect(state.recentWins).toEqual([]);
  });
});
