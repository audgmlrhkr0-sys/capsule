import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WinLogStore, escapeCsv } from './WinLogStore.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('WinLogStore', () => {
  it('creates directories, writes one header, and escapes UTF-8 CSV fields', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'capsule-wins-'));
    temporaryDirectories.push(directory);
    const file = join(directory, 'nested', 'wins.csv');
    const store = new WinLogStore(file);

    store.record({
      wonAt: '2026-11-07T00:00:00.000Z',
      slot: 0,
      nickname: '관람객, "하나"\n둘',
      prizeName: '전시 도록',
    });
    store.record({
      wonAt: '2026-11-07T00:00:01.000Z',
      slot: 1,
      nickname: '손님',
      prizeName: '아트 키링',
    });
    await store.flush();

    const csv = await readFile(file, 'utf8');
    expect(csv.match(/time,nickname,prize/g)).toHaveLength(1);
    expect(csv).toContain('"관람객, ""하나""\n둘"');
    expect(csv).toContain('"전시 도록"');
  });

  it('retains only the latest 500 records in memory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'capsule-wins-'));
    temporaryDirectories.push(directory);
    const store = new WinLogStore(join(directory, 'wins.csv'));

    for (let index = 0; index < 501; index += 1) {
      store.record({
        wonAt: new Date(index).toISOString(),
        slot: 0,
        nickname: `손님${index}`,
        prizeName: '엽서',
      });
    }
    await store.flush();

    expect(store.records()).toHaveLength(500);
    expect(store.records()[0]?.nickname).toBe('손님500');
    expect(store.records().at(-1)?.nickname).toBe('손님1');
  });

  it('escapes embedded quotes', () => {
    expect(escapeCsv('a"b')).toBe('"a""b"');
  });

  it('reports filesystem errors without an unhandled rejection', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'capsule-wins-'));
    temporaryDirectories.push(directory);
    const blocker = join(directory, 'not-a-directory');
    await writeFile(blocker, 'blocked', 'utf8');
    const errors: Error[] = [];
    const store = new WinLogStore(join(blocker, 'wins.csv'), (error) => {
      errors.push(error);
    });

    store.record({
      wonAt: '2026-11-07T00:00:00.000Z',
      slot: 0,
      nickname: '손님',
      prizeName: '엽서',
    });
    await store.flush();

    expect(errors).toHaveLength(1);
  });
});
