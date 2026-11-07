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
const TITLE = '경북대미술관 소장품 캡슐 뽑기';

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
    const prizeWon = (win: WinRecord) => setReveal(win);
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
    return <main className="center-panel">{TITLE}</main>;
  }

  return (
    <main className="display-page">
      <header className="machine-marquee">
        <h1>{TITLE}</h1>
      </header>

      <section className="machine-body">
        <div className="machine-window">
          <GameCanvas snapshot={snapshot} />
          {reveal && <PrizeReveal win={reveal} />}
        </div>

        <aside className="machine-side">
          <p className="qr-title">조작하기</p>
          <div className="qr-frame">
            <QRCodeSVG value={display.playUrl} size={256} level="M" fgColor="#2c4c17" />
          </div>
          <p className="room-code">ROOM {display.roomCode}</p>
        </aside>
      </section>

      <footer className="machine-base" aria-label="참여 중인 플레이어">
        {[0, 1, 2].map((slot) => {
          const player = snapshot?.players[slot] ?? null;
          return (
            <div
              className={`player-slot slot-${slot + 1}${player ? ' occupied' : ''}`}
              key={slot}
            >
              <span className="slot-badge">{slot + 1}P</span>
              <strong>{player?.nickname ?? '대기 중'}</strong>
            </div>
          );
        })}
      </footer>
    </main>
  );
}
