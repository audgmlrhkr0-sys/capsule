import { describe, expect, it } from 'vitest';
import { GameRoom } from './GameRoom.js';

function createRoom(): GameRoom {
  let token = 0;
  return new GameRoom('1234', () => 0.5, () => 1_000, () => `session-${++token}`);
}

describe('GameRoom player slots', () => {
  it('assigns the three slots and exposes players in snapshots', () => {
    const game = createRoom();

    expect(game.join('하나')).toMatchObject({ status: 'joined', slot: 0 });
    expect(game.join('둘')).toMatchObject({ status: 'joined', slot: 1 });
    expect(game.join('셋')).toMatchObject({ status: 'joined', slot: 2 });
    expect(game.serialize().players.map((player) => player?.nickname)).toEqual([
      '하나',
      '둘',
      '셋',
    ]);
  });

  it('queues a fourth player and returns the same queue position for its token', () => {
    const game = createRoom();
    game.join('하나');
    game.join('둘');
    game.join('셋');

    const queued = game.join('넷');
    expect(queued).toEqual({
      status: 'queued',
      position: 1,
      sessionToken: 'session-4',
    });
    expect(game.join('넷', queued.sessionToken)).toEqual(queued);
  });

  it('releases an occupied slot when its session leaves', () => {
    const game = createRoom();
    const joined = game.join('하나');
    if (joined.status !== 'joined') {
      throw new Error('Expected joined player');
    }

    expect(game.leave(joined.sessionToken)).toBe(0);
    expect(game.serialize().players[0]).toBeNull();
    expect(game.join('새손님')).toMatchObject({ status: 'joined', slot: 0 });
  });
});
