import type { WinRecord } from '@capsule-claw/shared';

export function PrizeReveal({ win }: { win: WinRecord }) {
  return (
    <div className="prize-reveal" role="status" aria-live="assertive">
      <div className="opening-capsule" aria-hidden="true">
        <span className="capsule-half capsule-top" />
        <span className="prize-spark">✦</span>
        <span className="capsule-half capsule-bottom" />
      </div>
      <p>CONGRATULATIONS</p>
      <h2>{win.prizeName}</h2>
      <strong>{win.nickname}님의 새로운 소장품</strong>
    </div>
  );
}
