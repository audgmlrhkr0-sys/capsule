const SESSION_PREFIX = 'capsule-claw:player-session:';

export function getPlayerSession(roomCode: string): string | undefined {
  return sessionStorage.getItem(`${SESSION_PREFIX}${roomCode}`) ?? undefined;
}

export function savePlayerSession(roomCode: string, sessionToken: string): void {
  sessionStorage.setItem(`${SESSION_PREFIX}${roomCode}`, sessionToken);
}
