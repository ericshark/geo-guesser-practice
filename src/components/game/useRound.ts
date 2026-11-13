import { useCallback, useMemo, useState } from 'react';

/** Number of answered questions that make up one round. */
export const ROUND_LENGTH = 10;

export interface RoundEntry {
  correct: boolean;
  /** Correct, unaided, and within the fluency target. */
  fluent: boolean;
  responseTimeMs: number;
  /** What the correct answer was, shown in the "review" list when missed. */
  label: string;
  sublabel?: string;
}

export interface RoundSummary {
  total: number;
  correct: number;
  fluent: number;
  averageMs: number;
  bestStreak: number;
  missed: Array<Pick<RoundEntry, 'label' | 'sublabel'>>;
}

export function summarizeRound(entries: RoundEntry[]): RoundSummary {
  let streak = 0;
  let bestStreak = 0;
  for (const entry of entries) {
    streak = entry.correct ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }
  const totalMs = entries.reduce((sum, e) => sum + e.responseTimeMs, 0);

  // De-duplicate missed answers so repeats of the same skill appear once.
  const seen = new Set<string>();
  const missed: RoundSummary['missed'] = [];
  for (const entry of entries) {
    if (entry.correct || seen.has(entry.label)) continue;
    seen.add(entry.label);
    missed.push({ label: entry.label, sublabel: entry.sublabel });
  }

  return {
    total: entries.length,
    correct: entries.filter((e) => e.correct).length,
    fluent: entries.filter((e) => e.fluent).length,
    averageMs: entries.length > 0 ? Math.round(totalMs / entries.length) : 0,
    bestStreak,
    missed,
  };
}

/**
 * Splits an otherwise endless practice session into short rounds.
 * Rounds are a UI-only concept: the engine session (and its spaced-repetition
 * queue) keeps running across rounds; "Play again" simply starts counting anew.
 */
export function useRound(roundLength = ROUND_LENGTH) {
  const [entries, setEntries] = useState<RoundEntry[]>([]);
  const [showResults, setShowResults] = useState(false);

  const record = useCallback((entry: RoundEntry) => {
    setEntries((prev) => [...prev, entry]);
  }, []);

  const reset = useCallback(() => {
    setEntries([]);
    setShowResults(false);
  }, []);

  const finish = useCallback(() => setShowResults(true), []);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = entries.length - 1; i >= 0 && entries[i].correct; i -= 1) {
      count += 1;
    }
    return count;
  }, [entries]);

  const summary = useMemo(() => summarizeRound(entries), [entries]);

  return {
    roundLength,
    answered: entries.length,
    isComplete: entries.length >= roundLength,
    streak,
    showResults,
    summary,
    record,
    finish,
    reset,
  };
}

export type RoundController = ReturnType<typeof useRound>;
