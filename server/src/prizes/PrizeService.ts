import type { AdminPrizeStock, PrizeConfig } from '@capsule-claw/shared';
import { readFile } from 'node:fs/promises';

export class PrizeService {
  private readonly prizes: PrizeConfig[];
  private readonly initialStock = new Map<string, number>();

  constructor(
    config: PrizeConfig[],
    private readonly random: () => number = Math.random,
  ) {
    this.prizes = validatePrizeConfig(config).map((prize) => ({ ...prize }));
    for (const prize of this.prizes) {
      this.initialStock.set(prize.id, prize.stock);
    }
  }

  static async fromFile(
    path: string | URL,
    random: () => number = Math.random,
  ): Promise<PrizeService> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    } catch (error) {
      throw new Error(`Unable to load prize config: ${messageFrom(error)}`);
    }
    return new PrizeService(validatePrizeConfig(parsed), random);
  }

  draw(): PrizeConfig | null {
    const available = this.prizes.filter((prize) => prize.stock > 0);
    if (available.length === 0) {
      return null;
    }
    const totalWeight = available.reduce((sum, prize) => sum + prize.weight, 0);
    const randomValue = this.random();
    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
      throw new Error('Prize RNG must return a value in [0, 1)');
    }
    const target = randomValue * totalWeight;
    let cumulative = 0;
    for (const prize of available) {
      cumulative += prize.weight;
      if (target < cumulative) {
        prize.stock -= 1;
        return { ...prize };
      }
    }
    throw new Error('Prize selection failed unexpectedly');
  }

  snapshot(): PrizeConfig[] {
    return this.prizes.map((prize) => ({ ...prize }));
  }

  adminSnapshot(): AdminPrizeStock[] {
    return this.prizes.map((prize) => {
      const initial = this.initialStock.get(prize.id) ?? prize.stock;
      return {
        id: prize.id,
        name: prize.name,
        initial,
        remaining: prize.stock,
        used: initial - prize.stock,
      };
    });
  }

  resetStock(): void {
    for (const prize of this.prizes) {
      prize.stock = this.initialStock.get(prize.id) ?? prize.stock;
    }
  }
}

export function validatePrizeConfig(value: unknown): PrizeConfig[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Prize config must be a non-empty array');
  }
  const ids = new Set<string>();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Prize at index ${index} must be an object`);
    }
    const candidate = entry as Partial<PrizeConfig>;
    if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
      throw new Error(`Prize at index ${index} has an invalid id`);
    }
    if (ids.has(candidate.id)) {
      throw new Error(`Duplicate prize id: ${candidate.id}`);
    }
    ids.add(candidate.id);
    if (typeof candidate.name !== 'string' || candidate.name.trim() === '') {
      throw new Error(`Prize ${candidate.id} has an invalid name`);
    }
    if (
      typeof candidate.weight !== 'number' ||
      !Number.isFinite(candidate.weight) ||
      candidate.weight <= 0
    ) {
      throw new Error(`Prize ${candidate.id} must have a positive weight`);
    }
    if (
      typeof candidate.stock !== 'number' ||
      !Number.isInteger(candidate.stock) ||
      candidate.stock < 0
    ) {
      throw new Error(`Prize ${candidate.id} must have non-negative integer stock`);
    }
    return {
      id: candidate.id,
      name: candidate.name.trim(),
      weight: candidate.weight,
      stock: candidate.stock,
    };
  });
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
