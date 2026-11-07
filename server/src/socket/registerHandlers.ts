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
        rooms.connectDisplay(display.roomCode, socket.id);
        void socket.join(`room:${display.roomCode}`);
        void socket.join(`display:${display.roomCode}`);
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

      const result = game.connect(
        nickname,
        socket.data.sessionToken ?? payload.sessionToken,
        socket.id,
      );
      if (result.status === 'rejected') {
        ack({ ok: false, error: result.error });
        return;
      }
      socket.data.roomCode = roomCode;
      socket.data.sessionToken = result.sessionToken;
      socket.data.queued = result.status === 'queued';
      void socket.join(`room:${roomCode}`);
      void socket.join(`session:${result.sessionToken}`);
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
        const turn = game.getTurnStart(result.slot);
        if (turn) {
          socket.emit('turn:start', turn);
        }
        const restore = game.getSessionRestore(result.sessionToken);
        if (restore?.result) {
          socket.emit('turn:result', restore.result);
        }
      } else if (result.status === 'queued') {
        socket.emit('queued', {
          position: result.position,
          sessionToken: result.sessionToken,
        });
      } else {
        socket.emit('cooldown', { endsAt: result.endsAt });
      }
    });

    socket.on('move', ({ direction, pressed }) => {
      const { roomCode, sessionToken } = socket.data;
      if (roomCode && sessionToken) {
        rooms
          .getGame(roomCode)
          ?.setSessionDirection(sessionToken, direction, pressed);
      }
    });

    socket.on('drop', () => {
      const { roomCode, sessionToken } = socket.data;
      if (roomCode && sessionToken) {
        rooms.getGame(roomCode)?.requestSessionDrop(sessionToken);
      }
    });

    socket.on('activity', () => {
      const { roomCode, sessionToken } = socket.data;
      if (roomCode && sessionToken) {
        rooms.getGame(roomCode)?.touchSession(sessionToken);
      }
    });

    socket.on('admin:command', (_command, ack) => {
      ack({ ok: false, error: 'Administration is available in a later stage' });
    });

    socket.on('disconnect', () => {
      const { roomCode, sessionToken, displayToken } = socket.data;
      if (roomCode && displayToken) {
        rooms.disconnectDisplay(roomCode, socket.id);
      }
      if (!roomCode || !sessionToken) {
        return;
      }
      rooms.getGame(roomCode)?.disconnect(sessionToken, socket.id);
    });
  });
}
