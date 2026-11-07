import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@capsule-claw/shared';
import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from './serverUrl';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  SERVER_URL,
  { autoConnect: false },
);
