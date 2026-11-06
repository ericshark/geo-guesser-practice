import {
  findTellMatchesInSample,
  getCandidateCountriesForLanguage,
  getLanguagesForGroupSelection,
  LANGUAGE_GROUP_MAP,
  LANGUAGE_MAP,
  type LanguageGroupId,
  type LanguageGroupSelectionId,
  type LanguageSample,
  type LanguageSpec,
  type MasteryState,
  type PlayableCountry,
  type TellSpanMatch,
  type TellSpec,
} from '../data/index.ts';
import type { ProgressStore, SkillAttempt } from '../storage/index.ts';

export const LANGUAGE_FLUENCY_THRESHOLD_MS = 3500;
export const DRIVING_SIDE_FLUENCY_THRESHOLD_MS = 2500;
export const ARTS_SPACING_DELAY = 2;

export interface ArtsPriorityParams {
  trialsSinceLastSeen: number; // N
  lastCorrect: boolean;
  lastAssisted: boolean;
  lastResponseTimeMs: number;
  fluencyThresholdMs: number;
  mastery: MasteryState;
  confusionBoost?: number;
}

/**
 * Computes the Adaptive Response-Time-based Sequencing (ARTS) priority score:
 * P = a * (N - D) * [ b * (1 - alpha) * (max(0, ln(RT / r)) + 0.25 * (RT / r)) + alpha * W ] + C_pair
 * When N <= D (D = 2 intervening trials), returns a non-positive score so the skill is blocked by the spacing delay.
 */
export function computeArtsPriority(params: ArtsPriorityParams): number {
  const {
    trialsSinceLastSeen,
    lastCorrect,
    lastAssisted,
    lastResponseTimeMs,
    fluencyThresholdMs,
    mastery,
    confusionBoost = 0,
  } = params;

  const D = ARTS_SPACING_DELAY;
  const delta = trialsSinceLastSeen - D;
  if (delta <= 0) {
    return delta; // <= 0 when N <= D
  }

  const a = 1.0;
  const b = 4.0;
  const W = 15.0;
  const alpha = !lastCorrect || lastAssisted ? 1 : 0;
  const safeRt = Math.max(150, lastResponseTimeMs);
  const ratio = safeRt / fluencyThresholdMs;

  const rtWeight = Math.max(0, Math.log(ratio)) + 0.25 * ratio;
  const inner = b * (1 - alpha) * rtWeight + alpha * W;
  const masteryFactor = mastery === 'mastered' ? 0.35 : mastery === 'recognized' ? 0.75 : 1.0;

  return a * delta * inner * masteryFactor + confusionBoost;
}

/**
 * Mastery State progression rules:
 * - unseen: 0 attempts
 * - learning: >0 attempts, <80% accuracy on last 5 attempts (<4 unaided correct) or assisted on the most recent attempt
 * - recognized: >=80% accuracy (at least 4 of last 5 correct without assistance), but not yet meeting the fluency RT threshold
 * - mastered: at least 4 of last 5 attempts correct without assistance, including the last 3 consecutive attempts correct and under fluencyThresholdMs
 */
export function calculateMasteryState(
  attempts: SkillAttempt[],
  fluencyThresholdMs: number = LANGUAGE_FLUENCY_THRESHOLD_MS
): MasteryState {
  if (attempts.length === 0) {
    return 'unseen';
  }

  const lastAttempt = attempts[attempts.length - 1];
  if (lastAttempt.assisted) {
    return 'learning';
  }

  const last5 = attempts.slice(-5);
  const unaidedCorrectCount = last5.filter((a) => a.correct && !a.assisted).length;

  if (unaidedCorrectCount < 4) {
    return 'learning';
  }

  const last3 = attempts.slice(-3);
  const last3FluentAndUnaided =
    last3.length === 3 &&
    last3.every((a) => a.correct && !a.assisted && a.responseTimeMs <= fluencyThresholdMs);

  if (last3FluentAndUnaided) {
    return 'mastered';
  }

  return 'recognized';
}

export type LanguageDrillMode = 'mixed' | 'samples' | 'tells';

