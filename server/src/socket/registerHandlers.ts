import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@capsule-claw/shared';
import type { Server } from 'socket.io';
import type { RoomManager } from '../game/RoomManager.js';
import { normalizeNickname, normalizeRoomCode } from '../utils/validation.js';

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
        const game = rooms.getGame(display.roomCode);
        if (game) {
          socket.emit('state:update', game.serialize());
        }
      } catch {
        ack({ ok: false, error: 'Unable to create a display room' });
      }
    });

    socket.on('join', (payload, ack) => {
      const roomCode = normalizeRoomCode(payload.roomCode);
      const nickname = normalizeNickname(payload.nickname);
      const game = roomCode ? rooms.getGame(roomCode) : undefined;
      if (!roomCode || !game) {
        ack({ ok: false, error: 'Room not found' });
        return;
      }
      if (!nickname) {
        ack({ ok: false, error: 'Nickname must be 1–6 characters' });
        return;
      }

      const result = game.join(
        nickname,
        socket.data.sessionToken ?? payload.sessionToken,
      );
      socket.data.roomCode = roomCode;
      socket.data.sessionToken = result.sessionToken;
      socket.data.queued = result.status === 'queued';
      void socket.join(`room:${roomCode}`);
      ack({ ok: true, data: result });

      if (result.status === 'joined') {
        socket.data.playerSlot = result.slot;
        socket.emit('joined', {
          slot: result.slot,
          sessionToken: result.sessionToken,
        });
        const player = game.getPlayer(result.slot);
        if (player) {
          io.to(`room:${roomCode}`).emit('player:joined', player);
        }
      } else {
        socket.emit('queued', {
          position: result.position,
          sessionToken: result.sessionToken,
        });
      }
    });

    socket.on('admin:command', (_command, ack) => {
      ack({ ok: false, error: 'Administration is available in a later stage' });
    });

    socket.on('disconnect', () => {
      const { roomCode, sessionToken } = socket.data;
      if (!roomCode || !sessionToken) {
        return;
      }
      const slot = rooms.getGame(roomCode)?.leave(sessionToken);
      if (slot !== null && slot !== undefined) {
        io.to(`room:${roomCode}`).emit('player:left', { slot });
      }
    });
  });
}
