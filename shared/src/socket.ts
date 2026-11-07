import type {
  Direction,
  PlayerState,
  PublicGameState,
  SlotId,
  WinRecord,
} from './game.js';

export type Ack<T> = (result: { ok: true; data: T } | { ok: false; error: string }) => void;

export interface DisplayJoined {
  roomCode: string;
  displayToken: string;
  playUrl: string;
  reconnected: boolean;
}

export type JoinResult =
  | { status: 'joined'; slot: SlotId; sessionToken: string }
  | { status: 'queued'; position: number; sessionToken: string };

export type AdminCommand = { type: 'stage-placeholder' };

export interface ClientToServerEvents {
  'display:create': (
    payload: { displayToken?: string },
    ack: Ack<DisplayJoined>,
  ) => void;
  join: (
    payload: { roomCode: string; nickname: string; sessionToken?: string },
    ack: Ack<JoinResult>,
  ) => void;
  move: (payload: { direction: Direction; pressed: boolean }) => void;
  drop: () => void;
  'admin:command': (command: AdminCommand, ack: Ack<void>) => void;
}

export interface ServerToClientEvents {
  'state:update': (state: PublicGameState) => void;
  'player:joined': (player: PlayerState) => void;
  'player:left': (payload: { slot: SlotId }) => void;
  'prize:won': (win: WinRecord) => void;
  joined: (payload: { slot: SlotId; sessionToken: string }) => void;
  queued: (payload: { position: number; sessionToken: string }) => void;
  'queue:update': (payload: { position: number }) => void;
  'turn:start': (payload: { timeLimit: number; endsAt: number }) => void;
  'turn:result': (payload: { success: boolean; prizeName?: string }) => void;
  kicked: (payload: { reason: string }) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  displayToken?: string;
  roomCode?: string;
  sessionToken?: string;
  playerSlot?: SlotId;
  queued?: boolean;
}
