import { Router, type NextFunction, type Request, type Response } from 'express';
import type { RoomManager } from '../game/RoomManager.js';
import { escapeCsv, type WinLogStore } from '../logging/WinLogStore.js';
import { AdminService } from './AdminService.js';

export function createAdminRouter({
  rooms,
  winLog,
  password,
  clientOrigin,
  secureCookies,
}: {
  rooms: RoomManager;
  winLog: WinLogStore;
  password: string;
  clientOrigin: string;
  secureCookies: boolean;
}): Router {
  const router = Router();
  const auth = new AdminService(password, secureCookies);

  const requireOrigin = (request: Request, response: Response): boolean => {
    if (request.get('origin') !== clientOrigin) {
      response.status(403).json({ error: '허용되지 않은 요청 출처입니다.' });
      return false;
    }
    return true;
  };

  router.post('/login', (request, response) => {
    if (!requireOrigin(request, response)) return;
    const result = auth.login(request.body?.password, request.ip ?? 'unknown');
    if (!result.ok) {
      response.status(result.statusCode).json({ error: result.error });
      return;
    }
    response.setHeader('Set-Cookie', result.cookie);
    response.json(result.status);
  });

  router.use((request: Request, response: Response, next: NextFunction) => {
    const session = auth.authenticate(request.get('cookie'));
    if (!session) {
      response.status(401).json({ error: '관리자 로그인이 필요합니다.' });
      return;
    }
    response.locals.adminSession = session;
    next();
  });

  const requireMutation = (request: Request, response: Response): boolean => {
    if (!requireOrigin(request, response)) return false;
    const session = response.locals.adminSession;
    if (
      !session ||
      !auth.verifyCsrf(session, request.get('x-csrf-token'))
    ) {
      response.status(403).json({ error: 'CSRF 토큰이 올바르지 않습니다.' });
      return false;
    }
    return true;
  };

  router.get('/status', (_request, response) => {
    response.json(auth.status(response.locals.adminSession));
  });

  router.get('/snapshot', (_request, response) => {
    response.json(rooms.adminSnapshot());
  });

  router.post('/logout', (request, response) => {
    if (!requireMutation(request, response)) return;
    auth.logout(response.locals.adminSession);
    response.setHeader('Set-Cookie', auth.clearCookie());
    response.status(204).end();
  });

  router.post('/reset', (request, response) => {
    if (!requireMutation(request, response)) return;
    rooms.adminReset(request.body?.resetStats === true);
    response.json(rooms.adminSnapshot());
  });

  router.post('/rooms/:roomCode/refill', (request, response) => {
    if (!requireMutation(request, response)) return;
    const result = rooms.adminRefill(request.params.roomCode);
    if (result === null) {
      response.status(404).json({ error: '방을 찾을 수 없습니다.' });
    } else if (!result) {
      response.status(409).json({ error: '집게 동작 중에는 리필할 수 없습니다.' });
    } else {
      response.json(rooms.adminSnapshot());
    }
  });

  router.post('/rooms/:roomCode/players/:playerId/kick', (request, response) => {
    if (!requireMutation(request, response)) return;
    const reason =
      typeof request.body?.reason === 'string' && request.body.reason.trim()
        ? request.body.reason.trim().slice(0, 120)
        : '관리자가 플레이어를 퇴장시켰습니다.';
    if (!rooms.adminKick(request.params.roomCode, request.params.playerId, reason)) {
      response.status(404).json({ error: '플레이어를 찾을 수 없습니다.' });
      return;
    }
    response.json(rooms.adminSnapshot());
  });

  router.get('/wins.csv', (_request, response) => {
    const lines = winLog.records().map((win) =>
      [escapeCsv(win.wonAt), escapeCsv(win.nickname), escapeCsv(win.prizeName)].join(
        ',',
      ),
    );
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="capsule-wins.csv"',
    );
    response.send(`\uFEFFtime,nickname,prize\n${lines.join('\n')}${lines.length ? '\n' : ''}`);
  });

  return router;
}
