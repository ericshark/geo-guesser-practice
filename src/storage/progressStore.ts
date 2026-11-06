import { getAllSkillIdsForSection } from '../data/index.ts';
import type { MasteryState, SectionId } from '../data/types.ts';
import { readProgressFromIndexedDb, writeProgressToIndexedDb } from './indexedDbMirror.ts';
import {
  createInitialProgressData,
  type ProgressData,
  type SectionMasteryBreakdown,
  type SkillRecord,
  validateProgressData,
} from './schema.ts';

export interface ProgressStorageAdapter {
  load(): Promise<ProgressData | null>;
  save(data: ProgressData): Promise<void>;
}

export function createInMemoryProgressAdapter(
  initialData?: ProgressData
): ProgressStorageAdapter {
  let current: ProgressData | null = initialData ? structuredClone(initialData) : null;
  return {
    async load() {
      return current ? structuredClone(current) : null;
    },
    async save(data: ProgressData) {
      current = structuredClone(data);
    },
  };
}

export function createBrowserProgressAdapter(
  endpoint = '/api/progress'
): ProgressStorageAdapter {
  return {
    async load() {
      const idbData = await readProgressFromIndexedDb();
      try {
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          const parsed = validateProgressData(json);
          if (parsed.ok) {
            // If IndexedDB has more trials than a fresh disk file, keep the richer snapshot and sync it
            if (idbData && idbData.totalTrials > parsed.data.totalTrials) {
              await this.save(idbData);
              return idbData;
            }
            await writeProgressToIndexedDb(parsed.data);
            return parsed.data;
          }
        }
      } catch {
        // Fallback to IndexedDB when running static/offline
      }
      return idbData;
    },
    async save(data: ProgressData) {
      await writeProgressToIndexedDb(data);
      try {
        await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch {
        // Offline / static preview fallback already saved to IndexedDB
      }
    },
  };
}

export interface RecordAttemptInput {
  section: SectionId;
  skillId: string;
  chosenSkillId?: string;
  sampleId?: string;
  correct: boolean;
  responseTimeMs: number;
  assisted: boolean;
  mastery: MasteryState;
  trialIndex: number;
  now?: Date;
}

export class ProgressStore {
  private state: ProgressData;
  private adapter: ProgressStorageAdapter;
  private listeners = new Set<(state: ProgressData) => void>();

  constructor(adapter: ProgressStorageAdapter = createInMemoryProgressAdapter()) {
    this.adapter = adapter;
    this.state = createInitialProgressData();
  }

  async load(): Promise<ProgressData> {
    const loaded = await this.adapter.load();
    if (loaded) {
      const validated = validateProgressData(loaded);
      if (validated.ok) {
        this.state = validated.data;
        this.emit();
        return this.getState();
      }
    }
    this.state = createInitialProgressData();
    await this.adapter.save(this.state);
    this.emit();
    return this.getState();
  }

  getState(): ProgressData {
    return this.state;
  }

  subscribe(listener: (state: ProgressData) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  async recordAttempt(input: RecordAttemptInput): Promise<ProgressData> {
    const now = input.now ?? new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const next = structuredClone(this.state);

    next.updatedAt = now.toISOString();
    next.totalTrials += 1;
    next.totalTimeMs += Math.max(0, Math.round(input.responseTimeMs));

    // Update daily streak
    if (!next.lastPracticeDate) {
      next.streakDays = 1;
      next.lastPracticeDate = dateKey;
    } else if (next.lastPracticeDate !== dateKey) {
      const prevDate = new Date(`${next.lastPracticeDate}T00:00:00Z`);
      const currDate = new Date(`${dateKey}T00:00:00Z`);
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86_400_000);
      if (diffDays === 1) {
        next.streakDays += 1;
      } else if (diffDays > 1) {
        next.streakDays = 1;
      }
      next.lastPracticeDate = dateKey;
    }

    const existingSkill: SkillRecord = next.skills[input.skillId] ?? {
      skillId: input.skillId,
      section: input.section,
      attempts: [],
      lastTrialIndex: 0,
      recentSampleIds: [],
      mastery: 'unseen',
    };

    existingSkill.attempts.push({
      timestamp: now.getTime(),
      correct: input.correct,
      responseTimeMs: Math.max(0, Math.round(input.responseTimeMs)),
      assisted: input.assisted,
      chosenSkillId: input.chosenSkillId,
      sampleId: input.sampleId,
    });
    if (existingSkill.attempts.length > 30) {
      existingSkill.attempts = existingSkill.attempts.slice(-30);
    }

    existingSkill.lastTrialIndex = input.trialIndex;
    existingSkill.mastery = input.mastery;

    if (input.sampleId) {
      existingSkill.recentSampleIds = [
        ...existingSkill.recentSampleIds.filter((id) => id !== input.sampleId),
        input.sampleId,
      ].slice(-12);
    }

    next.skills[input.skillId] = existingSkill;

    // Update directed confusion matrix on incorrect choices
    if (
      !input.correct &&
      input.chosenSkillId &&
      input.chosenSkillId !== input.skillId
    ) {
      if (!next.confusionMatrix[input.skillId]) {
        next.confusionMatrix[input.skillId] = {};
      }
      next.confusionMatrix[input.skillId][input.chosenSkillId] =
        (next.confusionMatrix[input.skillId][input.chosenSkillId] ?? 0) + 1;
    }

    next.recentTrials.push({
      id: `trial-${next.totalTrials}-${now.getTime()}`,
      timestamp: now.getTime(),
      section: input.section,
      skillId: input.skillId,
      chosenSkillId: input.chosenSkillId,
      sampleId: input.sampleId,
      correct: input.correct,
      responseTimeMs: Math.max(0, Math.round(input.responseTimeMs)),
      assisted: input.assisted,
    });
    if (next.recentTrials.length > 500) {
      next.recentTrials = next.recentTrials.slice(-500);
    }

    this.state = next;
    await this.adapter.save(this.state);
    this.emit();
    return this.state;
  }

