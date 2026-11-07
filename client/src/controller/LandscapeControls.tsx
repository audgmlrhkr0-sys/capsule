import type { SlotId } from '@capsule-claw/shared';
import { usePortrait } from '../hooks/useOrientation';
import { DPad } from './DPad';
import { DropButton } from './DropButton';
import { OrientationOverlay } from './OrientationOverlay';

const SLOT_NAMES = ['CRIMSON', 'AZURE', 'MARIGOLD'] as const;

export function LandscapeControls({
  roomCode,
  nickname,
  slot,
}: {
  roomCode: string;
  nickname: string;
  slot: SlotId;
}) {
  const portrait = usePortrait();

  return (
    <main className={`controller-page controller-slot-${slot + 1}`}>
      <header className="controller-header">
        <span>ROOM {roomCode}</span>
        <strong>CAPSULE CLAW</strong>
        <span>{nickname}</span>
      </header>
      <section className="control-layout">
        <div className="control-left">
          <DPad />
        </div>
        <div className="control-center">
          <p>YOUR CLAW</p>
          <span className="claw-color-dot" />
          <strong>{SLOT_NAMES[slot]}</strong>
          <div className="turn-timer">
            <small>TURN TIME</small>
            <b>--:--</b>
          </div>
          <p className="stage-note">이동과 드롭 동작은 다음 단계에서 활성화됩니다.</p>
        </div>
        <div className="control-right">
          <DropButton />
        </div>
      </section>
      {portrait && <OrientationOverlay />}
    </main>
  );
}
