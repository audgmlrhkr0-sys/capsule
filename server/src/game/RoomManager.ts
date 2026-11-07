import { randomUUID } from 'node:crypto';
import type { DisplayJoined } from '@capsule-claw/shared';
import { generateRoomCode, type RandomInteger } from '../utils/roomCode.js';
import type { WinLogStore } from '../logging/WinLogStore.js';
import { PrizeService } from '../prizes/PrizeService.js';
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
    private readonly prizes: PrizeService = new PrizeService([
      { id: 'default', name: '캡슐 기념품', weight: 1, stock: 100_000 },
    ]),
    private readonly winLog?: WinLogStore,
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
      game: new GameRoom(
        roomCode,
        Math.random,
        Date.now,
        randomUUID,
        this.prizes,
        this.winLog,
      ),
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
