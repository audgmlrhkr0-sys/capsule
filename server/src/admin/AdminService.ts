import type { AdminAuthStatus } from '@capsule-claw/shared';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const SESSION_TTL_MS = 15 * 60 * 1000;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 5;

interface AdminSession {
  token: string;
  csrfToken: string;
  expiresAt: number;
}

export class AdminService {
  private readonly sessions = new Map<string, AdminSession>();
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly password: string,
    private readonly secureCookies: boolean,
    private readonly now: () => number = Date.now,
    private readonly signingSecret = randomBytes(32),
  ) {}

  login(
    password: unknown,
    address: string,
  ):
    | { ok: true; status: AdminAuthStatus; cookie: string }
    | { ok: false; statusCode: 401 | 429; error: string } {
    this.prune();
    const failures = (this.failures.get(address) ?? []).filter(
      (time) => this.now() - time < RATE_WINDOW_MS,
    );
    if (failures.length >= MAX_FAILURES) {
      this.failures.set(address, failures);
      return {
        ok: false,
        statusCode: 429,
        error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.',
      };
    }
    if (typeof password !== 'string' || !safeEqual(password, this.password)) {
      failures.push(this.now());
      this.failures.set(address, failures);
      return { ok: false, statusCode: 401, error: '비밀번호가 올바르지 않습니다.' };
    }

    this.failures.delete(address);
    const session: AdminSession = {
      token: randomBytes(32).toString('base64url'),
      csrfToken: randomBytes(24).toString('base64url'),
      expiresAt: this.now() + SESSION_TTL_MS,
    };
    this.sessions.set(session.token, session);
    return {
      ok: true,
      status: this.toStatus(session),
      cookie: this.cookieFor(session),
    };
  }

  authenticate(cookieHeader: string | undefined): AdminSession | null {
    this.prune();
    const signed = parseCookies(cookieHeader).capsule_admin;
    if (!signed) return null;
    const separator = signed.lastIndexOf('.');
    if (separator < 1) return null;
    const token = signed.slice(0, separator);
    const signature = signed.slice(separator + 1);
    const expected = this.sign(token);
    if (!safeEqual(signature, expected)) return null;
    return this.sessions.get(token) ?? null;
  }

  status(session: AdminSession): AdminAuthStatus {
    return this.toStatus(session);
  }

  verifyCsrf(session: AdminSession, token: string | undefined): boolean {
    return typeof token === 'string' && safeEqual(token, session.csrfToken);
  }

  logout(session: AdminSession): void {
    this.sessions.delete(session.token);
  }

  clearCookie(): string {
    return [
      'capsule_admin=',
      'Path=/api/admin',
      'HttpOnly',
      'SameSite=Strict',
      'Max-Age=0',
      ...(this.secureCookies ? ['Secure'] : []),
    ].join('; ');
  }

  private cookieFor(session: AdminSession): string {
    return [
      `capsule_admin=${session.token}.${this.sign(session.token)}`,
      'Path=/api/admin',
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
      ...(this.secureCookies ? ['Secure'] : []),
    ].join('; ');
  }

  private sign(token: string): string {
    return createHmac('sha256', this.signingSecret)
      .update(token)
      .digest('base64url');
  }

  private prune(): void {
    const now = this.now();
    for (const [token, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(token);
    }
    for (const [address, attempts] of this.failures) {
      const current = attempts.filter((time) => now - time < RATE_WINDOW_MS);
      if (current.length) this.failures.set(address, current);
      else this.failures.delete(address);
    }
  }

  private toStatus(session: AdminSession): AdminAuthStatus {
    return {
      authenticated: true,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    };
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (separator > 0) {
      cookies[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
    }
  }
  return cookies;
}