  async markPrimeCompleted(groupId: string): Promise<ProgressData> {
    if (this.state.completedPrimes.includes(groupId)) {
      return this.state;
    }
    const next = structuredClone(this.state);
    next.completedPrimes.push(groupId);
    next.updatedAt = new Date().toISOString();
    this.state = next;
    await this.adapter.save(this.state);
    this.emit();
    return this.state;
  }

  exportBackup(): string {
    return JSON.stringify(this.state, null, 2);
  }

  async importBackup(
    rawInput: string | unknown
  ): Promise<{ ok: true; data: ProgressData } | { ok: false; error: string }> {
    let parsedJson: unknown = rawInput;
    if (typeof rawInput === 'string') {
      try {
        parsedJson = JSON.parse(rawInput);
      } catch (err) {
        return {
          ok: false,
          error: `Invalid JSON syntax: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
    const validated = validateProgressData(parsedJson);
    if (!validated.ok) {
      return validated;
    }
    this.state = validated.data;
    await this.adapter.save(this.state);
    this.emit();
    return { ok: true, data: this.state };
  }

  async resetSection(
    section: SectionId,
    options: { confirmed: boolean }
  ): Promise<ProgressData> {
    if (!options.confirmed) {
      throw new Error('Reset requires explicit user confirmation.');
    }
    const next = structuredClone(this.state);
    const removedSkillIds = new Set<string>();
    for (const [skillId, record] of Object.entries(next.skills)) {
      if (record.section === section) {
        removedSkillIds.add(skillId);
        delete next.skills[skillId];
      }
    }
    for (const expectedId of removedSkillIds) {
      delete next.confusionMatrix[expectedId];
    }
    next.recentTrials = next.recentTrials.filter((t) => t.section !== section);
    if (section === 'languages') {
      next.completedPrimes = [];
    }
    next.updatedAt = new Date().toISOString();
    this.state = next;
    await this.adapter.save(this.state);
    this.emit();
    return this.state;
  }

  async resetAll(options: { confirmed: boolean }): Promise<ProgressData> {
    if (!options.confirmed) {
      throw new Error('Reset requires explicit user confirmation.');
    }
    this.state = createInitialProgressData();
    await this.adapter.save(this.state);
    this.emit();
    return this.state;
  }

  getSectionMasteryBreakdown(section: SectionId): SectionMasteryBreakdown {
    const allSkillIds = getAllSkillIdsForSection(section);
    const counts: Record<MasteryState, number> = {
      unseen: 0,
      learning: 0,
      recognized: 0,
      mastered: 0,
    };

    for (const skillId of allSkillIds) {
      const record = this.state.skills[skillId];
      const state: MasteryState = record ? record.mastery : 'unseen';
      counts[state] += 1;
    }

    const practicedTrials = this.state.recentTrials.filter(
      (t) => t.section === section
    ).length;

    return {
      section,
      ...counts,
      total: allSkillIds.length,
      practicedTrials,
    };
  }
}
