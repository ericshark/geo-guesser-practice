import { z } from 'zod';

/** FSRS card as persisted (dates are ISO strings so the file stays plain JSON). */
export const StoredCardSchema = z.object({
  due: z.string(),
  stability: z.number(),
  difficulty: z.number(),
  scheduled_days: z.number(),
  learning_steps: z.number(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  state: z.number().int().min(0).max(3),
  last_review: z.string().optional(),
});

export const AnswerResultSchema = z.enum(['correct', 'wrong', 'hint']);

export const ClueRecordSchema = z.object({
  card: StoredCardSchema,
  seen: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  lastResult: AnswerResultSchema,
  lastAt: z.string(),
});

export const ProgressDataSchema = z.object({
  version: z.literal(2),
  updatedAt: z.string(),
  totalAnswers: z.number().int().nonnegative(),
  streakDays: z.number().int().nonnegative(),
  /** Local calendar date (YYYY-MM-DD) of the last practice. */
  lastPracticeDate: z.string().nullable(),
  clues: z.record(z.string(), ClueRecordSchema),
  /** expected clue id -> chosen clue id -> times chosen wrongly. */
  confusions: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())),
  completedLessons: z.array(z.string()),
  /** Local date -> answers that day (last 90 days kept). */
  activity: z.record(z.string(), z.number().int().nonnegative()),
});

export type StoredCard = z.infer<typeof StoredCardSchema>;
export type AnswerResult = z.infer<typeof AnswerResultSchema>;
export type ClueRecord = z.infer<typeof ClueRecordSchema>;
export type ProgressData = z.infer<typeof ProgressDataSchema>;

export function createInitialProgressData(now: Date = new Date()): ProgressData {
  return {
    version: 2,
    updatedAt: now.toISOString(),
    totalAnswers: 0,
    streakDays: 0,
    lastPracticeDate: null,
    clues: {},
    confusions: {},
    completedLessons: [],
    activity: {},
  };
}

export function validateProgressData(
  input: unknown
): { ok: true; data: ProgressData } | { ok: false; error: string } {
  const parsed = ProgressDataSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; '),
    };
  }
  return { ok: true, data: parsed.data };
}

/** True for a saved file from the previous (version 1, section-based) app. */
export function isLegacyProgress(input: unknown): boolean {
  return typeof input === 'object' && input !== null && (input as { version?: unknown }).version === 1;
}
