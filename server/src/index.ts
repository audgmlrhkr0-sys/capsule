import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@capsule-claw/shared';
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { RoomManager } from './game/RoomManager.js';
import { startStateLoop } from './game/stateLoop.js';
import { registerHandlers } from './socket/registerHandlers.js';

const app = express();
app.use(cors({ origin: config.clientOrigin }));
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

const rooms = new RoomManager(config.publicUrl);
registerHandlers(io, rooms);
const stopStateLoop = startStateLoop(io, rooms);

httpServer.listen(config.port, () => {
  console.log(`Capsule Claw server listening on http://localhost:${config.port}`);
});

function shutdown(): void {
  stopStateLoop();
  io.close();
  httpServer.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
