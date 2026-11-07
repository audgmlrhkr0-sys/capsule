import { randomUUID } from 'node:crypto';
import type {
  CapsuleState,
  ClawState,
  Direction,
  JoinResult,
  PlayerColor,
  PlayerState,
  PublicGameState,
  SlotId,
} from '@capsule-claw/shared';
import { CapsulePhysics } from './CapsulePhysics.js';
import {
  CAPSULE_RADIUS,
  CLAW_DROP_DEPTH,
  CLAW_MOVE_SPEED,
  CLAW_X_MAX,
  CLAW_X_MIN,
  CLAW_Z_MAX,
  CLAW_Z_MIN,
  DISPENSE_DURATION_MS,
  DROP_DURATION_MS,
  LIFT_DURATION_MS,
  OUTLET_X,
  OUTLET_Z,
  PHYSICS_DEPTH,
  PHYSICS_WIDTH,
  RESULT_DURATION_MS,
  TURN_DURATION_MS,
} from './constants.js';

const PLAYER_COLORS: readonly PlayerColor[] = ['red', 'blue', 'yellow'];

interface QueuedPlayer {
  nickname: string;
  sessionToken: string;
}

interface RuntimeClaw extends ClawState {
  pressed: Set<Direction>;
  phaseElapsed: number;
  dispenseFromX: number;
  dispenseFromZ: number;
  success: boolean;
}