export interface LanguageSessionConfig {
  groupId: LanguageGroupSelectionId;
  skipPrime?: boolean;
  drillMode?: LanguageDrillMode;
}

export interface ContrastCardLanguageEntry {
  id: string;
  skillId: string;
  name: string;
  nativeName: string;
  script: string;
  tells: TellSpec[];
  gestaltNote: string;
  contrastNote: string;
  candidateCountries: PlayableCountry[];
  uncoveredCountryNotes: string[];
  exampleSample: LanguageSample;
  mastery: MasteryState;
}

export interface ContrastCardPrime {
  groupId: LanguageGroupId;
  groupName: string;
  description: string;
  primeSummary: string;
  alreadyViewed: boolean;
  languages: ContrastCardLanguageEntry[];
}

export interface TrialOption {
  id: string; // e.g., 'lang:cs'
  languageId: string; // e.g., 'cs'
  label: string;
  sublabel: string;
  shortcutKey: number; // 1..6
}

export type LanguageTrialKind = 'sample-recognition' | 'tell-recognition';

export interface PracticeTrial {
  trialNumber: number;
  kind: LanguageTrialKind;
  skillId: string; // e.g., 'lang:cs'
  languageId: string;
  groupName: string;
  fluencyThresholdMs: number;
  sample: LanguageSample;
  tellPrompt?: {
    tellId: string;
    pattern: string;
    label: string;
    script: string;
  };
  options: TrialOption[];
  startedAtMs: number;
}

export interface ChosenLanguageContrast {
  languageId: string;
  languageName: string;
  contrastNote: string;
  keyTells: Array<{ pattern: string; label: string }>;
}

export interface LanguageTrialFeedback {
  correct: boolean;
  skillId: string;
  languageId: string;
  languageName: string;
  nativeName: string;
  chosenOptionId: string;
  chosenLanguageName: string;
  responseTimeMs: number;
  fluencyTargetMs: number;
  isFluentSpeed: boolean;
  previousMastery: MasteryState;
  newMastery: MasteryState;
  sample: LanguageSample;
  translation: string;
  matchedTells: TellSpanMatch[];
  structuralClue?: string;
  gestaltNote: string;
  contrastNote: string;
  chosenLanguageContrast?: ChosenLanguageContrast;
  candidateCountries: PlayableCountry[];
  uncoveredCountryNotes: string[];
}

export interface SessionStats {
  trialsCompleted: number;
  correctCount: number;
  fluentCount: number;
  averageResponseTimeMs: number;
}

export class PracticeEngine {
  private store: ProgressStore;
  private now: () => number;
  private rng: () => number;

  private activeGroupSelection: LanguageGroupSelectionId = 'east-asian';
  private drillMode: LanguageDrillMode = 'mixed';
  private stage0Prime: ContrastCardPrime | null = null;
  private currentTrial: PracticeTrial | null = null;
  private lastFeedback: LanguageTrialFeedback | null = null;

  private sessionTrialCounter = 0;
  private sessionLastPresentedAt = new Map<string, number>();
  private sessionSeenSamplesByLang = new Map<string, Set<string>>();
  private lastSampleIdByLang = new Map<string, string>();
  private lastTellIdByLang = new Map<string, string>();

  private sessionStats: SessionStats = {
    trialsCompleted: 0,
    correctCount: 0,
    fluentCount: 0,
    averageResponseTimeMs: 0,
  };

  constructor(
    store: ProgressStore,
    options?: {
      now?: () => number;
      rng?: () => number;
    }
  ) {
    this.store = store;
    this.now = options?.now ?? (() => Date.now());
    this.rng = options?.rng ?? (() => Math.random());
  }

