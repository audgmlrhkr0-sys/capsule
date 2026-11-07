import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@capsule-claw/shared';
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { config } from './config.js';
import { createAdminRouter } from './admin/adminRoutes.js';
import { RoomManager } from './game/RoomManager.js';
import { startStateLoop } from './game/stateLoop.js';
import { WinLogStore } from './logging/WinLogStore.js';
import { PrizeService } from './prizes/PrizeService.js';
import { registerHandlers } from './socket/registerHandlers.js';

const app = express();
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());
app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: { origin: config.clientOrigin },
});

const prizes = await PrizeService.fromFile(
  new URL('../config/prizes.json', import.meta.url),
);
const winLog = new WinLogStore(
  fileURLToPath(new URL('../data/wins.csv', import.meta.url)),
);
const rooms = new RoomManager(
  config.publicUrl,
  undefined,
  undefined,
  prizes,
  winLog,
);
app.use(
  '/api/admin',
  createAdminRouter({
    rooms,
    winLog,
    password: config.adminPassword,
    clientOrigin: config.clientOrigin,
    secureCookies: config.production,
  }),
);
registerHandlers(io, rooms);
const stopStateLoop = startStateLoop(io, rooms);

httpServer.listen(config.port, () => {
  console.log(`Capsule Claw server listening on http://localhost:${config.port}`);
});

async function shutdown(): Promise<void> {
  stopStateLoop();
  await winLog.flush();
  io.close(() => process.exit(0));
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