export interface TurnResultEvent {
  slot: SlotId;
  success: boolean;
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
  private readonly claws: [RuntimeClaw, RuntimeClaw, RuntimeClaw] = [
    this.createWaitingClaw(0),
    this.createWaitingClaw(1),
    this.createWaitingClaw(2),
  ];
  private readonly heldCapsules = new Map<SlotId, CapsuleState>();
  private readonly turnResults: TurnResultEvent[] = [];

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
    for (const slot of [0, 1, 2] as const) {
      this.tickClaw(slot, fixedDeltaMs);
    }
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
      turnEndsAt: this.now() + TURN_DURATION_MS,
    };
    this.sessionSlots.set(token, slotId);
    this.startTurn(slotId);
    return { status: 'joined', slot: slotId, sessionToken: token };
  }

  leave(sessionToken: string): SlotId | null {
    const slot = this.sessionSlots.get(sessionToken);
    if (slot !== undefined) {
      this.sessionSlots.delete(sessionToken);
      this.playerSlots[slot] = null;
      this.heldCapsules.delete(slot);
      this.claws[slot] = this.createWaitingClaw(slot);
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

  getTurnStart(slot: SlotId): { timeLimit: number; endsAt: number } | null {
    const endsAt = this.playerSlots[slot]?.turnEndsAt;
    return endsAt
      ? { timeLimit: TURN_DURATION_MS, endsAt }
      : null;
  }

  setDirection(slot: SlotId, direction: Direction, pressed: boolean): boolean {
    const claw = this.claws[slot];
    if (claw.phase !== 'aiming') {
      return false;
    }
    if (pressed) {
      claw.pressed.add(direction);
    } else {
      claw.pressed.delete(direction);
    }
    return true;
  }

  requestDrop(slot: SlotId): boolean {
    const claw = this.claws[slot];
    if (claw.phase !== 'aiming') {
      return false;
    }
    claw.phase = 'dropping';
    claw.phaseElapsed = 0;
    claw.pressed.clear();
    const player = this.playerSlots[slot];
    if (player) {
      player.turnEndsAt = null;
    }
    return true;
  }

  drainTurnResults(): TurnResultEvent[] {
    return this.turnResults.splice(0);
  }

  serialize(): PublicGameState {
    return {
      roomCode: this.roomCode,
      serverTime: this.now(),
      capsules: [...this.physics.serialize(), ...this.heldCapsules.values()],
      claws: this.claws.map(({ pressed, phaseElapsed, dispenseFromX, dispenseFromZ, success, ...claw }) => ({
        ...claw,
      })),
      players: this.playerSlots.map((player) => (player ? { ...player } : null)),
      recentWins: [],
    };
  }

  private startTurn(slot: SlotId): void {
    const claw = this.createWaitingClaw(slot);
    claw.phase = 'aiming';
    this.claws[slot] = claw;
  }

  private tickClaw(slot: SlotId, deltaMs: number): void {
    const claw = this.claws[slot];
    if (claw.phase === 'aiming') {
      this.moveClaw(claw, deltaMs);
      const endsAt = this.playerSlots[slot]?.turnEndsAt;
      if (endsAt !== null && endsAt !== undefined && this.now() >= endsAt) {
        this.requestDrop(slot);
      }
      return;
    }
    if (claw.phase === 'waiting' || claw.phase === 'cooldown') {
      return;
    }

    claw.phaseElapsed += deltaMs;
    if (claw.phase === 'dropping') {
      const progress = Math.min(1, claw.phaseElapsed / DROP_DURATION_MS);
      claw.height = CLAW_DROP_DEPTH * progress;
      if (progress === 1) {
        const threshold = 2 * CAPSULE_RADIUS * 1.2;
        const capsule = this.physics.takeNearest(claw.x, claw.z, threshold);
        claw.success = capsule !== null;
        if (capsule) {
          claw.heldCapsuleId = capsule.id;
          this.heldCapsules.set(slot, capsule);
          this.positionHeldCapsule(slot);
        }
        claw.phase = 'lifting';
        claw.phaseElapsed = 0;
      }
      return;
    }

    if (claw.phase === 'lifting') {
      const progress = Math.min(1, claw.phaseElapsed / LIFT_DURATION_MS);
      claw.height = CLAW_DROP_DEPTH * (1 - progress);
      this.positionHeldCapsule(slot);
      if (progress === 1) {
        claw.phase = 'dispensing';
        claw.phaseElapsed = 0;
        claw.dispenseFromX = claw.x;
        claw.dispenseFromZ = claw.z;
      }
      return;
    }

    if (claw.phase === 'dispensing') {
      const progress = Math.min(1, claw.phaseElapsed / DISPENSE_DURATION_MS);
      claw.x = lerp(claw.dispenseFromX, OUTLET_X, progress);
      claw.z = lerp(claw.dispenseFromZ, OUTLET_Z, progress);
      this.positionHeldCapsule(slot);
      if (progress === 1) {
        this.heldCapsules.delete(slot);
        claw.heldCapsuleId = null;
        claw.phase = 'result';
        claw.phaseElapsed = 0;
        this.turnResults.push({ slot, success: claw.success });
      }
      return;
    }

    if (claw.phase === 'result' && claw.phaseElapsed >= RESULT_DURATION_MS) {
      claw.phase = 'waiting';
      claw.phaseElapsed = 0;
    }
  }

  private moveClaw(claw: RuntimeClaw, deltaMs: number): void {
    const horizontal =
      Number(claw.pressed.has('right')) - Number(claw.pressed.has('left'));
    const depth =
      Number(claw.pressed.has('down')) - Number(claw.pressed.has('up'));
    const distance = CLAW_MOVE_SPEED * (deltaMs / 1000);
    claw.x = clamp(claw.x + horizontal * distance, CLAW_X_MIN, CLAW_X_MAX);
    claw.z = clamp(claw.z + depth * distance, CLAW_Z_MIN, CLAW_Z_MAX);
  }

  private positionHeldCapsule(slot: SlotId): void {
    const capsule = this.heldCapsules.get(slot);
    const claw = this.claws[slot];
    if (!capsule) {
      return;
    }
    capsule.x = claw.x;
    capsule.z = claw.z;
    capsule.y = 180 + claw.height;
    capsule.angle = 0;
  }

  private createWaitingClaw(slot: SlotId): RuntimeClaw {
    return {
      slot,
      x: PHYSICS_WIDTH / 2,
      z: PHYSICS_DEPTH / 2,
      height: 0,
      phase: 'waiting',
      heldCapsuleId: null,
      pressed: new Set(),
      phaseElapsed: 0,
      dispenseFromX: PHYSICS_WIDTH / 2,
      dispenseFromZ: PHYSICS_DEPTH / 2,
      success: false,
    };
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}
