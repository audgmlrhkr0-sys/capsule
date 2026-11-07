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
  WinRecord,
} from '@capsule-claw/shared';
import type { WinLogStore } from '../logging/WinLogStore.js';
import { PrizeService } from '../prizes/PrizeService.js';
import { CapsulePhysics } from './CapsulePhysics.js';
import {
  CAPSULE_RADIUS,
  CLAW_DROP_DEPTH,
  CLAW_MOVE_SPEED,
  CLAW_X_MAX,
  CLAW_X_MIN,
  CLAW_Z_MAX,
  CLAW_Z_MIN,
  COOLDOWN_DURATION_MS,
  DISCONNECT_GRACE_MS,
  DISPENSE_DURATION_MS,
  DROP_DURATION_MS,
  LIFT_DURATION_MS,
  IDLE_TIMEOUT_MS,
  OUTLET_X,
  OUTLET_Z,
  PHYSICS_DEPTH,
  PHYSICS_WIDTH,
  RESULT_DURATION_MS,
  REFILL_THRESHOLD,
  TURN_DURATION_MS,
} from './constants.js';

const PLAYER_COLORS: readonly PlayerColor[] = ['red', 'blue', 'yellow'];

interface ControllerSession {
  nickname: string;
  sessionToken: string;
  state: 'active' | 'queued' | 'cooldown';
  slot?: SlotId;
  connectedSocketId: string | null;
  disconnectedAt: number | null;
  lastActivityAt: number;
  cooldownEndsAt: number | null;
  lastResult: { success: boolean; prizeName?: string } | null;
}

interface RuntimeClaw extends ClawState {
  pressed: Set<Direction>;
  phaseElapsed: number;
  dispenseFromX: number;
  dispenseFromZ: number;
  success: boolean;
  prizeName: string | null;
}

export interface TurnResultEvent {
  sessionToken: string;
  slot: SlotId;
  success: boolean;
  prizeName?: string;
  win?: WinRecord;
}

export type SessionConnectResult =
  | JoinResult
  | { status: 'rejected'; error: string };

export type LifecycleEvent =
  | { type: 'player:left'; slot: SlotId }
  | {
      type: 'joined';
      sessionToken: string;
      slot: SlotId;
      turn: { timeLimit: number; endsAt: number };
    }
  | { type: 'queue:update'; sessionToken: string; position: number }
  | { type: 'cooldown'; sessionToken: string; endsAt: number }
  | { type: 'kicked'; sessionToken: string; reason: string };

export class GameRoom {
  readonly physics: CapsulePhysics;
  private readonly playerSlots: [
    PlayerState | null,
    PlayerState | null,
    PlayerState | null,
  ] = [null, null, null];
  private readonly sessions = new Map<string, ControllerSession>();
  private readonly queue: string[] = [];
  private readonly claws: [RuntimeClaw, RuntimeClaw, RuntimeClaw] = [
    this.createWaitingClaw(0),
    this.createWaitingClaw(1),
    this.createWaitingClaw(2),
  ];
  private readonly heldCapsules = new Map<SlotId, CapsuleState>();
  private readonly turnResults: TurnResultEvent[] = [];
  private readonly lifecycleEvents: LifecycleEvent[] = [];
  private readonly recentWins: WinRecord[] = [];

  constructor(
    readonly roomCode: string,
    random: () => number = Math.random,
    private readonly now: () => number = Date.now,
    private readonly createSessionToken: () => string = randomUUID,
    private readonly prizes: PrizeService = new PrizeService([
      { id: 'test-prize', name: '캡슐 기념품', weight: 1, stock: 100_000 },
    ]),
    private readonly winLog?: WinLogStore,
  ) {
    this.physics = new CapsulePhysics(random);
  }

  tick(fixedDeltaMs: number): void {
    this.physics.tick(fixedDeltaMs);
    this.evictExpiredSessions();
    for (const slot of [0, 1, 2] as const) {
      this.tickClaw(slot, fixedDeltaMs);
    }
    this.refillCapsules();
  }

  join(nickname: string, sessionToken?: string): JoinResult {
    const result = this.connect(nickname, sessionToken, 'test-connection');
    if (result.status === 'rejected') {
      throw new Error(result.error);
    }
    return result;
  }

  leave(sessionToken: string): SlotId | null {
    const slot = this.sessions.get(sessionToken)?.slot ?? null;
    this.removeSession(sessionToken, false);
    return slot;
  }

