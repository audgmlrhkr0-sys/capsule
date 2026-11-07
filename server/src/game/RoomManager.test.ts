import { describe, expect, it } from 'vitest';
import { RoomManager } from './RoomManager.js';

describe('RoomManager', () => {
  it('creates a room with a public play URL', () => {
    const rooms = new RoomManager('https://example.test', () => 42, () => 'token-1');

    expect(rooms.createOrReconnect()).toEqual({
      roomCode: '0042',
      displayToken: 'token-1',
      playUrl: 'https://example.test/play/0042',
      reconnected: false,
    });
  });

  it('reconnects a known token to the original room', () => {
    let nextCode = 1000;
    const rooms = new RoomManager(
      'https://example.test',
      () => nextCode++,
      () => 'stable-token',
    );
    const created = rooms.createOrReconnect();
    const reconnected = rooms.createOrReconnect(created.displayToken);

    expect(reconnected.roomCode).toBe(created.roomCode);
    expect(reconnected.displayToken).toBe(created.displayToken);
    expect(reconnected.reconnected).toBe(true);
  });

  it('avoids room-code collisions', () => {
    const values = [1234, 1234, 5678];
    let token = 0;
    const rooms = new RoomManager(
      'https://example.test',
      () => values.shift() ?? 9999,
      () => `token-${token++}`,
    );

    expect(rooms.createOrReconnect().roomCode).toBe('1234');
    expect(rooms.createOrReconnect().roomCode).toBe('5678');
  });
});
