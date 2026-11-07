import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@capsule-claw/shared';
import type { Server } from 'socket.io';
import { FIXED_TIMESTEP_MS, SNAPSHOT_INTERVAL_MS } from './constants.js';
import type { RoomManager } from './RoomManager.js';

type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function startStateLoop(io: TypedServer, rooms: RoomManager): () => void {
  let tickCount = 0;
  const ticksPerSnapshot = Math.round(SNAPSHOT_INTERVAL_MS / FIXED_TIMESTEP_MS);
  const timer = setInterval(() => {
    for (const game of rooms.games()) {
      game.tick(FIXED_TIMESTEP_MS);
      for (const result of game.drainTurnResults()) {
        if (result.win) {
          io.to(`display:${game.roomCode}`).emit('prize:won', result.win);
        }
        io.to(`session:${result.sessionToken}`).emit('turn:result', {
          success: result.success,
          ...(result.prizeName ? { prizeName: result.prizeName } : {}),
        });
      }
      for (const event of game.drainLifecycleEvents()) {
        if (event.type === 'player:left') {
          io.to(`room:${game.roomCode}`).emit('player:left', { slot: event.slot });
        } else if (event.type === 'joined') {
          const target = io.to(`session:${event.sessionToken}`);
          target.emit('joined', {
            slot: event.slot,
            sessionToken: event.sessionToken,
          });
          target.emit('turn:start', event.turn);
          const player = game.getPlayer(event.slot);
          if (player) {
            io.to(`room:${game.roomCode}`).emit('player:joined', player);
          }
        } else if (event.type === 'queue:update') {
          io.to(`session:${event.sessionToken}`).emit('queue:update', {
            position: event.position,
          });
        } else if (event.type === 'cooldown') {
          io.to(`session:${event.sessionToken}`).emit('cooldown', {
            endsAt: event.endsAt,
          });
        } else {
          io.to(`session:${event.sessionToken}`).emit('kicked', {
            reason: event.reason,
          });
        }
      }
    }

    tickCount += 1;
    if (tickCount % ticksPerSnapshot === 0) {
      for (const game of rooms.games()) {
        io.to(`room:${game.roomCode}`).emit('state:update', game.serialize());
      }
    }
  }, FIXED_TIMESTEP_MS);

  return () => clearInterval(timer);
}
