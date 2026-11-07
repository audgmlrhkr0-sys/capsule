import type { SlotId, TurnPhase } from '@capsule-claw/shared';
import { useEffect, useState } from 'react';
import { usePortrait } from '../hooks/useOrientation';
import { DPad } from './DPad';
import { DropButton } from './DropButton';
import { OrientationOverlay } from './OrientationOverlay';
import { ResultView } from './ResultView';

const SLOT_NAMES = ['1P 빨강', '2P 파랑', '3P 노랑'] as const;
const PHASE_NOTES: Partial<Record<TurnPhase, string>> = {
  aiming: '방향을 정한 뒤 내리기를 누르세요.',
  dropping: '집게가 내려가는 중…',
  lifting: '집게가 올라오는 중…',
  dispensing: '배출구로 옮기는 중…',
};

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
  result: { success: boolean; prizeName?: string } | null;
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

  if (result) {
    return <ResultView success={result.success} prizeName={result.prizeName} />;
  }

  return (
    <main className={`controller-page controller-slot-${slot + 1}`}>
      <header className="controller-header">
        <span>ROOM {roomCode}</span>
        <strong>경북대미술관 소장품 캡슐 뽑기</strong>
        <span>{nickname}</span>
      </header>
      <section className="control-layout">
        <div className="control-left">
          <DPad disabled={disabled} />
        </div>
        <div className="control-center">
          <p>내 집게</p>
          <span className="claw-color-dot" />
          <strong>{SLOT_NAMES[slot]}</strong>
          <div className="turn-timer">
            <small>남은 시간</small>
            <b>0:{remaining.toString().padStart(2, '0')}</b>
          </div>
          <p className="stage-note">{PHASE_NOTES[phase] ?? ''}</p>
        </div>
        <div className="control-right">
          <DropButton disabled={disabled} />
        </div>
      </section>
      {portrait && <OrientationOverlay />}
    </main>
  );
}
