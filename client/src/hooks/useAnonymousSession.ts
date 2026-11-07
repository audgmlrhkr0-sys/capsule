const SESSION_PREFIX = 'capsule-claw:player-session:';
const NICKNAME_PREFIX = 'capsule-claw:player-nickname:';

export function getPlayerSession(roomCode: string): string | undefined {
  return sessionStorage.getItem(`${SESSION_PREFIX}${roomCode}`) ?? undefined;
}

export function savePlayerSession(
  roomCode: string,
  sessionToken: string,
  nickname?: string,
): void {
  sessionStorage.setItem(`${SESSION_PREFIX}${roomCode}`, sessionToken);
  if (nickname) {
    sessionStorage.setItem(`${NICKNAME_PREFIX}${roomCode}`, nickname);
  }
}

export function getPlayerNickname(roomCode: string): string | undefined {
  return sessionStorage.getItem(`${NICKNAME_PREFIX}${roomCode}`) ?? undefined;
}

export function clearPlayerSession(roomCode: string): void {
  sessionStorage.removeItem(`${SESSION_PREFIX}${roomCode}`);
  sessionStorage.removeItem(`${NICKNAME_PREFIX}${roomCode}`);
}
