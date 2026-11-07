import type { ClawState, PublicGameState, SlotId } from '@capsule-claw/shared';
import { CapsulePhysics } from './CapsulePhysics.js';

const CLAW_X = [250, 600, 950] as const;

export class GameRoom {
  readonly physics: CapsulePhysics;

  constructor(
    readonly roomCode: string,
    random: () => number = Math.random,
    private readonly now: () => number = Date.now,
  ) {
    this.physics = new CapsulePhysics(random);
  }

  tick(fixedDeltaMs: number): void {
    this.physics.tick(fixedDeltaMs);
  }

  serialize(): PublicGameState {
    return {
      roomCode: this.roomCode,
      serverTime: this.now(),
      capsules: this.physics.serialize(),
      claws: CLAW_X.map((x, slot) => this.waitingClaw(slot as SlotId, x)),
      players: [null, null, null],
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
