import Dexie, { type Table } from 'dexie';
import { isLegacyProgress, type ProgressData, validateProgressData } from './schema.ts';

interface StoredProgressRow {
  id: string;
  data: unknown;
}

class GeoGuessrProgressDexie extends Dexie {
  snapshots!: Table<StoredProgressRow, string>;

  constructor() {
    super('GeoGuessrPracticeProgressDB');
    this.version(1).stores({
      snapshots: 'id',
    });
  }
}

let dbInstance: GeoGuessrProgressDexie | null = null;

function getDb(): GeoGuessrProgressDexie | null {
  if (typeof indexedDB === 'undefined') return null;
  if (!dbInstance) dbInstance = new GeoGuessrProgressDexie();
  return dbInstance;
}

export async function readProgressFromIndexedDb(): Promise<ProgressData | null> {
  try {
    const db = getDb();
    if (!db) return null;
    const row = await db.snapshots.get('current');
    if (!row) return null;
    const validated = validateProgressData(row.data);
    return validated.ok ? validated.data : null;
  } catch {
    return null;
  }
}

export async function writeProgressToIndexedDb(data: ProgressData): Promise<void> {
  try {
    const db = getDb();
    if (!db) return;
    // Keep the previous (version 1) app's progress under its own row before replacing it.
    const existing = await db.snapshots.get('current');
    if (existing && isLegacyProgress(existing.data)) {
      await db.snapshots.put({ id: 'v1-backup', data: existing.data });
    }
    await db.snapshots.put({ id: 'current', data });
  } catch {
    // Ignore IndexedDB quota/unavailable errors in restricted environments.
  }
}

export async function clearProgressIndexedDb(): Promise<void> {
  try {
    const db = getDb();
    if (!db) return;
    await db.snapshots.clear();
  } catch {
    // Ignore errors.
  }
}
