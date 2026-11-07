import { describe, expect, it } from 'vitest';
import { normalizeNickname, normalizeRoomCode } from './validation.js';

describe('controller input validation', () => {
  it('trims nicknames and accepts at most six characters', () => {
    expect(normalizeNickname('  관람객12  ')).toBe('관람객12');
    expect(normalizeNickname('123456')).toBe('123456');
    expect(normalizeNickname('1234567')).toBeNull();
    expect(normalizeNickname('   ')).toBeNull();
  });

  it('accepts only four-digit room codes', () => {
    expect(normalizeRoomCode(' 0042 ')).toBe('0042');
    expect(normalizeRoomCode('42')).toBeNull();
    expect(normalizeRoomCode('abcd')).toBeNull();
  });
});
