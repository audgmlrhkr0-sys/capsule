import { randomUUID } from 'node:crypto';
import type {
  ClawState,
  JoinResult,
  PlayerColor,
  PlayerState,
  PublicGameState,
  SlotId,
} from '@capsule-claw/shared';
import { CapsulePhysics } from './CapsulePhysics.js';

const CLAW_X = [250, 600, 950] as const;
const PLAYER_COLORS: readonly PlayerColor[] = ['red', 'blue', 'yellow'];

interface QueuedPlayer {
  nickname: string;
  sessionToken: string;
}

export class GameRoom {
  readonly physics: CapsulePhysics;
  private readonly playerSlots: [
    PlayerState | null,
    PlayerState | null,
    PlayerState | null,
  ] = [null, null, null];
  private readonly sessionSlots = new Map<string, SlotId>();
  private readonly queue: QueuedPlayer[] = [];

  constructor(
    readonly roomCode: string,
    random: () => number = Math.random,
    private readonly now: () => number = Date.now,
    private readonly createSessionToken: () => string = randomUUID,
  ) {
    this.physics = new CapsulePhysics(random);
  }

  tick(fixedDeltaMs: number): void {
    this.physics.tick(fixedDeltaMs);
  }

  join(nickname: string, sessionToken?: string): JoinResult {
    if (sessionToken) {
      const existingSlot = this.sessionSlots.get(sessionToken);
      if (existingSlot !== undefined) {
        return { status: 'joined', slot: existingSlot, sessionToken };
      }
      const queuedIndex = this.queue.findIndex((player) => player.sessionToken === sessionToken);
      if (queuedIndex >= 0) {
        return { status: 'queued', position: queuedIndex + 1, sessionToken };
      }
    }

    const token = this.createSessionToken();
    const slot = this.playerSlots.findIndex((player) => player === null);
    if (slot < 0) {
      this.queue.push({ nickname, sessionToken: token });
      return { status: 'queued', position: this.queue.length, sessionToken: token };
    }

    const slotId = slot as SlotId;
    this.playerSlots[slotId] = {
      slot: slotId,
      nickname,
      color: PLAYER_COLORS[slotId]!,
      turnEndsAt: null,
    };
    this.sessionSlots.set(token, slotId);
    return { status: 'joined', slot: slotId, sessionToken: token };
  }

  leave(sessionToken: string): SlotId | null {
    const slot = this.sessionSlots.get(sessionToken);
    if (slot !== undefined) {
      this.sessionSlots.delete(sessionToken);
      this.playerSlots[slot] = null;
      return slot;
    }

    const queuedIndex = this.queue.findIndex((player) => player.sessionToken === sessionToken);
    if (queuedIndex >= 0) {
      this.queue.splice(queuedIndex, 1);
    }
    return null;
  }

  getPlayer(slot: SlotId): PlayerState | null {
    return this.playerSlots[slot];
  }

  serialize(): PublicGameState {
    return {
      roomCode: this.roomCode,
      serverTime: this.now(),
      capsules: this.physics.serialize(),
      claws: CLAW_X.map((x, slot) => this.waitingClaw(slot as SlotId, x)),
      players: this.playerSlots.map((player) => (player ? { ...player } : null)),
      recentWins: [],
    };
  }

  private waitingClaw(slot: SlotId, x: number): ClawState {
    return {
      slot,
      x,
      z: 0.5,
      height: 0,
      phase: 'waiting',
      heldCapsuleId: null,
    };
  }
}
