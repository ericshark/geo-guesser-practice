import { reviewClue } from '../engine/scheduler.ts';
import { readProgressFromIndexedDb, writeProgressToIndexedDb } from './indexedDbMirror.ts';
import {
  createInitialProgressData,
  type AnswerResult,
  type ProgressData,
  validateProgressData,
} from './schema.ts';

export interface ProgressStorageAdapter {
  load(): Promise<ProgressData | null>;
  save(data: ProgressData): Promise<void>;
}

export function createInMemoryProgressAdapter(
  initialData?: ProgressData
): ProgressStorageAdapter {
  let current: ProgressData | null = initialData ? structuredClone(initialData) : null;
  return {
    async load() {
      return current ? structuredClone(current) : null;
    },
    async save(data: ProgressData) {
      current = structuredClone(data);
    },
  };
}

/** Disk (dev server) is the source of truth; IndexedDB is the offline fallback and mirror. */
export function createBrowserProgressAdapter(
  endpoint = '/api/progress'
): ProgressStorageAdapter {
  return {
    async load() {
      const idbData = await readProgressFromIndexedDb();
      try {
        const res = await fetch(endpoint, { method: 'GET', headers: { Accept: 'application/json' } });
        if (res.ok) {
          const parsed = validateProgressData(await res.json());
          if (parsed.ok) {
            // Keep whichever snapshot has more answers (e.g. a fresh disk file next to a used mirror).
            if (idbData && idbData.totalAnswers > parsed.data.totalAnswers) {
              await this.save(idbData);
              return idbData;
            }
            await writeProgressToIndexedDb(parsed.data);
            return parsed.data;
          }
        }
      } catch {
        // Static or offline: fall back to IndexedDB.
      }
      return idbData;
    },
    async save(data: ProgressData) {
      await writeProgressToIndexedDb(data);
      try {
        await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch {
        // Already saved to IndexedDB.
      }
    },
  };
}

export interface RecordAnswerInput {
  clueId: string;
  /** The option the learner picked: a clue id (for mix-up tracking) or a foil id. */
  chosenId?: string;
  result: AnswerResult;
  responseTimeMs: number;
  now?: Date;
}

/** Local calendar date, e.g. "2026-11-12". Streaks follow the learner's day, not UTC. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

const ACTIVITY_DAYS_KEPT = 90;

export class ProgressStore {
  private state: ProgressData;
  private adapter: ProgressStorageAdapter;
  private listeners = new Set<(state: ProgressData) => void>();

  constructor(adapter: ProgressStorageAdapter = createInMemoryProgressAdapter()) {
    this.adapter = adapter;
    this.state = createInitialProgressData();
  }

  async load(): Promise<ProgressData> {
    const loaded = await this.adapter.load();
    if (loaded) {
      const validated = validateProgressData(loaded);
      if (validated.ok) {
        this.state = validated.data;
        this.emit();
        return this.getState();
      }
    }
    // A missing file, or a version 1 file from the previous app (backed up on first save).
    this.state = createInitialProgressData();
    await this.adapter.save(this.state);
    this.emit();
    return this.getState();
  }

  getState(): ProgressData {
    return this.state;
  }

  subscribe(listener: (state: ProgressData) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }

  private async commit(next: ProgressData): Promise<ProgressData> {
    this.state = next;
    try {
      await this.adapter.save(this.state);
    } finally {
      // The change stays available this session even if persistence fails.
      this.emit();
    }
    return this.state;
  }

  async recordAnswer(input: RecordAnswerInput): Promise<ProgressData> {
    const now = input.now ?? new Date();
    const dateKey = localDateKey(now);
    const next = structuredClone(this.state);

    next.updatedAt = now.toISOString();
    next.totalAnswers += 1;

    if (!next.lastPracticeDate) {
      next.streakDays = 1;
    } else if (next.lastPracticeDate !== dateKey) {
      const gap = dayNumber(dateKey) - dayNumber(next.lastPracticeDate);
      next.streakDays = gap === 1 ? next.streakDays + 1 : 1;
    }
    next.lastPracticeDate = dateKey;

    next.activity[dateKey] = (next.activity[dateKey] ?? 0) + 1;
    const days = Object.keys(next.activity).sort();
    for (const stale of days.slice(0, Math.max(0, days.length - ACTIVITY_DAYS_KEPT))) {
      delete next.activity[stale];
    }

    next.clues[input.clueId] = reviewClue(
      next.clues[input.clueId],
      input.result,
      Math.max(0, input.responseTimeMs),
      now
    );

    // Only real clue-to-clue mix-ups are tracked; foils are not clues.
    if (
      input.result === 'wrong' &&
      input.chosenId &&
      input.chosenId !== input.clueId &&
      !input.chosenId.startsWith('foil-')
    ) {
      const row = (next.confusions[input.clueId] ??= {});
      row[input.chosenId] = (row[input.chosenId] ?? 0) + 1;
    }

    return this.commit(next);
  }

  async completeLesson(lessonId: string): Promise<ProgressData> {
    if (this.state.completedLessons.includes(lessonId)) return this.state;
    const next = structuredClone(this.state);
    next.completedLessons.push(lessonId);
    next.updatedAt = new Date().toISOString();
    return this.commit(next);
  }

  exportBackup(): string {
    return JSON.stringify(this.state, null, 2);
  }

  async importBackup(
    rawInput: string | unknown
  ): Promise<{ ok: true; data: ProgressData } | { ok: false; error: string }> {
    let parsedJson: unknown = rawInput;
    if (typeof rawInput === 'string') {
      try {
        parsedJson = JSON.parse(rawInput);
      } catch (err) {
        return {
          ok: false,
          error: `Invalid JSON syntax: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
    const validated = validateProgressData(parsedJson);
    if (!validated.ok) return validated;
    await this.commit(validated.data);
    return { ok: true, data: this.state };
  }

  async resetAll(options: { confirmed: boolean }): Promise<ProgressData> {
    if (!options.confirmed) throw new Error('Reset requires explicit user confirmation.');
    return this.commit(createInitialProgressData());
  }
}
