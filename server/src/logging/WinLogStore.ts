import type { WinRecord } from '@capsule-claw/shared';
import { appendFile, mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

const CSV_HEADER = 'time,nickname,prize\n';

export class WinLogStore {
  private readonly recent: WinRecord[] = [];
  private writeChain: Promise<void> = Promise.resolve();
  private initialized = false;

  constructor(
    private readonly filePath: string,
    private readonly onError: (error: Error) => void = (error) => {
      console.error('Failed to append win log:', error);
    },
  ) {}

  record(win: WinRecord): void {
    this.recent.unshift({ ...win });
    if (this.recent.length > 500) {
      this.recent.length = 500;
    }

    this.writeChain = this.writeChain
      .then(async () => {
        await this.ensureFile();
        const line = [
          escapeCsv(win.wonAt),
          escapeCsv(win.nickname),
          escapeCsv(win.prizeName),
        ].join(',');
        await appendFile(this.filePath, `${line}\n`, 'utf8');
      })
      .catch((error: unknown) => {
        this.onError(error instanceof Error ? error : new Error(String(error)));
      });
  }

  records(): WinRecord[] {
    return this.recent.map((win) => ({ ...win }));
  }

  async flush(): Promise<void> {
    await this.writeChain;
  }

  private async ensureFile(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await mkdir(dirname(this.filePath), { recursive: true });
    let hasContent = false;
    try {
      hasContent = (await stat(this.filePath)).size > 0;
    } catch (error: unknown) {
      if (!isMissingFile(error)) {
        throw error;
      }
    }
    if (!hasContent) {
      await appendFile(this.filePath, CSV_HEADER, 'utf8');
    }
    this.initialized = true;
  }
}

export function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
