import { describe, expect, it } from 'vitest';
import { summarizeRound, type RoundEntry } from './useRound.ts';

const entry = (correct: boolean, label = 'X', ms = 2000): RoundEntry => ({
  correct,
  fluent: correct && ms <= 3000,
  responseTimeMs: ms,
  label,
});

describe('summarizeRound', () => {
  it('computes score, best streak, average time, and de-duplicated misses', () => {
    const summary = summarizeRound([
      entry(true, 'A', 1000),
      entry(true, 'B', 2000),
      entry(false, 'C', 4000),
      entry(true, 'D', 1000),
      entry(true, 'E', 1000),
      entry(true, 'F', 5000),
      entry(false, 'C', 3000),
    ]);

    expect(summary).toMatchObject({
      total: 7,
      correct: 5,
      fluent: 4,
      averageMs: 2429,
      bestStreak: 3,
      missed: [{ label: 'C' }],
    });
  });

  it('handles an empty round', () => {
    expect(summarizeRound([])).toMatchObject({ total: 0, averageMs: 0, bestStreak: 0, missed: [] });
  });
});
