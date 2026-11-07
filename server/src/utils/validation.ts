export function normalizeNickname(value: string): string | null {
  const nickname = value.trim();
  const length = Array.from(nickname).length;
  if (length < 1 || length > 6) {
    return null;
  }
  return nickname;
}

export function normalizeRoomCode(value: string): string | null {
  const roomCode = value.trim();
  return /^\d{4}$/.test(roomCode) ? roomCode : null;
}
