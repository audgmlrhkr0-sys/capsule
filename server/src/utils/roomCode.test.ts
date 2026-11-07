import { describe, expect, it } from 'vitest';
import { generateRoomCode } from './roomCode.js';

describe('generateRoomCode', () => {
  it('pads values to exactly four digits', () => {
    expect(generateRoomCode(() => 7)).toBe('0007');
    expect(generateRoomCode(() => 9_999)).toBe('9999');
  });

  it('rejects invalid random values', () => {
    expect(() => generateRoomCode(() => 10_000)).toThrow();
  });
});
