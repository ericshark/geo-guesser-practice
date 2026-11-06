import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  ProgressStore,
  createInitialProgressData,
  clearProgressIndexedDb,
} from './index';
import {
  createDiskProgressAdapter,
  readProgressFile,
  writeProgressFile,
} from './diskAdapter';
import { createProgressMiddleware } from '../server/progressMiddleware';

describe('Persistence Seam — ProgressStore & Disk JSON Serialization', () => {
  let tempDir: string;
  let testProgressFilePath: string;

  beforeEach(async () => {
    await clearProgressIndexedDb();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'geo-practice-progress-'));
    testProgressFilePath = path.join(tempDir, 'data', 'progress.json');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('persists trial history, skill Mastery States, and confusion counts to disk JSON and survives reload', async () => {
    const adapter1 = createDiskProgressAdapter(testProgressFilePath);
    const store1 = new ProgressStore(adapter1);
    await store1.load();

    await store1.recordAttempt({
      section: 'languages',
      skillId: 'lang:cs',
      chosenSkillId: 'lang:sk',
      sampleId: 'cs-sent-1',
      correct: false,
      responseTimeMs: 4100,
      assisted: false,
      mastery: 'learning',
      trialIndex: 1,
      now: new Date('2026-11-05T12:00:00Z'),
    });

    await store1.recordAttempt({
      section: 'languages',
      skillId: 'lang:cs',
      chosenSkillId: 'lang:cs',
      sampleId: 'cs-sign-1',
      correct: true,
      responseTimeMs: 1950,
      assisted: false,
      mastery: 'learning',
      trialIndex: 4,
      now: new Date('2026-11-05T12:01:00Z'),
    });

    await store1.markPrimeCompleted('central-slavic-hungarian');

    // Verify raw file on disk is valid JSON with expected fields
    const rawDiskText = await fs.readFile(testProgressFilePath, 'utf-8');
    const parsedDisk = JSON.parse(rawDiskText);
    expect(parsedDisk.version).toBe(1);
    expect(parsedDisk.totalTrials).toBe(2);
    expect(parsedDisk.confusionMatrix['lang:cs']['lang:sk']).toBe(1);
    expect(parsedDisk.skills['lang:cs'].attempts).toHaveLength(2);
    expect(parsedDisk.completedPrimes).toContain('central-slavic-hungarian');

    // Reload into a brand-new ProgressStore instance from the same disk file
    const adapter2 = createDiskProgressAdapter(testProgressFilePath);
    const store2 = new ProgressStore(adapter2);
    const reloaded = await store2.load();

    expect(reloaded.totalTrials).toBe(2);
    expect(reloaded.totalTimeMs).toBe(6050);
    expect(reloaded.streakDays).toBe(1);
    expect(reloaded.confusionMatrix['lang:cs']?.['lang:sk']).toBe(1);
    expect(reloaded.skills['lang:cs']?.recentSampleIds).toEqual(['cs-sent-1', 'cs-sign-1']);
    expect(reloaded.recentTrials).toHaveLength(2);
  });

  it('exports versioned JSON backups, validates imports with Zod, and rejects malformed backups cleanly', async () => {
    const adapter = createDiskProgressAdapter(testProgressFilePath);
    const store = new ProgressStore(adapter);
    await store.load();

    await store.recordAttempt({
      section: 'languages',
      skillId: 'lang:hu',
      chosenSkillId: 'lang:hu',
      sampleId: 'hu-sent-1',
      correct: true,
      responseTimeMs: 1800,
      assisted: false,
      mastery: 'mastered',
      trialIndex: 1,
    });

    const exportedJson = store.exportBackup();
    expect(JSON.parse(exportedJson).version).toBe(1);

    // Reject invalid JSON syntax
    const badJsonResult = await store.importBackup('{ not valid json');
    expect(badJsonResult.ok).toBe(false);

    // Reject schema-invalid payload (wrong version or missing fields)
    const badSchemaResult = await store.importBackup(
      JSON.stringify({ version: 99, totalTrials: -5 })
    );
    expect(badSchemaResult.ok).toBe(false);

    // State remains intact after failed import
    expect(store.getState().skills['lang:hu']?.mastery).toBe('mastered');

    // Reset all with confirmation, then re-import valid backup
    await expect(store.resetAll({ confirmed: false })).rejects.toThrow(/confirmation/i);
    await store.resetAll({ confirmed: true });
    expect(store.getState().totalTrials).toBe(0);

    const validImportResult = await store.importBackup(exportedJson);
    expect(validImportResult.ok).toBe(true);
    expect(store.getState().totalTrials).toBe(1);
    expect(store.getState().skills['lang:hu']?.mastery).toBe('mastered');
  });

  it('supports section-scoped reset with confirmation and serves GET/PUT /api/progress via middleware', async () => {
    const middleware = createProgressMiddleware(testProgressFilePath);

    // Simulate PUT /api/progress
    const sampleState = createInitialProgressData();
    sampleState.totalTrials = 7;

    const putRes = await invokeMiddleware(middleware, 'PUT', '/api/progress', sampleState);
    expect(putRes.statusCode).toBe(200);
    expect(putRes.body.ok).toBe(true);

    // Simulate GET /api/progress
    const getRes = await invokeMiddleware(middleware, 'GET', '/api/progress');
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.totalTrials).toBe(7);

    // Also verify readProgressFile / writeProgressFile helpers
    const onDisk = await readProgressFile(testProgressFilePath);
    expect(onDisk.totalTrials).toBe(7);
    onDisk.totalTrials = 9;
    await writeProgressFile(testProgressFilePath, onDisk);
    expect((await readProgressFile(testProgressFilePath)).totalTrials).toBe(9);
  });
});

async function invokeMiddleware(
  middleware: ReturnType<typeof createProgressMiddleware>,
  method: string,
  url: string,
  body?: unknown
): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = body ? [encoder.encode(JSON.stringify(body))] : [];
    const req: any = {
      method,
      url,
      headers: { 'content-type': 'application/json' },
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    };
    let statusCode = 200;
    const res: any = {
      set statusCode(code: number) {
        statusCode = code;
      },
      get statusCode() {
        return statusCode;
      },
      setHeader: () => {},
      end: (payload?: string) => {
        try {
          resolve({
            statusCode,
            body: payload ? JSON.parse(payload) : undefined,
          });
        } catch (err) {
          reject(err);
        }
      },
    };
    middleware(req, res, () => {
      resolve({ statusCode: 404, body: null });
    });
  });
}
