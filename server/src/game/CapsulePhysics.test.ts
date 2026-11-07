import { describe, expect, it } from 'vitest';
import { CapsulePhysics } from './CapsulePhysics.js';
import {
  CHUTE_LEFT,
  FILLER_BALL_COUNT,
  FIXED_TIMESTEP_MS,
  INITIAL_CAPSULE_COUNT,
  PHYSICS_HEIGHT,
} from './constants.js';
import { GameRoom } from './GameRoom.js';

describe('CapsulePhysics', () => {
  it('starts with the full capsule count distributed across all six colors', () => {
    const physics = new CapsulePhysics(() => 0.5);
    const state = physics.serialize();

    expect(state).toHaveLength(INITIAL_CAPSULE_COUNT);
    expect(new Set(state.map((capsule) => capsule.color)).size).toBe(6);
  });

  it('refills removed capsules to the requested count', () => {
    const physics = new CapsulePhysics(() => 0.5);
    const [first] = physics.serialize();

    expect(physics.removeCapsule(first!.id)).toBe(true);
    expect(physics.count).toBe(INITIAL_CAPSULE_COUNT - 1);
    physics.refill();
    expect(physics.count).toBe(INITIAL_CAPSULE_COUNT);
  });

  it('never grabs filler balls and excludes them from the capsule count', () => {
    const physics = new CapsulePhysics(() => 0.5, 0, FILLER_BALL_COUNT);
    const [ball] = physics.serializeBalls();

    expect(physics.count).toBe(0);
    expect(physics.serializeBalls()).toHaveLength(FILLER_BALL_COUNT);
    expect(physics.peekNearest(ball!.x, ball!.z, 1_000)).toBeNull();
    expect(physics.takeNearest(ball!.x, ball!.z, 1_000)).toBeNull();
    expect(physics.serializeBalls()).toHaveLength(FILLER_BALL_COUNT);
  });

  it('spawns refilled capsules inside the machine after many refills', () => {
    const physics = new CapsulePhysics(() => 0.5);
    for (let round = 0; round < 5; round += 1) {
      for (const capsule of physics.serialize().slice(5)) {
        physics.removeCapsule(capsule.id);
      }
      physics.refill();
    }

    expect(
      physics
        .serialize()
        .every((capsule) => capsule.y < PHYSICS_HEIGHT && capsule.x < CHUTE_LEFT),
    ).toBe(true);
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
    expect(state.capsules).toHaveLength(INITIAL_CAPSULE_COUNT);
    expect(state.claws).toHaveLength(3);
    expect(state.players).toEqual([null, null, null]);
    expect(state.recentWins).toEqual([]);
  });
});
