import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@capsule-claw/shared';
import { io, type Socket } from 'socket.io-client';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3000',
  { autoConnect: false },
);