  startLanguageSession(config: LanguageSessionConfig): void {
    this.activeGroupSelection = config.groupId;
    this.drillMode = config.drillMode ?? 'mixed';
    this.sessionTrialCounter = 0;
    this.sessionLastPresentedAt.clear();
    this.sessionSeenSamplesByLang.clear();
    this.lastSampleIdByLang.clear();
    this.lastTellIdByLang.clear();
    this.currentTrial = null;
    this.lastFeedback = null;
    this.sessionStats = {
      trialsCompleted: 0,
      correctCount: 0,
      fluentCount: 0,
      averageResponseTimeMs: 0,
    };

    if (config.groupId !== 'all-mixed' && !config.skipPrime) {
      const groupSpec = LANGUAGE_GROUP_MAP[config.groupId];
      const state = this.store.getState();
      const languages = getLanguagesForGroupSelection(config.groupId);
      this.stage0Prime = {
        groupId: config.groupId,
        groupName: groupSpec.name,
        description: groupSpec.description,
        primeSummary: groupSpec.primeSummary,
        alreadyViewed: state.completedPrimes.includes(config.groupId),
        languages: languages.map((lang) => {
          const skillId = `lang:${lang.id}`;
          const mastery = state.skills[skillId]?.mastery ?? 'unseen';
          return {
            id: lang.id,
            skillId,
            name: lang.name,
            nativeName: lang.nativeName,
            script: lang.script,
            tells: lang.tells,
            gestaltNote: lang.gestaltNote,
            contrastNote: lang.contrastNote,
            candidateCountries: getCandidateCountriesForLanguage(lang),
            uncoveredCountryNotes: lang.uncoveredCountryNotes,
            exampleSample: lang.samples[0],
            mastery,
          };
        }),
      };
    } else {
      this.stage0Prime = null;
      this.nextTrial();
    }
  }

  getStage0Prime(): ContrastCardPrime | null {
    return this.stage0Prime;
  }

  async completeStage0Prime(): Promise<PracticeTrial> {
    if (this.stage0Prime) {
      await this.store.markPrimeCompleted(this.stage0Prime.groupId);
      this.stage0Prime = null;
    }
    return this.nextTrial();
  }

  skipStage0Prime(): PracticeTrial {
    this.stage0Prime = null;
    return this.nextTrial();
  }

  getCurrentTrial(): PracticeTrial | null {
    return this.currentTrial;
  }

  getLastFeedback(): LanguageTrialFeedback | null {
    return this.lastFeedback;
  }

  getSessionStats(): SessionStats {
    return { ...this.sessionStats };
  }

  nextTrial(): PracticeTrial {
    this.sessionTrialCounter += 1;
    this.lastFeedback = null;

    const pool = getLanguagesForGroupSelection(this.activeGroupSelection);
    const chosenLanguage = this.selectNextLanguageByArts(pool);
    const skillId = `lang:${chosenLanguage.id}`;
    this.sessionLastPresentedAt.set(skillId, this.sessionTrialCounter);

    const trialKind: LanguageTrialKind =
      this.drillMode === 'tells'
        ? 'tell-recognition'
        : this.drillMode === 'samples'
          ? 'sample-recognition'
          : this.sessionTrialCounter % 4 === 0
            ? 'tell-recognition'
            : 'sample-recognition';

    const sample = this.selectFreshSample(chosenLanguage);
    const tellPrompt =
      trialKind === 'tell-recognition'
        ? this.selectTellPrompt(chosenLanguage, sample)
        : undefined;

    const options = this.buildOptionsForLanguage(chosenLanguage);
    const groupSpec = LANGUAGE_GROUP_MAP[chosenLanguage.groupId];

    this.currentTrial = {
      trialNumber: this.sessionTrialCounter,
      kind: trialKind,
      skillId,
      languageId: chosenLanguage.id,
      groupName:
        this.activeGroupSelection === 'all-mixed'
          ? `All-Groups Mixed (${groupSpec.name})`
          : groupSpec.name,
      fluencyThresholdMs: LANGUAGE_FLUENCY_THRESHOLD_MS,
      sample,
      tellPrompt,
      options,
      startedAtMs: this.now(),
    };

    return this.currentTrial;
  }

