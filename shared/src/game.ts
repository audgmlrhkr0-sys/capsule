export type SlotId = 0 | 1 | 2;
export type Direction = 'left' | 'right' | 'up' | 'down';
export type PlayerColor = 'red' | 'blue' | 'yellow';
export type CapsuleColor =
  | 'coral'
  | 'gold'
  | 'mint'
  | 'sky'
  | 'violet'
  | 'pink';
export type TurnPhase =
  | 'waiting'
  | 'aiming'
  | 'dropping'
  | 'lifting'
  | 'dispensing'
  | 'result'
  | 'cooldown';

export interface CapsuleState {
  id: string;
  x: number;
  y: number;
  angle: number;
  z: number;
  radius: number;
  color: CapsuleColor;
}

export interface ClawState {
  slot: SlotId;
  x: number;
  z: number;
  height: number;
  phase: TurnPhase;
  heldCapsuleId: string | null;
}

export interface PlayerState {
  slot: SlotId;
  nickname: string;
  color: PlayerColor;
  turnEndsAt: number | null;
}

export interface WinRecord {
  wonAt: string;
  slot: SlotId;
  nickname: string;
  prizeName: string;
}

export interface PublicGameState {
  roomCode: string;
  serverTime: number;
  capsules: CapsuleState[];
  claws: ClawState[];
  players: Array<PlayerState | null>;
  recentWins: WinRecord[];
}
