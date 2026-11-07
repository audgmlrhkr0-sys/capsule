import type {
  AdminAuthStatus,
  AdminSnapshot,
} from '@capsule-claw/shared';
import { useCallback, useEffect, useState } from 'react';
import { ADMIN_API } from './AdminPage';

export function AdminDashboard({
  auth,
  onLoggedOut,
  onUnauthorized,
}: {
  auth: AdminAuthStatus;
  onLoggedOut: () => void;
  onUnauthorized: () => void;
}) {
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetStats, setResetStats] = useState(false);

  const request = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await fetch(`${ADMIN_API}${path}`, {
        credentials: 'include',
        ...init,
        headers: {
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init?.method && init.method !== 'GET'
            ? { 'X-CSRF-Token': auth.csrfToken }
            : {}),
          ...init?.headers,
        },
      });
      if (response.status === 401) {
        onUnauthorized();
        throw new Error('관리자 세션이 만료되었습니다.');
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? '요청을 처리하지 못했습니다.');
      }
      return response;
    },
    [auth.csrfToken, onUnauthorized],
  );

  const refresh = useCallback(async () => {
    try {
      const response = await request('/snapshot');
      setSnapshot((await response.json()) as AdminSnapshot);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [request]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const mutate = async (
    path: string,
    body: unknown,
    successMessage: string,
  ) => {
    setMessage(null);
    setError(null);
    try {
      const response = await request(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSnapshot((await response.json()) as AdminSnapshot);
      setMessage(successMessage);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const reset = () => {
    if (
      window.confirm(
        `모든 플레이어와 대기열, 캡슐, 상품 재고를 초기화합니다.${
          resetStats ? ' 플레이 통계도 초기화합니다.' : ''
        } 계속할까요?`,
      )
    ) {
      void mutate('/reset', { resetStats }, '게임을 초기화했습니다.');
    }
  };

  const refill = (roomCode: string) => {
    if (window.confirm(`${roomCode} 방의 캡슐을 채울까요?`)) {
      void mutate(`/rooms/${roomCode}/refill`, {}, `${roomCode} 방을 리필했습니다.`);
    }
  };

  const kick = (roomCode: string, playerId: string, nickname: string) => {
    const reason = window.prompt(
      `${nickname} 플레이어를 퇴장시킬 이유를 입력하세요.`,
      '관리자 요청으로 퇴장되었습니다.',
    );
    if (reason !== null && window.confirm(`${nickname} 플레이어를 퇴장시킬까요?`)) {
      void mutate(
        `/rooms/${roomCode}/players/${encodeURIComponent(playerId)}/kick`,
        { reason },
        `${nickname} 플레이어를 퇴장시켰습니다.`,
      );
    }
  };

  const downloadCsv = async () => {
    try {
      const response = await request('/wins.csv');
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'capsule-wins.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const logout = async () => {
    try {
      await request('/logout', { method: 'POST' });
    } finally {
      onLoggedOut();
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p>CAPSULE CLAW · OPERATIONS</p>
          <h1>전시 운영 콘솔</h1>
        </div>
        <div className="admin-header-actions">
          <button type="button" onClick={() => void refresh()}>새로고침</button>
          <button type="button" onClick={() => void downloadCsv()}>CSV 다운로드</button>
          <button type="button" onClick={() => void logout()}>로그아웃</button>
        </div>
      </header>

      {message && <div className="admin-alert success">{message}</div>}
      {error && <div className="admin-alert error">{error}</div>}

      {!snapshot ? (
        <div className="admin-loading">운영 현황 불러오는 중…</div>
      ) : (
        <>
          <section className="admin-metrics">
            {[
              ['연결 컨트롤러', snapshot.connectedControllerCount],
              ['연결 디스플레이', snapshot.displayCount],
              ['운영 중인 방', snapshot.roomCount],
              ['전체 대기자', snapshot.queueCount],
              ['완료 플레이', snapshot.totalCompletedPlays],
            ].map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>

          <section className="admin-section">
            <div className="admin-section-heading">
              <div><span>01</span><h2>방 운영</h2></div>
              <div className="reset-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={resetStats}
                    onChange={(event) => setResetStats(event.target.checked)}
                  />
                  통계 초기화
                </label>
                <button className="danger" type="button" onClick={reset}>전체 게임 초기화</button>
              </div>
            </div>
            <div className="admin-card-grid">
              {snapshot.rooms.map((room) => (
                <article className="admin-room-card" key={room.roomCode}>
                  <strong>ROOM {room.roomCode}</strong>
                  <p>디스플레이 {room.connectedDisplays} · 대기 {room.queueCount}</p>
                  <p>캡슐 {room.capsuleCount}개</p>
                  <button type="button" onClick={() => refill(room.roomCode)}>캡슐 리필</button>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-heading"><div><span>02</span><h2>플레이어</h2></div></div>
            <div className="admin-list">
              {snapshot.players.length ? snapshot.players.map((player) => (
                <article key={player.id}>
                  <div>
                    <strong>{player.nickname}</strong>
                    <small>
                      ROOM {player.roomCode} · {player.slot === null ? '대기' : `SLOT ${player.slot + 1}`}
                      {' · '}{player.state} · {player.connected ? '연결됨' : '연결 유예'}
                    </small>
                  </div>
                  <button
                    className="danger-outline"
                    type="button"
                    onClick={() => kick(player.roomCode, player.id, player.nickname)}
                  >
                    강제 퇴장
                  </button>
                </article>
              )) : <p className="admin-empty">현재 플레이어가 없습니다.</p>}
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-heading"><div><span>03</span><h2>상품 재고</h2></div></div>
            <div className="prize-stock-grid">
              {snapshot.prizes.map((prize) => (
                <article key={prize.id}>
                  <strong>{prize.name}</strong>
                  <span>{prize.remaining} / {prize.initial}</span>
                  <div><i style={{ width: `${prize.initial ? (prize.remaining / prize.initial) * 100 : 0}%` }} /></div>
                  <small>사용 {prize.used}개</small>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
