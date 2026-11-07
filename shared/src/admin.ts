import type { SlotId } from './game.js';

export interface AdminPrizeStock {
  id: string;
  name: string;
  initial: number;
  remaining: number;
  used: number;
}

export interface AdminPlayer {
  id: string;
  roomCode: string;
  slot: SlotId | null;
  nickname: string;
  state: 'active' | 'queued' | 'cooldown';
  connected: boolean;
}

export interface AdminRoom {
  roomCode: string;
  connectedDisplays: number;
  queueCount: number;
  capsuleCount: number;
}

export interface AdminSnapshot {
  connectedControllerCount: number;
  displayCount: number;
  roomCount: number;
  queueCount: number;
  totalCompletedPlays: number;
  prizes: AdminPrizeStock[];
  players: AdminPlayer[];
  rooms: AdminRoom[];
}

export interface AdminAuthStatus {
  authenticated: true;
  csrfToken: string;
  expiresAt: number;
}