  async submitAnswer(
    chosenOptionId: string,
    explicitResponseTimeMs?: number
  ): Promise<LanguageTrialFeedback> {
    const trial = this.currentTrial;
    if (!trial) {
      throw new Error('No active trial to submit an answer for.');
    }

    const responseTimeMs =
      explicitResponseTimeMs ?? Math.max(100, this.now() - trial.startedAtMs);
    const correct = chosenOptionId === trial.skillId;

    const state = this.store.getState();
    const existingRecord = state.skills[trial.skillId];
    const previousMastery: MasteryState = existingRecord?.mastery ?? 'unseen';
    const existingAttempts: SkillAttempt[] = existingRecord?.attempts ?? [];

    const simulatedAttempts: SkillAttempt[] = [
      ...existingAttempts,
      {
        timestamp: this.now(),
        correct,
        responseTimeMs,
        assisted: false,
        chosenSkillId: chosenOptionId,
        sampleId: trial.sample.id,
      },
    ];

    const newMastery = calculateMasteryState(
      simulatedAttempts,
      trial.fluencyThresholdMs
    );

    const targetLanguage = LANGUAGE_MAP[trial.languageId];
    const chosenLanguageId = chosenOptionId.replace(/^lang:/, '');
    const chosenLanguage = LANGUAGE_MAP[chosenLanguageId];

    const matchedTells = findTellMatchesInSample(trial.sample, targetLanguage);
    const candidateCountries = getCandidateCountriesForLanguage(targetLanguage);

    let chosenLanguageContrast: ChosenLanguageContrast | undefined;
    if (!correct && chosenLanguage) {
      chosenLanguageContrast = {
        languageId: chosenLanguage.id,
        languageName: chosenLanguage.name,
        contrastNote: chosenLanguage.contrastNote,
        keyTells: chosenLanguage.tells.slice(0, 2).map((t) => ({
          pattern: t.pattern,
          label: t.label,
        })),
      };
    }

    const prevTotalRt =
      this.sessionStats.averageResponseTimeMs * this.sessionStats.trialsCompleted;
    this.sessionStats.trialsCompleted += 1;
    if (correct) {
      this.sessionStats.correctCount += 1;
      if (responseTimeMs <= trial.fluencyThresholdMs) {
        this.sessionStats.fluentCount += 1;
      }
    }
    this.sessionStats.averageResponseTimeMs = Math.round(
      (prevTotalRt + responseTimeMs) / this.sessionStats.trialsCompleted
    );

    const feedback: LanguageTrialFeedback = {
      correct,
      skillId: trial.skillId,
      languageId: targetLanguage.id,
      languageName: targetLanguage.name,
      nativeName: targetLanguage.nativeName,
      chosenOptionId,
      chosenLanguageName: chosenLanguage?.name ?? chosenOptionId,
      responseTimeMs,
      fluencyTargetMs: trial.fluencyThresholdMs,
      isFluentSpeed: correct && responseTimeMs <= trial.fluencyThresholdMs,
      previousMastery,
      newMastery,
      sample: trial.sample,
      translation: trial.sample.translation,
      matchedTells,
      structuralClue: trial.sample.structuralClue,
      gestaltNote: targetLanguage.gestaltNote,
      contrastNote: targetLanguage.contrastNote,
      chosenLanguageContrast,
      candidateCountries,
      uncoveredCountryNotes: targetLanguage.uncoveredCountryNotes,
    };

    this.lastFeedback = feedback;

    await this.store.recordAttempt({
      section: 'languages',
      skillId: trial.skillId,
      chosenSkillId: chosenOptionId,
      sampleId: trial.sample.id,
      correct,
      responseTimeMs,
      assisted: false,
      mastery: newMastery,
      trialIndex: this.sessionTrialCounter,
      now: new Date(this.now()),
    });

    return feedback;
  }

