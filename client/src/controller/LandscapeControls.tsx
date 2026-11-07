import type { SlotId, TurnPhase } from '@capsule-claw/shared';
import { useEffect, useState, type CSSProperties } from 'react';
import { usePortrait } from '../hooks/useOrientation';
import { DPad } from './DPad';
import { DropButton } from './DropButton';
import { OrientationOverlay } from './OrientationOverlay';
import { ResultView } from './ResultView';

export function LandscapeControls({
  slot,
  endsAt,
  turnDuration,
  serverTimeOffset,
  phase,
  result,
}: {
  slot: SlotId;
  endsAt: number | null;
  turnDuration: number;
  serverTimeOffset: number;
  phase: TurnPhase;
  result: { success: boolean; prizeName?: string } | null;
}) {
  const portrait = usePortrait();
  const [remainingMs, setRemainingMs] = useState(0);
  const disabled = portrait || phase !== 'aiming';

  useEffect(() => {
    const update = () => {
      setRemainingMs(endsAt ? Math.max(0, endsAt - (Date.now() + serverTimeOffset)) : 0);
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [endsAt, serverTimeOffset]);

  if (result) {
    return <ResultView success={result.success} prizeName={result.prizeName} />;
  }

  const seconds = Math.ceil(remainingMs / 1000);
  const progress = turnDuration > 0 ? Math.min(1, remainingMs / turnDuration) : 0;

  return (
    <main className={`controller-page controller-slot-${slot + 1}`}>
      <div className="control-left">
        <DPad disabled={disabled} />
      </div>
      <div className="control-center">
        <div
          className="turn-timer"
          style={{ '--progress': `${progress * 360}deg` } as CSSProperties}
          role="timer"
          aria-label={`남은 시간 ${seconds}초`}
        >
          <b>{endsAt ? seconds : ''}</b>
        </div>
      </div>
      <div className="control-right">
        <DropButton disabled={disabled} />
      </div>
      {portrait && <OrientationOverlay />}
    </main>
  );
}
