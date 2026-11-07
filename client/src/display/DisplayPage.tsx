import type { DisplayJoined } from '@capsule-claw/shared';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { socket } from '../socket/client';

const DISPLAY_TOKEN_KEY = 'capsule-claw:display-token';

export function DisplayPage() {
  const [display, setDisplay] = useState<DisplayJoined | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createOrReconnect = () => {
      const displayToken = sessionStorage.getItem(DISPLAY_TOKEN_KEY) ?? undefined;
      socket.emit('display:create', { displayToken }, (result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        sessionStorage.setItem(DISPLAY_TOKEN_KEY, result.data.displayToken);
        setDisplay(result.data);
        setError(null);
      });
    };

    socket.on('connect', createOrReconnect);
    socket.connect();

    return () => {
      socket.off('connect', createOrReconnect);
      socket.disconnect();
    };
  }, []);

  if (error) {
    return <main className="center-panel error-panel">{error}</main>;
  }

  if (!display) {
    return <main className="center-panel">방을 준비하고 있습니다…</main>;
  }

  return (
    <main className="display-page">
      <section className="stage-placeholder" aria-label="Game stage placeholder">
        <span>CAPSULE CLAW</span>
        <h1>게임 화면 준비 중</h1>
        <p>캡슐 물리와 플레이 화면은 다음 단계에서 추가됩니다.</p>
      </section>
      <aside className="room-panel">
        <p className="eyebrow">휴대폰으로 참여하세요</p>
        <div className="qr-frame">
          <QRCodeSVG value={display.playUrl} size={220} level="M" />
        </div>
        <p className="room-label">ROOM</p>
        <strong className="room-code">{display.roomCode}</strong>
        <p className="play-url">{display.playUrl}</p>
      </aside>
    </main>
  );
}
