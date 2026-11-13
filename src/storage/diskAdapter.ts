import fs from 'node:fs/promises';
import path from 'node:path';
import { readProgressFromIndexedDb, writeProgressToIndexedDb } from './indexedDbMirror.ts';
import type { ProgressStorageAdapter } from './progressStore.ts';
import {
  createInitialProgressData,
  isLegacyProgress,
  type ProgressData,
  validateProgressData,
} from './schema.ts';

export const DEFAULT_PROGRESS_FILE_PATH = path.resolve(process.cwd(), 'data', 'progress.json');

export async function readProgressFile(
  filePath: string = DEFAULT_PROGRESS_FILE_PATH
): Promise<ProgressData> {
  try {
    const text = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(text);
    const validated = validateProgressData(parsed);
    if (validated.ok) {
      return validated.data;
    }
  } catch {
    // Return fresh progress state when file does not exist yet
  }
  return createInitialProgressData();
}

/**
 * Progress from the previous app (version 1) has a different shape. Before the first version 2
 * write replaces it, keep it next to the file as progress.v1.backup.json (never overwritten).
 */
async function backUpLegacyProgress(filePath: string): Promise<void> {
  try {
    const existing = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    if (!isLegacyProgress(existing)) return;
    const backupPath = path.join(path.dirname(filePath), 'progress.v1.backup.json');
    try {
      await fs.access(backupPath);
    } catch {
      await fs.copyFile(filePath, backupPath);
    }
  } catch {
    // No existing file, or unreadable: nothing to back up.
  }
}

export async function writeProgressFile(
  filePath: string,
  data: ProgressData
): Promise<ProgressData> {
  const validated = validateProgressData(data);
  if (!validated.ok) {
    throw new Error(`Invalid progress payload: ${validated.error}`);
  }
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await backUpLegacyProgress(filePath);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(validated.data, null, 2), 'utf-8');
  await fs.rename(tempPath, filePath);
  return validated.data;
}

export function createDiskProgressAdapter(
  filePath: string = DEFAULT_PROGRESS_FILE_PATH
): ProgressStorageAdapter {
  return {
    async load() {
      try {
        const text = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(text);
        const validated = validateProgressData(parsed);
        if (validated.ok) {
          await writeProgressToIndexedDb(validated.data);
          return validated.data;
        }
      } catch {
        // Fallback to IndexedDB mirror if disk file does not exist yet
      }
      return await readProgressFromIndexedDb();
    },
    async save(data: ProgressData) {
      await writeProgressFile(filePath, data);
      await writeProgressToIndexedDb(data);
    },
  };
}
