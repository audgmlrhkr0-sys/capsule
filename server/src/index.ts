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

registerHandlers(io, new RoomManager(config.publicUrl));

httpServer.listen(config.port, () => {
  console.log(`Capsule Claw server listening on http://localhost:${config.port}`);
});
