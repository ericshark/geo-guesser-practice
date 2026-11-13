import 'fake-indexeddb/auto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLUES } from '../content/index.ts';
import { readProgressFile, writeProgressFile } from './diskAdapter.ts';
import { createInMemoryProgressAdapter, localDateKey, ProgressStore } from './progressStore.ts';
import { createInitialProgressData } from './schema.ts';

const [a, b] = CLUES;

describe('ProgressStore v2', () => {
  it('records answers, schedules the clue and counts activity', async () => {
    const store = new ProgressStore(createInMemoryProgressAdapter());
    await store.load();
    const now = new Date(2026, 2, 1, 12, 0, 0);
    const state = await store.recordAnswer({ clueId: a.id, chosenId: a.id, result: 'correct', responseTimeMs: 2000, now });
    expect(state.totalAnswers).toBe(1);
    expect(state.clues[a.id].seen).toBe(1);
    expect(state.clues[a.id].correct).toBe(1);
    expect(state.activity[localDateKey(now)]).toBe(1);
    expect(state.streakDays).toBe(1);
  });

  it('tracks streaks by local day', async () => {
    const store = new ProgressStore(createInMemoryProgressAdapter());
    await store.load();
    const answer = (d: Date) => store.recordAnswer({ clueId: a.id, result: 'correct', responseTimeMs: 1000, now: d });
    await answer(new Date(2026, 2, 1, 23, 50));
    await answer(new Date(2026, 2, 2, 0, 10)); // next local day, 20 minutes later
    expect((await answer(new Date(2026, 2, 2, 9, 0))).streakDays).toBe(2);
    expect((await answer(new Date(2026, 2, 5, 9, 0))).streakDays).toBe(1); // gap resets
  });

  it('records real mix-ups but never foils', async () => {
    const store = new ProgressStore(createInMemoryProgressAdapter());
    await store.load();
    await store.recordAnswer({ clueId: a.id, chosenId: b.id, result: 'wrong', responseTimeMs: 1000 });
    await store.recordAnswer({ clueId: a.id, chosenId: 'foil-right:fr', result: 'wrong', responseTimeMs: 1000 });
    const s = store.getState();
    expect(s.confusions[a.id]).toEqual({ [b.id]: 1 });
    expect(s.clues[a.id].lastResult).toBe('wrong');
  });

  it('round-trips a backup and rejects malformed input', async () => {
    const store = new ProgressStore(createInMemoryProgressAdapter());
    await store.load();
    await store.recordAnswer({ clueId: a.id, result: 'correct', responseTimeMs: 1000 });
    const backup = store.exportBackup();
    await store.resetAll({ confirmed: true });
    expect(store.getState().totalAnswers).toBe(0);
    expect((await store.importBackup(backup)).ok).toBe(true);
    expect(store.getState().totalAnswers).toBe(1);
    expect((await store.importBackup('{"version":1}')).ok).toBe(false);
    await expect(store.resetAll({ confirmed: false })).rejects.toThrow();
  });

  it('starts fresh from a version 1 file and keeps it as a backup on first save', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'geo-progress-'));
    try {
      const file = path.join(dir, 'progress.json');
      const legacy = JSON.stringify({ version: 1, totalTrials: 73, skills: {} });
      await fs.writeFile(file, legacy, 'utf-8');

      expect((await readProgressFile(file)).totalAnswers).toBe(0);
      await writeProgressFile(file, createInitialProgressData());

      expect(await fs.readFile(path.join(dir, 'progress.v1.backup.json'), 'utf-8')).toBe(legacy);
      expect(JSON.parse(await fs.readFile(file, 'utf-8')).version).toBe(2);

      // A later save must not overwrite the backup.
      await writeProgressFile(file, createInitialProgressData());
      expect(await fs.readFile(path.join(dir, 'progress.v1.backup.json'), 'utf-8')).toBe(legacy);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