  connect(
    nickname: string,
    sessionToken: string | undefined,
    socketId: string,
  ): SessionConnectResult {
    const existing = sessionToken ? this.sessions.get(sessionToken) : undefined;
    if (existing) {
      if (
        existing.connectedSocketId !== null &&
        existing.connectedSocketId !== socketId
      ) {
        return {
          status: 'rejected',
          error: 'This session is already connected on another device',
        };
      }
      existing.connectedSocketId = socketId;
      existing.disconnectedAt = null;
      existing.lastActivityAt = this.now();
      existing.nickname = nickname;
      if (existing.state === 'active' && existing.slot !== undefined) {
        return {
          status: 'joined',
          slot: existing.slot,
          sessionToken: existing.sessionToken,
        };
      }
      if (existing.state === 'queued') {
        return {
          status: 'queued',
          position: this.queue.indexOf(existing.sessionToken) + 1,
          sessionToken: existing.sessionToken,
        };
      }
      if (
        existing.cooldownEndsAt !== null &&
        this.now() < existing.cooldownEndsAt
      ) {
        return {
          status: 'cooldown',
          endsAt: existing.cooldownEndsAt,
          sessionToken: existing.sessionToken,
        };
      }
      return this.assignOrQueue(existing);
    }

    const token = this.createSessionToken();
    const session: ControllerSession = {
      nickname,
      sessionToken: token,
      state: 'cooldown',
      connectedSocketId: socketId,
      disconnectedAt: null,
      lastActivityAt: this.now(),
      cooldownEndsAt: null,
      lastResult: null,
    };
    this.sessions.set(token, session);
    return this.assignOrQueue(session);
  }

  disconnect(sessionToken: string, socketId: string): void {
    const session = this.sessions.get(sessionToken);
    if (!session || session.connectedSocketId !== socketId) {
      return;
    }
    session.connectedSocketId = null;
    session.disconnectedAt = this.now();
    if (session.slot !== undefined) {
      this.claws[session.slot].pressed.clear();
    }
  }

