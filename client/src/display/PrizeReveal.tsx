import type { WinRecord } from '@capsule-claw/shared';

export function PrizeReveal({ win }: { win: WinRecord }) {
  return (
    <div className="prize-reveal" role="status" aria-live="assertive">
      <div className="prize-card">
        <div className="opening-capsule" aria-hidden="true">
          <span className="capsule-half capsule-top" />
          <span className="prize-spark">✦</span>
          <span className="capsule-half capsule-bottom" />
        </div>
        <p>축하합니다!</p>
        <h2>{win.prizeName}</h2>
        <strong>{win.nickname}님 획득</strong>
      </div>
    </div>
  );
}
