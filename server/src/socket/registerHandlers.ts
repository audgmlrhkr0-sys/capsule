import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@capsule-claw/shared';
import type { Server } from 'socket.io';
import type { RoomManager } from '../game/RoomManager.js';

type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function registerHandlers(io: TypedServer, rooms: RoomManager): void {
  io.on('connection', (socket) => {
    socket.on('display:create', (payload, ack) => {
      try {
        const display = rooms.createOrReconnect(payload.displayToken);
        socket.data.displayToken = display.displayToken;
        socket.data.roomCode = display.roomCode;
        void socket.join(`room:${display.roomCode}`);
        ack({ ok: true, data: display });
      } catch {
        ack({ ok: false, error: 'Unable to create a display room' });
      }
    });

    socket.on('join', (_payload, ack) => {
      ack({ ok: false, error: 'Player joining is available in a later stage' });
    });

    socket.on('admin:command', (_command, ack) => {
      ack({ ok: false, error: 'Administration is available in a later stage' });
    });
  });
}
