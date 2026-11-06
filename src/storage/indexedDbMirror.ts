import Dexie, { type Table } from 'dexie';
import { type ProgressData, validateProgressData } from './schema.ts';

interface StoredProgressRow {
  id: string;
  data: ProgressData;
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
  if (typeof indexedDB === 'undefined') {
    return null;
  }
  if (!dbInstance) {
    dbInstance = new GeoGuessrProgressDexie();
  }
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
    await db.snapshots.put({ id: 'current', data });
  } catch {
    // Ignore IndexedDB quota/unavailable errors when running in restricted environments
  }
}

export async function clearProgressIndexedDb(): Promise<void> {
  try {
    const db = getDb();
    if (!db) return;
    await db.snapshots.clear();
  } catch {
    // Ignore errors
  }
}
