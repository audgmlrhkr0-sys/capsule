import { describe, expect, it } from 'vitest';
import {
  DISCONNECT_GRACE_MS,
  FIXED_TIMESTEP_MS,
  IDLE_TIMEOUT_MS,
  INITIAL_CAPSULE_COUNT,
} from './constants.js';
import { GameRoom } from './GameRoom.js';

function setup() {
  let now = 0;
  let token = 0;
  const game = new GameRoom(
    '1234',
    () => 0.5,
    () => now,
    () => `session-${++token}`,
  );
  return {
    game,
    now: () => now,
    setNow: (value: number) => {
      now = value;
    },
  };
}

function finishTurn(game: GameRoom, slot = 0): void {
  expect(game.requestDrop(slot as 0 | 1 | 2)).toBe(true);
  for (let frame = 0; frame < 325; frame += 1) {
    game.tick(FIXED_TIMESTEP_MS);
  }
}

describe('session and queue lifecycle', () => {
  it('promotes queued sessions in FIFO order after a completed turn', () => {
    const { game } = setup();
    game.connect('하나', undefined, 'socket-1');
    game.connect('둘', undefined, 'socket-2');
    game.connect('셋', undefined, 'socket-3');
    const fourth = game.connect('넷', undefined, 'socket-4');
    const fifth = game.connect('다섯', undefined, 'socket-5');
    game.drainLifecycleEvents();

    expect(fourth).toMatchObject({ status: 'queued', position: 1 });
    expect(fifth).toMatchObject({ status: 'queued', position: 2 });
    finishTurn(game);

    expect(game.serialize().players[0]?.nickname).toBe('넷');
    expect(game.drainLifecycleEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'joined', sessionToken: 'session-4', slot: 0 }),
        expect.objectContaining({
          type: 'queue:update',
          sessionToken: 'session-5',
          position: 1,
        }),
      ]),
    );
  });

  it('restores a disconnected active session without resetting its turn', () => {
    const { game, setNow } = setup();
    const joined = game.connect('하나', undefined, 'socket-1');
    if (joined.status !== 'joined') throw new Error('Expected joined session');
    const originalEnd = game.getTurnStart(joined.slot)?.endsAt;

    game.disconnect(joined.sessionToken, 'socket-1');
    setNow(DISCONNECT_GRACE_MS - 1);
    game.tick(FIXED_TIMESTEP_MS);
    const restored = game.connect('하나', joined.sessionToken, 'socket-2');

    expect(restored).toEqual(joined);
    expect(game.getTurnStart(joined.slot)?.endsAt).toBe(originalEnd);
  });

  it('restores the same queued position during disconnect grace', () => {
    const { game, setNow } = setup();
    game.connect('하나', undefined, 'socket-1');
    game.connect('둘', undefined, 'socket-2');
    game.connect('셋', undefined, 'socket-3');
    const queued = game.connect('넷', undefined, 'socket-4');
    game.connect('다섯', undefined, 'socket-5');
    if (queued.status !== 'queued') throw new Error('Expected queued session');

    game.disconnect(queued.sessionToken, 'socket-4');
    setNow(DISCONNECT_GRACE_MS - 1);
    game.tick(FIXED_TIMESTEP_MS);

    expect(game.connect('넷', queued.sessionToken, 'socket-6')).toEqual(queued);
  });

  it('rejects a newer simultaneous connection for the same token', () => {
    const { game } = setup();
    const joined = game.connect('하나', undefined, 'socket-1');
    if (joined.status !== 'joined') throw new Error('Expected joined session');

    expect(game.connect('하나', joined.sessionToken, 'socket-2')).toEqual({
      status: 'rejected',
      error: 'This session is already connected on another device',
    });
  });

  it('expires disconnect grace and promotes the queue', () => {
    const { game, setNow } = setup();
    const first = game.connect('하나', undefined, 'socket-1');
    game.connect('둘', undefined, 'socket-2');
    game.connect('셋', undefined, 'socket-3');
    game.connect('넷', undefined, 'socket-4');
    if (first.status !== 'joined') throw new Error('Expected joined session');
    game.drainLifecycleEvents();

    game.disconnect(first.sessionToken, 'socket-1');
    setNow(DISCONNECT_GRACE_MS);
    game.tick(FIXED_TIMESTEP_MS);

    expect(game.serialize().players[0]?.nickname).toBe('넷');
  });

  it('evicts idle sessions and promotes waiting players', () => {
    const { game, setNow } = setup();
    const first = game.connect('하나', undefined, 'socket-1');
    const second = game.connect('둘', undefined, 'socket-2');
    const third = game.connect('셋', undefined, 'socket-3');
    const fourth = game.connect('넷', undefined, 'socket-4');
    if (
      first.status !== 'joined' ||
      second.status !== 'joined' ||
      third.status !== 'joined' ||
      fourth.status !== 'queued'
    ) {
      throw new Error('Unexpected setup');
    }

    setNow(IDLE_TIMEOUT_MS - 1);
    game.touchSession(second.sessionToken);
    game.touchSession(third.sessionToken);
    game.touchSession(fourth.sessionToken);
    setNow(IDLE_TIMEOUT_MS);
    game.tick(FIXED_TIMESTEP_MS);

    expect(game.serialize().players[0]?.nickname).toBe('넷');
    expect(game.drainLifecycleEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'kicked', sessionToken: first.sessionToken }),
      ]),
    );
  });

  it('requires cooldown completion before the same session can rejoin', () => {
    const { game, setNow } = setup();
    const joined = game.connect('하나', undefined, 'socket-1');
    if (joined.status !== 'joined') throw new Error('Expected joined session');
    finishTurn(game);
    const cooldown = game
      .drainLifecycleEvents()
      .find((event) => event.type === 'cooldown');
    if (!cooldown || cooldown.type !== 'cooldown') {
      throw new Error('Expected cooldown event');
    }

    setNow(cooldown.endsAt - 1);
    expect(game.connect('하나', joined.sessionToken, 'socket-1')).toMatchObject({
      status: 'cooldown',
    });
    setNow(cooldown.endsAt);
    expect(game.connect('하나', joined.sessionToken, 'socket-1')).toMatchObject({
      status: 'joined',
      slot: 0,
    });
  });

  it('refills only when claw operations are safe and count is five or less', () => {
    const { game } = setup();
    game.connect('하나', undefined, 'socket-1');
    for (const capsule of game.physics.serialize().slice(0, INITIAL_CAPSULE_COUNT - 5)) {
      game.physics.removeCapsule(capsule.id);
    }
    expect(game.physics.count).toBe(5);

    game.requestDrop(0);
    expect(game.refillCapsules(true)).toBe(false);
    for (let frame = 0; frame < 150; frame += 1) {
      game.tick(FIXED_TIMESTEP_MS);
    }
    expect(game.physics.count).toBe(INITIAL_CAPSULE_COUNT);
  });
});
