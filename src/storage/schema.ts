import { z } from 'zod';
import type { MasteryState, SectionId } from '../data/types.ts';

export const SectionIdSchema = z.enum([
  'languages',
  'driving-side',
  'coverage',
  'domains-currencies',
]);

export const MasteryStateSchema = z.enum([
  'unseen',
  'learning',
  'recognized',
  'mastered',
]);

export const SkillAttemptSchema = z.object({
  timestamp: z.number(),
  correct: z.boolean(),
  responseTimeMs: z.number().nonnegative(),
  assisted: z.boolean(),
  chosenSkillId: z.string().optional(),
  sampleId: z.string().optional(),
});

export const SkillRecordSchema = z.object({
  skillId: z.string().min(1),
  section: SectionIdSchema,
  attempts: z.array(SkillAttemptSchema),
  lastTrialIndex: z.number().int().nonnegative(),
  recentSampleIds: z.array(z.string()),
  mastery: MasteryStateSchema,
});

export const TrialHistoryEntrySchema = z.object({
  id: z.string().min(1),
  timestamp: z.number(),
  section: SectionIdSchema,
  skillId: z.string().min(1),
  chosenSkillId: z.string().optional(),
  sampleId: z.string().optional(),
  correct: z.boolean(),
  responseTimeMs: z.number().nonnegative(),
  assisted: z.boolean(),
});

export const ProgressDataSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  totalTrials: z.number().int().nonnegative(),
  totalTimeMs: z.number().nonnegative(),
  streakDays: z.number().int().nonnegative(),
  lastPracticeDate: z.string().nullable(),
  completedPrimes: z.array(z.string()),
  skills: z.record(z.string(), SkillRecordSchema),
  confusionMatrix: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())),
  recentTrials: z.array(TrialHistoryEntrySchema),
});

export type SkillAttempt = z.infer<typeof SkillAttemptSchema>;
export type SkillRecord = z.infer<typeof SkillRecordSchema>;
export type TrialHistoryEntry = z.infer<typeof TrialHistoryEntrySchema>;
export type ProgressData = z.infer<typeof ProgressDataSchema>;

export function createInitialProgressData(now: Date = new Date()): ProgressData {
  return {
    version: 1,
    updatedAt: now.toISOString(),
    totalTrials: 0,
    totalTimeMs: 0,
    streakDays: 0,
    lastPracticeDate: null,
    completedPrimes: [],
    skills: {},
    confusionMatrix: {},
    recentTrials: [],
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

export interface SectionMasteryBreakdown {
  section: SectionId;
  unseen: number;
  learning: number;
  recognized: number;
  mastered: number;
  total: number;
  practicedTrials: number;
}

export type { MasteryState, SectionId };
