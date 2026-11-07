import { useState, type FormEvent } from 'react';

function suggestedNickname(): string {
  return `관람객${Math.floor(Math.random() * 90) + 1}`;
}

export function NicknameForm({
  roomCode,
  error,
  onJoin,
}: {
  roomCode: string;
  error: string | null;
  onJoin: (nickname: string) => void;
}) {
  const [nickname, setNickname] = useState(suggestedNickname);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = nickname.trim();
    if (trimmed && Array.from(trimmed).length <= 6) {
      onJoin(trimmed);
    }
  };

  return (
    <main className="nickname-page">
      <section className="nickname-card">
        <p className="controller-kicker">경북대미술관 소장품 캡슐 뽑기 · ROOM {roomCode}</p>
        <h1>어떤 이름으로<br />참여할까요?</h1>
        <p className="nickname-help">전시장 화면에 표시될 이름을 정해주세요.</p>
        <form onSubmit={submit}>
          <label htmlFor="nickname">닉네임 (최대 6자)</label>
          <input
            id="nickname"
            value={nickname}
            maxLength={6}
            autoComplete="off"
            enterKeyHint="done"
            onChange={(event) => setNickname(event.target.value)}
          />
          {error && <p className="join-error">{error}</p>}
          <button type="submit" disabled={!nickname.trim()}>
            입장하기 <span>→</span>
          </button>
        </form>
      </section>
    </main>
  );
}
