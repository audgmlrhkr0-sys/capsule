import type { AdminAuthStatus } from '@capsule-claw/shared';
import { useEffect, useState } from 'react';
import { AdminDashboard } from './AdminDashboard';
import { SERVER_URL } from '../socket/serverUrl';
import { AdminLogin } from './AdminLogin';

export const ADMIN_API = `${SERVER_URL}/api/admin`;

export function AdminPage() {
  const [auth, setAuth] = useState<AdminAuthStatus | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${ADMIN_API}/status`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) setAuth((await response.json()) as AdminAuthStatus);
      })
      .catch(() => undefined)
      .finally(() => setChecking(false));
    return () => controller.abort();
  }, []);

  if (checking) {
    return <main className="admin-loading">관리자 세션 확인 중…</main>;
  }
  if (!auth) {
    return <AdminLogin onAuthenticated={setAuth} />;
  }
  return (
    <AdminDashboard
      auth={auth}
      onLoggedOut={() => setAuth(null)}
      onUnauthorized={() => setAuth(null)}
    />
  );
}
