export type RandomInteger = (maximum: number) => number;

export function generateRoomCode(
  randomInteger: RandomInteger = (maximum) => Math.floor(Math.random() * maximum),
): string {
  const value = randomInteger(10_000);
  if (!Number.isInteger(value) || value < 0 || value >= 10_000) {
    throw new Error('Room-code random source returned an invalid value');
  }
  return value.toString().padStart(4, '0');
}