  touchSession(sessionToken: string): boolean {
    const session = this.sessions.get(sessionToken);
    if (!session || (session.state !== 'active' && session.state !== 'queued')) {
      return false;
    }
    session.lastActivityAt = this.now();
    return true;
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

  getSessionRestore(sessionToken: string): {
    result: { success: boolean; prizeName?: string } | null;
    cooldownEndsAt: number | null;
  } | null {
    const session = this.sessions.get(sessionToken);
    return session
      ? {
          result: session.lastResult,
          cooldownEndsAt: session.cooldownEndsAt,
        }
      : null;
  }

  setSessionDirection(
    sessionToken: string,
    direction: Direction,
    pressed: boolean,
  ): boolean {
    const session = this.sessions.get(sessionToken);
    if (session?.state !== 'active' || session.slot === undefined) {
      return false;
    }
    const accepted = this.setDirection(session.slot, direction, pressed);
    if (accepted) {
      session.lastActivityAt = this.now();
    }
    return accepted;
  }

  requestSessionDrop(sessionToken: string): boolean {
    const session = this.sessions.get(sessionToken);
    if (session?.state !== 'active' || session.slot === undefined) {
      return false;
    }
    const accepted = this.requestDrop(session.slot);
    if (accepted) {
      session.lastActivityAt = this.now();
    }
    return accepted;
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

  drainLifecycleEvents(): LifecycleEvent[] {
    return this.lifecycleEvents.splice(0);
  }

  refillCapsules(force = false): boolean {
    const operationsActive = this.claws.some((claw) =>
      ['dropping', 'lifting', 'dispensing'].includes(claw.phase),
    );
    if (operationsActive || this.heldCapsules.size > 0) {
      return false;
    }
    if (force || this.physics.count <= REFILL_THRESHOLD) {
      this.physics.refill();
    }
    return true;
  }

  serialize(): PublicGameState {
    return {
      roomCode: this.roomCode,
      serverTime: this.now(),
      capsules: [...this.physics.serialize(), ...this.heldCapsules.values()],
      claws: this.claws.map(({ pressed, phaseElapsed, dispenseFromX, dispenseFromZ, success, prizeName, ...claw }) => ({
        ...claw,
      })),
      players: this.playerSlots.map((player) => (player ? { ...player } : null)),
      recentWins: this.recentWins.map((win) => ({ ...win })),
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
        claw.success = false;
        claw.prizeName = null;
        if (capsule) {
          claw.heldCapsuleId = capsule.id;
          this.heldCapsules.set(slot, capsule);
          this.positionHeldCapsule(slot);
          const prize = this.prizes.draw();
          if (prize) {
            claw.success = true;
            claw.prizeName = prize.name;
          }
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
        const player = this.playerSlots[slot];
        const session = this.sessionForSlot(slot);
        if (!session) {
          return;
        }
        if (claw.success && claw.prizeName && player) {
          const win: WinRecord = {
            wonAt: new Date(this.now()).toISOString(),
            slot,
            nickname: player.nickname,
            prizeName: claw.prizeName,
          };
          this.recentWins.unshift(win);
          this.recentWins.length = Math.min(this.recentWins.length, 5);
          this.winLog?.record(win);
          const result = {
            success: true as const,
            prizeName: claw.prizeName,
          };
          session.lastResult = result;
          this.turnResults.push({
            sessionToken: session.sessionToken,
            slot,
            ...result,
            win,
          });
        } else {
          session.lastResult = { success: false };
          this.turnResults.push({
            sessionToken: session.sessionToken,
            slot,
            success: false,
          });
        }
      }
      return;
    }

    if (claw.phase === 'result' && claw.phaseElapsed >= RESULT_DURATION_MS) {
      this.completeTurn(slot);
    }
  }

  private assignOrQueue(session: ControllerSession): JoinResult {
    session.cooldownEndsAt = null;
    session.lastResult = null;
    session.lastActivityAt = this.now();
    const availableSlot = this.playerSlots.findIndex((player) => player === null);
    if (availableSlot < 0) {
      session.state = 'queued';
      delete session.slot;
      if (!this.queue.includes(session.sessionToken)) {
        this.queue.push(session.sessionToken);
      }
      this.emitQueuePositions();
      return {
        status: 'queued',
        position: this.queue.indexOf(session.sessionToken) + 1,
        sessionToken: session.sessionToken,
      };
    }
    const slot = availableSlot as SlotId;
    this.activateSession(session, slot, false);
    return { status: 'joined', slot, sessionToken: session.sessionToken };
  }

  private activateSession(
    session: ControllerSession,
    slot: SlotId,
    emitLifecycle: boolean,
  ): void {
    session.state = 'active';
    session.slot = slot;
    session.cooldownEndsAt = null;
    session.lastResult = null;
    session.lastActivityAt = this.now();
    this.playerSlots[slot] = {
      slot,
      nickname: session.nickname,
      color: PLAYER_COLORS[slot]!,
      turnEndsAt: this.now() + TURN_DURATION_MS,
    };
    this.startTurn(slot);
    if (emitLifecycle) {
      this.lifecycleEvents.push({
        type: 'joined',
        sessionToken: session.sessionToken,
        slot,
        turn: this.getTurnStart(slot)!,
      });
    }
  }

  private completeTurn(slot: SlotId): void {
    const session = this.sessionForSlot(slot);
    this.releaseSlot(slot);
    if (!session) {
      this.promoteQueue(slot);
      return;
    }
    session.state = 'cooldown';
    delete session.slot;
    session.cooldownEndsAt = this.now() + COOLDOWN_DURATION_MS;
    this.lifecycleEvents.push({
      type: 'cooldown',
      sessionToken: session.sessionToken,
      endsAt: session.cooldownEndsAt,
    });
    this.promoteQueue(slot);
  }

  private releaseSlot(slot: SlotId): void {
    if (this.playerSlots[slot]) {
      this.playerSlots[slot] = null;
      this.lifecycleEvents.push({ type: 'player:left', slot });
    }
    this.heldCapsules.delete(slot);
    this.claws[slot] = this.createWaitingClaw(slot);
  }

  private promoteQueue(slot: SlotId): void {
    while (this.queue.length > 0) {
      const sessionToken = this.queue.shift()!;
      const session = this.sessions.get(sessionToken);
      if (session?.state === 'queued') {
        this.activateSession(session, slot, true);
        break;
      }
    }
    this.emitQueuePositions();
  }

  private removeSession(sessionToken: string, notify: boolean): void {
    const session = this.sessions.get(sessionToken);
    if (!session) {
      return;
    }
    if (notify && session.connectedSocketId) {
      this.lifecycleEvents.push({
        type: 'kicked',
        sessionToken,
        reason: 'No controller activity for 60 seconds',
      });
    }
    if (session.state === 'active' && session.slot !== undefined) {
      const slot = session.slot;
      this.sessions.delete(sessionToken);
      this.releaseSlot(slot);
      this.promoteQueue(slot);
      return;
    }
    if (session.state === 'queued') {
      const index = this.queue.indexOf(sessionToken);
      if (index >= 0) {
        this.queue.splice(index, 1);
      }
      this.emitQueuePositions();
    }
    this.sessions.delete(sessionToken);
  }

  private evictExpiredSessions(): void {
    const now = this.now();
    for (const session of [...this.sessions.values()]) {
      if (
        (session.state === 'active' || session.state === 'queued') &&
        session.connectedSocketId === null &&
        session.disconnectedAt !== null &&
        now - session.disconnectedAt >= DISCONNECT_GRACE_MS
      ) {
        this.removeSession(session.sessionToken, false);
        continue;
      }
      if (
        (session.state === 'active' || session.state === 'queued') &&
        now - session.lastActivityAt >= IDLE_TIMEOUT_MS
      ) {
        this.removeSession(session.sessionToken, true);
        continue;
      }
      if (
        session.state === 'cooldown' &&
        session.cooldownEndsAt !== null &&
        now - session.cooldownEndsAt >= IDLE_TIMEOUT_MS
      ) {
        this.sessions.delete(session.sessionToken);
      }
    }
  }

  private emitQueuePositions(): void {
    this.queue.forEach((sessionToken, index) => {
      this.lifecycleEvents.push({
        type: 'queue:update',
        sessionToken,
        position: index + 1,
      });
    });
  }

  private sessionForSlot(slot: SlotId): ControllerSession | undefined {
    return [...this.sessions.values()].find(
      (session) => session.state === 'active' && session.slot === slot,
    );
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
      prizeName: null,
    };
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}