  private selectNextLanguageByArts(pool: LanguageSpec[]): LanguageSpec {
    const state = this.store.getState();

    const scored = pool.map((lang, index) => {
      const skillId = `lang:${lang.id}`;
      const lastSessionTrial = this.sessionLastPresentedAt.get(skillId);
      const trialsSinceLastSeen =
        lastSessionTrial !== undefined
          ? this.sessionTrialCounter - lastSessionTrial
          : 999;

      const record = state.skills[skillId];
      const confusionRow = state.confusionMatrix[skillId] ?? {};
      const totalConfusions = Object.values(confusionRow).reduce(
        (sum, count) => sum + count,
        0
      );
      const confusionBoost = Math.min(4.0, totalConfusions * 0.75);

      let priority: number;
      if (trialsSinceLastSeen <= ARTS_SPACING_DELAY) {
        // Blocked by spacing delay D = 2
        priority = trialsSinceLastSeen - ARTS_SPACING_DELAY - 10;
      } else if (!record || record.attempts.length === 0) {
        // Unseen skill: introduce steadily, but behind due error/slow reviews (priority ~2.0)
        priority = 2.0 - index * 0.01 + confusionBoost;
      } else {
        const lastAttempt = record.attempts[record.attempts.length - 1];
        priority = computeArtsPriority({
          trialsSinceLastSeen,
          lastCorrect: lastAttempt.correct,
          lastAssisted: lastAttempt.assisted,
          lastResponseTimeMs: lastAttempt.responseTimeMs,
          fluencyThresholdMs: LANGUAGE_FLUENCY_THRESHOLD_MS,
          mastery: record.mastery,
          confusionBoost,
        });
      }

      return { lang, priority, trialsSinceLastSeen };
    });

    scored.sort((a, b) => {
      if (Math.abs(b.priority - a.priority) > 1e-6) {
        return b.priority - a.priority;
      }
      return b.trialsSinceLastSeen - a.trialsSinceLastSeen;
    });

    return scored[0].lang;
  }

  private selectFreshSample(language: LanguageSpec): LanguageSample {
    const seenInSession =
      this.sessionSeenSamplesByLang.get(language.id) ?? new Set<string>();
    const lastSampleId = this.lastSampleIdByLang.get(language.id);

    // Filter to samples not yet seen in the current cycle and not equal to the immediately previous sample
    let candidates = language.samples.filter(
      (s) => !seenInSession.has(s.id) && s.id !== lastSampleId
    );

    if (candidates.length === 0) {
      // Pool exhausted: reset cycle while strictly avoiding consecutive repeat of lastSampleId
      seenInSession.clear();
      candidates = language.samples.filter((s) => s.id !== lastSampleId);
      if (candidates.length === 0) {
        candidates = language.samples;
      }
    }

    const chosen = candidates[0];
    seenInSession.add(chosen.id);
    this.sessionSeenSamplesByLang.set(language.id, seenInSession);
    this.lastSampleIdByLang.set(language.id, chosen.id);
    return chosen;
  }

  private selectTellPrompt(
    language: LanguageSpec,
    sample: LanguageSample
  ): {
    tellId: string;
    pattern: string;
    label: string;
    script: string;
  } {
    const lastTellId = this.lastTellIdByLang.get(language.id);
    const matchingTell = language.tells.find(
      (t) => sample.tellIds.includes(t.id) && t.id !== lastTellId
    );
    const chosenTell =
      matchingTell ??
      language.tells.find((t) => t.id !== lastTellId) ??
      language.tells[0];
    this.lastTellIdByLang.set(language.id, chosenTell.id);

    return {
      tellId: chosenTell.id,
      pattern: chosenTell.pattern,
      label: chosenTell.label,
      script: language.script,
    };
  }

  private buildOptionsForLanguage(targetLanguage: LanguageSpec): TrialOption[] {
    // Always draw options from the target language's confusable Language Group (up to 6 options)
    const groupLanguages = getLanguagesForGroupSelection(targetLanguage.groupId);
    const others = groupLanguages.filter((l) => l.id !== targetLanguage.id);
    const selectedOthers = others.slice(0, 5);
    const combined = [targetLanguage, ...selectedOthers];

    // Sort deterministically by language ID so keyboard positions 1..6 stay stable and muscle-memory friendly within a group
    combined.sort((a, b) => {
      const groupOrder = LANGUAGE_GROUP_MAP[targetLanguage.groupId].languageIds;
      return groupOrder.indexOf(a.id) - groupOrder.indexOf(b.id);
    });

    const rngOffset = Math.floor(this.rng() * 0); // Keeps deterministic group ordering
    return combined.map((lang, idx) => ({
      id: `lang:${lang.id}`,
      languageId: lang.id,
      label: lang.name,
      sublabel: lang.nativeName,
      shortcutKey: idx + 1 + rngOffset,
    }));
  }
}
