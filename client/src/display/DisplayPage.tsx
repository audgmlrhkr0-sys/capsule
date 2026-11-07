import type {
  DisplayJoined,
  PlayerState,
  PublicGameState,
  SlotId,
  WinRecord,
} from '@capsule-claw/shared';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { socket } from '../socket/client';
import { GameCanvas } from './GameCanvas';
import { PrizeReveal } from './PrizeReveal';

const DISPLAY_TOKEN_KEY = 'capsule-claw:display-token';

export function DisplayPage() {
  const [display, setDisplay] = useState<DisplayJoined | null>(null);
  const [snapshot, setSnapshot] = useState<PublicGameState | null>(null);
  const [reveal, setReveal] = useState<WinRecord | null>(null);
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

    const receiveSnapshot = (state: PublicGameState) => setSnapshot(state);
    const playerJoined = (player: PlayerState) => {
      setSnapshot((current) => {
        if (!current) return current;
        const players = [...current.players];
        players[player.slot] = player;
        return { ...current, players };
      });
    };
    const playerLeft = ({ slot }: { slot: SlotId }) => {
      setSnapshot((current) => {
        if (!current) return current;
        const players = [...current.players];
        players[slot] = null;
        return { ...current, players };
      });
    };
    const prizeWon = (win: WinRecord) => {
      setReveal(win);
      setSnapshot((current) =>
        current
          ? { ...current, recentWins: [win, ...current.recentWins].slice(0, 5) }
          : current,
      );
    };
    socket.on('connect', createOrReconnect);
    socket.on('state:update', receiveSnapshot);
    socket.on('player:joined', playerJoined);
    socket.on('player:left', playerLeft);
    socket.on('prize:won', prizeWon);
    socket.connect();

    return () => {
      socket.off('connect', createOrReconnect);
      socket.off('state:update', receiveSnapshot);
      socket.off('player:joined', playerJoined);
      socket.off('player:left', playerLeft);
      socket.off('prize:won', prizeWon);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!reveal) return;
    const timer = window.setTimeout(() => setReveal(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [reveal]);

  if (error) {
    return <main className="center-panel error-panel">{error}</main>;
  }

  if (!display) {
    return <main className="center-panel">방을 준비하고 있습니다…</main>;
  }

  return (
    <main className="display-page">
      <div className="display-shell">
        <header className="museum-header">
          <div>
            <p className="museum-kicker">THE PLAYFUL OBJECTS COLLECTION</p>
            <h1>CAPSULE <i>CLAW</i></h1>
            <p className="museum-subtitle">Interactive capsule study · No. 036</p>
          </div>
          <div className="connection-status">
            <span className={snapshot ? 'status-dot online' : 'status-dot'} />
            {snapshot ? 'LIVE SIMULATION' : 'CONNECTING'}
          </div>
        </header>

        <section className="exhibit-grid">
          <div className="machine-column">
            <div className="machine-frame">
              <GameCanvas snapshot={snapshot} />
              {reveal && <PrizeReveal win={reveal} />}
              <span className="machine-caption">SERVER-AUTHORITATIVE PHYSICS / 20 FPS DATA</span>
            </div>
            <div className="player-slots" aria-label="Player slots">
              {['CRIMSON', 'AZURE', 'MARIGOLD'].map((color, index) => {
                const player = snapshot?.players[index] ?? null;
                return (
                <article
                  className={`player-slot slot-${index + 1}${player ? ' occupied' : ''}`}
                  key={color}
                >
                  <span className="slot-number">0{index + 1}</span>
                  <div>
                    <strong>{player?.nickname ?? 'WAITING FOR PLAYER'}</strong>
                    <small>{player ? 'PLAYER CONNECTED' : `${color} CLAW`}</small>
                  </div>
                  <span className="waiting-pulse" />
                </article>
                );
              })}
            </div>
          </div>

          <aside className="display-sidebar">
            <section className="room-panel">
              <p className="eyebrow">SCAN TO PLAY</p>
              <div className="qr-frame">
                <QRCodeSVG value={display.playUrl} size={174} level="M" />
              </div>
              <p className="room-label">ROOM CODE</p>
              <strong className="room-code">{display.roomCode}</strong>
              <p className="play-url">{display.playUrl}</p>
            </section>
            <section className="recent-panel">
              <div className="panel-heading">
                <span>RECENT ACQUISITIONS</span>
                <small>LIVE</small>
              </div>
              {snapshot?.recentWins.length ? (
                <ol className="recent-wins-list">
                  {snapshot.recentWins.slice(0, 5).map((win) => (
                    <li key={`${win.wonAt}-${win.slot}`}>
                      <span>0{win.slot + 1}</span>
                      <div>
                        <strong>{win.prizeName}</strong>
                        <small>{win.nickname}</small>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="empty-wins">
                  <span>◇</span>
                  <p>The collection awaits<br />its first winner.</p>
                </div>
              )}
            </section>
            <footer className="museum-note">
              <span>CC–2026</span>
              <p>THREE CLAWS · SIX COLORS<br />THIRTY-SIX CAPSULES</p>
            </footer>
          </aside>
        </section>
      </div>
    </main>
  );
}
