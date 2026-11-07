import type { SlotId, TurnPhase } from '@capsule-claw/shared';
import { useEffect, useState } from 'react';
import { usePortrait } from '../hooks/useOrientation';
import { DPad } from './DPad';
import { DropButton } from './DropButton';
import { OrientationOverlay } from './OrientationOverlay';

const SLOT_NAMES = ['CRIMSON', 'AZURE', 'MARIGOLD'] as const;

export function LandscapeControls({
  roomCode,
  nickname,
  slot,
  endsAt,
  serverTimeOffset,
  phase,
  result,
}: {
  roomCode: string;
  nickname: string;
  slot: SlotId;
  endsAt: number | null;
  serverTimeOffset: number;
  phase: TurnPhase;
  result: boolean | null;
}) {
  const portrait = usePortrait();
  const [remaining, setRemaining] = useState(0);
  const disabled = portrait || phase !== 'aiming';

  useEffect(() => {
    const update = () => {
      setRemaining(
        endsAt
          ? Math.max(0, Math.ceil((endsAt - (Date.now() + serverTimeOffset)) / 1000))
          : 0,
      );
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [endsAt, serverTimeOffset]);

  return (
    <main className={`controller-page controller-slot-${slot + 1}`}>
      <header className="controller-header">
        <span>ROOM {roomCode}</span>
        <strong>CAPSULE CLAW</strong>
        <span>{nickname}</span>
      </header>
      <section className="control-layout">
        <div className="control-left">
          <DPad disabled={disabled} />
        </div>
        <div className="control-center">
          <p>YOUR CLAW</p>
          <span className="claw-color-dot" />
          <strong>{SLOT_NAMES[slot]}</strong>
          <div className="turn-timer">
            <small>TURN TIME</small>
            <b>0:{remaining.toString().padStart(2, '0')}</b>
          </div>
          <p className="stage-note">
            {result !== null
              ? result ? '캡슐을 획득했습니다!' : '아쉽지만 빈 집게예요.'
              : phase === 'aiming' ? '방향을 정한 뒤 DROP을 누르세요.' : phase.toUpperCase()}
          </p>
        </div>
        <div className="control-right">
          <DropButton disabled={disabled} />
        </div>
      </section>
      {portrait && <OrientationOverlay />}
    </main>
  );
}
