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
        io.to(`player:${game.roomCode}:${result.slot}`).emit('turn:result', {
          success: result.success,
          ...(result.prizeName ? { prizeName: result.prizeName } : {}),
        });
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
