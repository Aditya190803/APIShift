import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { APIShiftMessage, PersistentMemoryStore } from './types';

interface MemoryRecord {
  type: 'message' | 'summary';
  message?: APIShiftMessage;
  summary?: string;
}

export class JsonMemoryStore implements PersistentMemoryStore {
  constructor(private readonly path: string) {}

  async load(): Promise<{ history: APIShiftMessage[]; summary: string }> {
    const content = await this.readContent();
    const history: APIShiftMessage[] = [];
    let summary = '';

    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line) as MemoryRecord;
        if (record.type === 'message' && record.message) history.push(record.message);
        if (record.type === 'summary') summary = record.summary ?? '';
      } catch {
        // Ignore corrupted partial lines; JSONL keeps the rest useful.
      }
    }

    return { history, summary };
  }

  async saveMessage(message: APIShiftMessage): Promise<void> {
    await this.append({ type: 'message', message });
  }

  async saveSummary(summary: string): Promise<void> {
    await this.append({ type: 'summary', summary });
  }

  async clear(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, '', 'utf8');
  }

  private async append(record: MemoryRecord): Promise<void> {
    const current = await this.readContent();
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${current}${JSON.stringify(record)}\n`, 'utf8');
  }

  private async readContent(): Promise<string> {
    try {
      return await readFile(this.path, 'utf8');
    } catch (error: any) {
      if (error?.code === 'ENOENT') return '';
      throw error;
    }
  }
}
