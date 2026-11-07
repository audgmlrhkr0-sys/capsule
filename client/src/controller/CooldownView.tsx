import { useEffect, useState } from 'react';

export function CooldownView({
  endsAt,
  serverTimeOffset,
  onRejoin,
}: {
  endsAt: number;
  serverTimeOffset: number;
  onRejoin: () => void;
}) {
  const [remaining, setRemaining] = useState(10);

  useEffect(() => {
    const update = () =>
      setRemaining(
        Math.max(0, Math.ceil((endsAt - (Date.now() + serverTimeOffset)) / 1000)),
      );
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [endsAt, serverTimeOffset]);

  return (
    <main className="cooldown-page">
      <section className="cooldown-card">
        <p className="controller-kicker">NEXT TURN</p>
        <span className="cooldown-number">{remaining}</span>
        <h1>잠시 쉬어가세요</h1>
        <p>같은 플레이어의 연속 참여를 막기 위한 대기 시간입니다.</p>
        <button type="button" disabled={remaining > 0} onClick={onRejoin}>
          {remaining > 0 ? '대기 중' : '다시 참여하기'}
        </button>
      </section>
    </main>
  );
}
