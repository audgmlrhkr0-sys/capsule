import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { INITIAL_CAPSULE_COUNT } from '../game/constants.js';
import { RoomManager } from '../game/RoomManager.js';
import { WinLogStore } from '../logging/WinLogStore.js';
import { PrizeService } from '../prizes/PrizeService.js';
import { createAdminRouter } from './adminRoutes.js';

const ORIGIN = 'http://localhost:5173';
const PASSWORD = 'museum-secret';
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function setup(secureCookies = false) {
  const directory = await mkdtemp(join(tmpdir(), 'capsule-admin-'));
  temporaryDirectories.push(directory);
  const prizes = new PrizeService([
    { id: 'poster', name: '전시 포스터', weight: 1, stock: 2 },
  ]);
  const winLog = new WinLogStore(join(directory, 'wins.csv'));
  let displayToken = 0;
  const rooms = new RoomManager(
    'http://localhost:5173',
    () => 1234,
    () => `display-${++displayToken}`,
    prizes,
    winLog,
  );
  const app = express();
  app.use(express.json());
  app.use(
    '/api/admin',
    createAdminRouter({
      rooms,
      winLog,
      password: PASSWORD,
      clientOrigin: ORIGIN,
      secureCookies,
    }),
  );
  return { app, rooms, prizes, winLog };
}

async function login(app: express.Express) {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/admin/login')
    .set('Origin', ORIGIN)
    .send({ password: PASSWORD })
    .expect(200);
  return {
    agent,
    csrf: response.body.csrfToken as string,
    cookie: response.headers['set-cookie'] as unknown as string[],
  };
}

describe('admin authentication', () => {
  it('denies anonymous access and issues a signed hardened cookie on login', async () => {
    const { app } = await setup();
    await request(app).get('/api/admin/snapshot').expect(401);
    await request(app)
      .post('/api/admin/login')
      .set('Origin', ORIGIN)
      .send({ password: 'wrong-password' })
      .expect(401);

    const { agent, csrf, cookie } = await login(app);
    expect(csrf).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cookie[0]).toContain('capsule_admin=');
    expect(cookie[0]).toContain('HttpOnly');
    expect(cookie[0]).toContain('SameSite=Strict');
    expect(cookie[0]).not.toContain('museum-secret');
    await agent.get('/api/admin/status').expect(200);
  });

  it('uses Secure cookies in production mode and rate-limits failures', async () => {
    const { app } = await setup(true);
    const loginResponse = await request(app)
      .post('/api/admin/login')
      .set('Origin', ORIGIN)
      .send({ password: PASSWORD })
      .expect(200);
    expect(loginResponse.headers['set-cookie'][0]).toContain('Secure');

    const limited = await setup();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(limited.app)
        .post('/api/admin/login')
        .set('Origin', ORIGIN)
        .send({ password: 'incorrect' })
        .expect(401);
    }
    await request(limited.app)
      .post('/api/admin/login')
      .set('Origin', ORIGIN)
      .send({ password: 'incorrect' })
      .expect(429);
  });

  it('requires same-origin CSRF protection for mutations and supports logout', async () => {
    const { app } = await setup();
    const { agent, csrf } = await login(app);
    await agent.post('/api/admin/reset').set('Origin', ORIGIN).send({}).expect(403);
    await agent
      .post('/api/admin/reset')
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', csrf)
      .send({})
      .expect(403);
    await agent
      .post('/api/admin/logout')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrf)
      .expect(204);
    await agent.get('/api/admin/status').expect(401);
  });
});

describe('admin operations', () => {
  it('reports stats and handles kick, refill, and reset', async () => {
    const { app, rooms, prizes } = await setup();
    const display = rooms.createOrReconnect();
    rooms.connectDisplay(display.roomCode, 'display-socket');
    const game = rooms.getGame(display.roomCode)!;
    game.connect('하나', undefined, 'socket-1');
    game.connect('둘', undefined, 'socket-2');
    game.connect('셋', undefined, 'socket-3');
    game.connect('넷', undefined, 'socket-4');
    prizes.draw();
    const { agent, csrf } = await login(app);

    const snapshot = await agent.get('/api/admin/snapshot').expect(200);
    expect(snapshot.body).toMatchObject({
      connectedControllerCount: 4,
      displayCount: 1,
      roomCount: 1,
      queueCount: 1,
      totalCompletedPlays: 0,
    });
    expect(snapshot.body.prizes[0]).toEqual({
      id: 'poster',
      name: '전시 포스터',
      initial: 2,
      remaining: 1,
      used: 1,
    });

    const active = snapshot.body.players.find(
      (player: { slot: number | null }) => player.slot === 0,
    );
    const kicked = await agent
      .post(
        `/api/admin/rooms/${display.roomCode}/players/${active.id}/kick`,
      )
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrf)
      .send({ reason: '운영 테스트' })
      .expect(200);
    expect(kicked.body.queueCount).toBe(0);
    expect(
      kicked.body.players.find(
        (player: { nickname: string }) => player.nickname === '넷',
      ).slot,
    ).toBe(0);
    expect(game.drainLifecycleEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'kicked',
          sessionToken: active.id,
          reason: '운영 테스트',
        }),
        expect.objectContaining({ type: 'joined', slot: 0 }),
      ]),
    );

    for (const capsule of game.physics.serialize().slice(0, 31)) {
      game.physics.removeCapsule(capsule.id);
    }
    const refilled = await agent
      .post(`/api/admin/rooms/${display.roomCode}/refill`)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrf)
      .send({})
      .expect(200);
    expect(refilled.body.rooms[0].capsuleCount).toBe(INITIAL_CAPSULE_COUNT);

    const reset = await agent
      .post('/api/admin/reset')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrf)
      .send({ resetStats: true })
      .expect(200);
    expect(reset.body.players).toEqual([]);
    expect(reset.body.prizes[0].remaining).toBe(2);
  });

  it('downloads escaped UTF-8 CSV records with BOM and disposition', async () => {
    const { app, winLog } = await setup();
    winLog.record({
      wonAt: '2026-11-07T00:00:00.000Z',
      slot: 0,
      nickname: '관람객, "하나"',
      prizeName: '전시 도록',
    });
    await winLog.flush();
    const { agent } = await login(app);

    const response = await agent.get('/api/admin/wins.csv').expect(200);
    expect(response.headers['content-disposition']).toContain('capsule-wins.csv');
    expect(response.text.charCodeAt(0)).toBe(0xfeff);
    expect(response.text).toContain('time,nickname,prize');
    expect(response.text).toContain('"관람객, ""하나"""');
  });
});
