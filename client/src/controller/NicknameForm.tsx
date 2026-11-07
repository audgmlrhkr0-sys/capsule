import { useState, type FormEvent } from 'react';
import { needsHomeScreenForFullscreen, usePortrait } from '../hooks/useOrientation';
import { OrientationOverlay } from './OrientationOverlay';

function suggestedNickname(): string {
  return `관람객${Math.floor(Math.random() * 90) + 1}`;
}

export function NicknameForm({
  error,
  onJoin,
}: {
  error: string | null;
  onJoin: (nickname: string) => void;
}) {
  const [nickname, setNickname] = useState(suggestedNickname);
  const portrait = usePortrait();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = nickname.trim();
    if (trimmed && Array.from(trimmed).length <= 6) {
      onJoin(trimmed);
    }
  };

  if (portrait) {
    return (
      <main className="join-page">
        <OrientationOverlay />
      </main>
    );
  }

  return (
    <main className="join-page">
      <form className="join-form" onSubmit={submit}>
        <label className="join-name">
          <span>닉네임</span>
          <input
            value={nickname}
            maxLength={6}
            autoComplete="off"
            enterKeyHint="go"
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
        <button type="submit" className="join-button" disabled={!nickname.trim()}>
          <span>입장하기</span>
        </button>
        {error && <p className="join-error">{error}</p>}
        {needsHomeScreenForFullscreen() && (
          <p className="join-hint">
            전체화면: 공유 버튼 → ‘홈 화면에 추가’ 후 아이콘으로 열기
          </p>
        )}
      </form>
    </main>
  );
}
