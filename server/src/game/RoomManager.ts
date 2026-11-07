import { randomUUID } from 'node:crypto';
import type { DisplayJoined } from '@capsule-claw/shared';
import { generateRoomCode, type RandomInteger } from '../utils/roomCode.js';
import { GameRoom } from './GameRoom.js';

interface DisplayRoom {
  roomCode: string;
  displayToken: string;
  game: GameRoom;
}

export class RoomManager {
  private readonly roomsByCode = new Map<string, DisplayRoom>();
  private readonly roomsByToken = new Map<string, DisplayRoom>();

  constructor(
    private readonly publicUrl: string,
    private readonly randomInteger?: RandomInteger,
    private readonly createToken: () => string = randomUUID,
  ) {}

  createOrReconnect(displayToken?: string): DisplayJoined {
    if (displayToken) {
      const existing = this.roomsByToken.get(displayToken);
      if (existing) {
        return this.toDisplayJoined(existing, true);
      }
    }

    const roomCode = this.allocateRoomCode();
    const room: DisplayRoom = {
      roomCode,
      displayToken: this.createToken(),
      game: new GameRoom(roomCode),
    };
    this.roomsByCode.set(room.roomCode, room);
    this.roomsByToken.set(room.displayToken, room);
    return this.toDisplayJoined(room, false);
  }

  hasRoom(roomCode: string): boolean {
    return this.roomsByCode.has(roomCode);
  }

  getGame(roomCode: string): GameRoom | undefined {
    return this.roomsByCode.get(roomCode)?.game;
  }

  games(): IterableIterator<GameRoom> {
    return [...this.roomsByCode.values()].map((room) => room.game).values();
  }

  private allocateRoomCode(): string {
    for (let attempt = 0; attempt < 10_000; attempt += 1) {
      const roomCode = generateRoomCode(this.randomInteger);
      if (!this.roomsByCode.has(roomCode)) {
        return roomCode;
      }
    }
    throw new Error('No room codes are available');
  }

  private toDisplayJoined(room: DisplayRoom, reconnected: boolean): DisplayJoined {
    return {
      roomCode: room.roomCode,
      displayToken: room.displayToken,
      playUrl: `${this.publicUrl}/play/${room.roomCode}`,
      reconnected,
    };
  }
}
