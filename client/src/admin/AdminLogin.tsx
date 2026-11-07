import type { AdminAuthStatus } from '@capsule-claw/shared';
import { useState, type FormEvent } from 'react';
import { ADMIN_API } from './AdminPage';

export function AdminLogin({
  onAuthenticated,
}: {
  onAuthenticated: (auth: AdminAuthStatus) => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${ADMIN_API}/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const body = (await response.json()) as AdminAuthStatus | { error: string };
      setPassword('');
      if (!response.ok) {
        setError('error' in body ? body.error : '로그인에 실패했습니다.');
        return;
      }
      onAuthenticated(body as AdminAuthStatus);
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={submit}>
        <p>CAPSULE CLAW · ADMIN</p>
        <h1>전시 운영 콘솔</h1>
        <label htmlFor="admin-password">관리자 비밀번호</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <div className="admin-alert error">{error}</div>}
        <button type="submit" disabled={busy || !password}>
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
    </main>
  );
}
