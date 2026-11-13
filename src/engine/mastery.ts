import type { ClueRecord } from '../storage/schema.ts';
import { isLearningState } from './scheduler.ts';

export type Mastery = 'new' | 'learning' | 'familiar' | 'mastered';

/** Stability (in days) at which FSRS predicts 90% recall. These thresholds are deliberately strict. */
const FAMILIAR_DAYS = 4;
const MASTERED_DAYS = 21;

export const MASTERY_LABEL: Record<Mastery, string> = {
  new: 'New',
  learning: 'Learning',
  familiar: 'Familiar',
  mastered: 'Mastered',
};

export function masteryOf(record: ClueRecord | undefined): Mastery {
  if (!record) return 'new';
  if (record.lastResult !== 'correct' || isLearningState(record)) return 'learning';
  if (record.card.stability >= MASTERED_DAYS) return 'mastered';
  if (record.card.stability >= FAMILIAR_DAYS) return 'familiar';
  return 'learning';
}

export interface MasteryCounts {
  new: number;
  learning: number;
  familiar: number;
  mastered: number;
  total: number;
}

export function countMastery(
  clueIds: string[],
  records: Record<string, ClueRecord>
): MasteryCounts {
  const counts: MasteryCounts = { new: 0, learning: 0, familiar: 0, mastered: 0, total: clueIds.length };
  for (const id of clueIds) counts[masteryOf(records[id])] += 1;
  return counts;
}

/** 0..1 knowledge score: new 0, learning 0.25, familiar 0.65, mastered 1. */
export function knowledgeScore(counts: MasteryCounts): number {
  if (counts.total === 0) return 0;
  return (counts.learning * 0.25 + counts.familiar * 0.65 + counts.mastered) / counts.total;
}
