import { describe, expect, it } from 'vitest';
import { PrizeService, validatePrizeConfig } from './PrizeService.js';

const config = [
  { id: 'a', name: '엽서', weight: 1, stock: 2 },
  { id: 'b', name: '키링', weight: 3, stock: 2 },
];

describe('PrizeService', () => {
  it('loads the checked-in Korean prize inventory', async () => {
    const service = await PrizeService.fromFile(
      new URL('../../config/prizes.json', import.meta.url),
      () => 0,
    );

    expect(service.snapshot().length).toBeGreaterThanOrEqual(1);
    expect(service.snapshot().every((prize) => /[가-힣]/.test(prize.name))).toBe(true);
  });

  it('selects deterministic weighted boundaries', () => {
    expect(new PrizeService(config, () => 0).draw()?.id).toBe('a');
    expect(new PrizeService(config, () => 0.249999).draw()?.id).toBe('a');
    expect(new PrizeService(config, () => 0.25).draw()?.id).toBe('b');
    expect(new PrizeService(config, () => 0.999999).draw()?.id).toBe('b');
  });

  it('excludes zero-stock prizes and decrements exactly once', () => {
    const service = new PrizeService(
      [
        { id: 'empty', name: '품절', weight: 100, stock: 0 },
        { id: 'live', name: '재고', weight: 1, stock: 2 },
      ],
      () => 0,
    );

    expect(service.draw()?.id).toBe('live');
    expect(service.snapshot().find((prize) => prize.id === 'live')?.stock).toBe(1);
  });

  it('returns null after all stock is exhausted', () => {
    const service = new PrizeService(
      [{ id: 'one', name: '한정 상품', weight: 1, stock: 1 }],
      () => 0,
    );

    expect(service.draw()?.name).toBe('한정 상품');
    expect(service.draw()).toBeNull();
  });

  it('rejects malformed and duplicate configuration', () => {
    expect(() => validatePrizeConfig([])).toThrow();
    expect(() =>
      validatePrizeConfig([
        { id: 'same', name: 'A', weight: 1, stock: 1 },
        { id: 'same', name: 'B', weight: 1, stock: 1 },
      ]),
    ).toThrow(/Duplicate/);
    expect(() =>
      validatePrizeConfig([{ id: 'bad', name: 'Bad', weight: 0, stock: -1 }]),
    ).toThrow();
  });
});
