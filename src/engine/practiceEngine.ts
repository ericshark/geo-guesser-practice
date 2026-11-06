import {
  COVERAGE_FOCUS_MAP,
  findTellMatchesInSample,
  getCandidateCountriesForLanguage,
  getCountriesForCoverageFocus,
  getLanguagesForGroupSelection,
  inferBestRegionPresetForCountries,
  LANGUAGE_GROUP_MAP,
  LANGUAGE_MAP,
  LANGUAGES,
  PLAYABLE_COUNTRIES,
  PLAYABLE_COUNTRY_MAP,
  type CoverageFocusId,
  type CoverageTier,
  type LanguageGroupId,
  type LanguageGroupSelectionId,
  type LanguageSample,
  type LanguageSpec,
  type MapRegionPresetId,
  type MasteryState,
  type PlayableCountry,
  type SectionId,
  type TellSpanMatch,
  type TellSpec,
} from '../data/index.ts';
import type { ProgressData, ProgressStore, SkillAttempt } from '../storage/index.ts';

export const LANGUAGE_FLUENCY_THRESHOLD_MS = 3500;
export const DRIVING_SIDE_FLUENCY_THRESHOLD_MS = 2500;
export const MAP_BRIDGE_FLUENCY_THRESHOLD_MS = 5000;
export const ARTS_SPACING_DELAY = 2;
export const GUIDED_BREAKDOWN_FOLLOW_UP_COUNT = 2;

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

export interface ConfusionPairSummary {
  expectedId: string;
  chosenId: string;
  expectedLabel: string;
  chosenLabel: string;
  groupId?: LanguageGroupId;
  groupName?: string;
  count: number;
}

export interface WeakSkillSummary {
  skillId: string;
  section: SectionId;
  label: string;
  sublabel: string;
  groupId?: LanguageGroupId;
  groupName?: string;
  mastery: MasteryState;
  accuracyPercent: number;
  averageRtMs: number;
  attemptsCount: number;
  assistedCount: number;
  confusionCount: number;
  weaknessScore: number;
}

export function resolveSkillDisplayInfo(skillId: string): {
  label: string;
  sublabel: string;
  groupId?: LanguageGroupId;
  groupName?: string;
} {
  if (skillId.startsWith('lang:')) {
    const langId = skillId.replace(/^lang:/, '');
    const lang = LANGUAGE_MAP[langId];
    if (lang) {
      const group = LANGUAGE_GROUP_MAP[lang.groupId];
      return {
        label: lang.name,
        sublabel: lang.nativeName,
        groupId: lang.groupId,
        groupName: group?.name,
      };
    }
  } else if (skillId.startsWith('drive:') || skillId.startsWith('cov:') || skillId.startsWith('domain:')) {
    const countryId = skillId.split(':')[1] ?? '';
    const country = PLAYABLE_COUNTRY_MAP[countryId];
    if (country) {
      return {
        label: country.name,
        sublabel: country.region,
      };
    }
  }
  return {
    label: skillId,
    sublabel: '',
  };
}

export function getTopConfusionPairs(
  progress: ProgressData,
  limit = 6
): ConfusionPairSummary[] {
  const pairs: ConfusionPairSummary[] = [];
  for (const [expectedId, targets] of Object.entries(progress.confusionMatrix)) {
    for (const [chosenId, count] of Object.entries(targets)) {
      if (count > 0) {
        const expInfo = resolveSkillDisplayInfo(expectedId);
        const choInfo = resolveSkillDisplayInfo(chosenId);
        pairs.push({
          expectedId,
          chosenId,
          expectedLabel: expInfo.label,
          chosenLabel: choInfo.label,
          groupId: expInfo.groupId ?? choInfo.groupId,
          groupName: expInfo.groupName ?? choInfo.groupName,
          count,
        });
      }
    }
  }
  pairs.sort((a, b) => b.count - a.count || a.expectedId.localeCompare(b.expectedId));
  return pairs.slice(0, limit);
}

export function getWeakestLearningSkills(
  progress: ProgressData,
  limit = 6
): WeakSkillSummary[] {
  const summaries: WeakSkillSummary[] = [];

  for (const [skillId, record] of Object.entries(progress.skills)) {
    if (record.attempts.length === 0) continue;
    // Focus on skills in 'learning' state (or any non-mastered skill with errors/confusions)
    if (record.mastery === 'mastered') continue;

    const recent5 = record.attempts.slice(-5);
    const unaidedCorrect = recent5.filter((a) => a.correct && !a.assisted).length;
    const accuracyPercent = Math.round((unaidedCorrect / recent5.length) * 100);
    const averageRtMs = Math.round(
      recent5.reduce((sum, a) => sum + a.responseTimeMs, 0) / recent5.length
    );
    const assistedCount = recent5.filter((a) => a.assisted).length;

    const outgoingConfusions = Object.values(
      progress.confusionMatrix[skillId] ?? {}
    ).reduce((sum, c) => sum + c, 0);
    let incomingConfusions = 0;
    for (const row of Object.values(progress.confusionMatrix)) {
      incomingConfusions += row[skillId] ?? 0;
    }
    const confusionCount = outgoingConfusions + incomingConfusions;

    const info = resolveSkillDisplayInfo(skillId);
    const learningBonus = record.mastery === 'learning' ? 100 : 20;
    const weaknessScore =
      learningBonus +
      (100 - accuracyPercent) * 0.6 +
      assistedCount * 12 +
      confusionCount * 15 +
      Math.min(30, Math.max(0, (averageRtMs - LANGUAGE_FLUENCY_THRESHOLD_MS) / 250));

    summaries.push({
      skillId,
      section: record.section,
      label: info.label,
      sublabel: info.sublabel,
      groupId: info.groupId,
      groupName: info.groupName,
      mastery: record.mastery,
      accuracyPercent,
      averageRtMs,
      attemptsCount: record.attempts.length,
      assistedCount,
      confusionCount,
      weaknessScore,
    });
  }

  summaries.sort((a, b) => b.weaknessScore - a.weaknessScore || a.skillId.localeCompare(b.skillId));
  return summaries.slice(0, limit);
}

export type LanguageDrillMode = 'mixed' | 'samples' | 'tells' | 'bridge';

export interface LanguageSessionConfig {
  groupId: LanguageGroupSelectionId;
  skipPrime?: boolean;
  drillMode?: LanguageDrillMode;
}

export type CoverageDrillMode =
  | 'mixed'
  | 'tier-speed'
  | 'regional-map'
  | 'neighbor-cluster';

export type CoverageMapTargetFilter = 'covered' | 'uncovered' | 'limited';

export interface CoverageSessionConfig {
  focusId: CoverageFocusId;
  drillMode?: CoverageDrillMode;
}

export interface RegionalCoverageNote {
  countryId: string;
  countryName: string;
  region: string;
  subregion: string;
  coverageTier: CoverageTier;
  coverageNote: string;
  isTrapCountry?: boolean;
}

export interface CoverageTrialPrompt {
  focusId: CoverageFocusId;
  focusLabel: string;
  drillKind: 'coverage-tier' | 'coverage-cluster' | 'coverage-map';
  targetCountry: PlayableCountry;
  promptTitle: string;
  promptDescription: string;
  suggestedRegionPreset: MapRegionPresetId;
  clusterName?: string;
  clusterCountries?: PlayableCountry[];
  targetTierQuestion?: CoverageTier;
  mapTargetFilter?: CoverageMapTargetFilter;
  mapRegionLabel?: string;
  regionPoolCountries?: PlayableCountry[];
  expectedCountryIds?: string[];
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

export type LanguageTrialKind =
  | 'sample-recognition'
  | 'tell-recognition'
  | 'triggered-contrast'
  | 'country-bridge'
  | 'coverage-tier'
  | 'coverage-cluster'
  | 'coverage-map';

export interface CountryBridgePrompt {
  languageId: string;
  languageName: string;
  nativeName: string;
  script: string;
  expectedCountryIds: string[];
  expectedCount: number;
  suggestedRegionPreset: MapRegionPresetId;
  matchedTells: TellSpanMatch[];
  uncoveredCountryNotes: string[];
}

export interface MapSelectionEvaluation {
  selectedCountryIds: string[];
  expectedCountryIds: string[];
  correctCountryIds: string[]; // emerald
  missedCountryIds: string[]; // amber
  incorrectCountryIds: string[]; // rose (including uncovered countries)
  incorrectUncoveredCountryIds: string[]; // subset of incorrectCountryIds with coverageTier === 'none'
  correctCountries: PlayableCountry[];
  missedCountries: PlayableCountry[];
  incorrectCountries: PlayableCountry[];
  uncoveredCountryNotes: string[];
  perfect: boolean;
}

export interface TriggeredContrastSide {
  skillId: string;
  languageId: string;
  name: string;
  nativeName: string;
  script: string;
  sample: LanguageSample;
  matchedTells: TellSpanMatch[];
  tells: TellSpec[];
  contrastNote: string;
  gestaltNote: string;
  candidateCountries: PlayableCountry[];
}

export interface TriggeredContrastCard {
  pairKey: string;
  expectedSkillId: string;
  confusedWithSkillId: string;
  confusionCount: number;
  leftSide: TriggeredContrastSide;
  rightSide: TriggeredContrastSide;
}

export interface DistractorElimination {
  optionId: string;
  languageId: string;
  languageName: string;
  nativeName: string;
  reason: string;
  expectedTellsMissing: Array<{ pattern: string; label: string }>;
}

export interface GuidedBreakdown {
  skillId: string;
  languageId: string;
  languageName: string;
  nativeName: string;
  script: string;
  sample: LanguageSample;
  translation: string;
  matchedTells: TellSpanMatch[];
  structuralClue?: string;
  gestaltNote: string;
  contrastNote: string;
  distractorEliminations: DistractorElimination[];
  candidateCountries: PlayableCountry[];
  uncoveredCountryNotes: string[];
  countryId?: string;
  country?: PlayableCountry;
  coverageTier?: CoverageTier;
  coverageNote?: string;
  regionalLimitedNotes?: RegionalCoverageNote[];
  assisted: true;
  queuedFollowUps: number;
}

export interface PracticeTrial {
  trialNumber: number;
  section?: SectionId;
  kind: LanguageTrialKind;
  skillId: string; // e.g., 'lang:cs' or 'cov:ng'
  contrastedSkillId?: string; // e.g., 'lang:sk' when kind === 'triggered-contrast'
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
  triggeredContrast?: TriggeredContrastCard;
  bridgePrompt?: CountryBridgePrompt;
  countryId?: string;
  country?: PlayableCountry;
  coveragePrompt?: CoverageTrialPrompt;
  assisted?: boolean;
  isFollowUp?: boolean;
  options: TrialOption[];
  startedAtMs: number;
}

export interface ChosenLanguageContrast {
  languageId: string;
  languageName: string;
  contrastNote: string;
  keyTells: Array<{ pattern: string; label: string }>;
}

export interface CoverageTrialFeedback {
  correct: boolean;
  assisted: boolean;
  skillId: string; // 'cov:<countryId>'
  countryId: string;
  countryName: string;
  country: PlayableCountry;
  coverageTier: CoverageTier;
  coverageNote: string;
  chosenOptionId: string;
  chosenLabel: string;
  responseTimeMs: number;
  fluencyTargetMs: number;
  isFluentSpeed: boolean;
  previousMastery: MasteryState;
  newMastery: MasteryState;
  mapHighlightedCountryIds: string[];
  regionalLimitedNotes: RegionalCoverageNote[];
  trapCountryNotes: RegionalCoverageNote[];
  mapEvaluation?: MapSelectionEvaluation;
}

export interface LanguageTrialFeedback {
  correct: boolean;
  assisted: boolean;
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
  triggeredContrastQueued?: boolean;
  bridgeQueued?: boolean;
  mapEvaluation?: MapSelectionEvaluation;
  countryId?: string;
  country?: PlayableCountry;
  coverageTier?: CoverageTier;
  coverageNote?: string;
  regionalLimitedNotes?: RegionalCoverageNote[];
  trapCountryNotes?: RegionalCoverageNote[];
  mapHighlightedCountryIds?: string[];
  coverageFeedback?: CoverageTrialFeedback;
}

export interface SessionStats {
  trialsCompleted: number;
  correctCount: number;
  fluentCount: number;
  averageResponseTimeMs: number;
}

interface FollowUpQueueItem {
  skillId: string;
  languageId: string;
  preferredTellId?: string;
  queuedAtTrial: number;
}

interface PendingContrastItem {
  pairKey: string;
  expectedSkillId: string;
  confusedWithSkillId: string;
  confusionCount: number;
}

export function evaluateCountryBridgeSelection(
  language: LanguageSpec,
  selectedCountryIds: string[]
): MapSelectionEvaluation {
  const candidateCountries = getCandidateCountriesForLanguage(language);
  const expectedSet = new Set(candidateCountries.map((c) => c.id));
  const uniqueSelected = Array.from(
    new Set(selectedCountryIds.map((id) => id.trim().toLowerCase()).filter(Boolean))
  );
  const selectedSet = new Set(uniqueSelected);

  const correctCountryIds = uniqueSelected.filter((id) => expectedSet.has(id));
  const missedCountryIds = Array.from(expectedSet).filter((id) => !selectedSet.has(id));
  const incorrectCountryIds = uniqueSelected.filter((id) => !expectedSet.has(id));
  const incorrectUncoveredCountryIds = incorrectCountryIds.filter(
    (id) => PLAYABLE_COUNTRY_MAP[id]?.coverageTier === 'none'
  );

  const toCountries = (ids: string[]): PlayableCountry[] =>
    ids
      .map((id) => PLAYABLE_COUNTRY_MAP[id])
      .filter((c): c is PlayableCountry => Boolean(c));

  return {
    selectedCountryIds: uniqueSelected,
    expectedCountryIds: Array.from(expectedSet),
    correctCountryIds,
    missedCountryIds,
    incorrectCountryIds,
    incorrectUncoveredCountryIds,
    correctCountries: toCountries(correctCountryIds),
    missedCountries: toCountries(missedCountryIds),
    incorrectCountries: toCountries(incorrectCountryIds),
    uncoveredCountryNotes: language.uncoveredCountryNotes,
    perfect: missedCountryIds.length === 0 && incorrectCountryIds.length === 0,
  };
}

export function evaluateCoverageMapSelection(
  expectedCountryIds: string[],
  selectedCountryIds: string[],
  regionPoolCountries?: PlayableCountry[]
): MapSelectionEvaluation {
  const normalizedExpected = Array.from(
    new Set(expectedCountryIds.map((id) => id.trim().toLowerCase()).filter(Boolean))
  );
  const expectedSet = new Set(normalizedExpected);
  const uniqueSelected = Array.from(
    new Set(selectedCountryIds.map((id) => id.trim().toLowerCase()).filter(Boolean))
  );
  const selectedSet = new Set(uniqueSelected);

  const correctCountryIds = uniqueSelected.filter((id) => expectedSet.has(id));
  const missedCountryIds = normalizedExpected.filter((id) => !selectedSet.has(id));
  const incorrectCountryIds = uniqueSelected.filter((id) => !expectedSet.has(id));
  const incorrectUncoveredCountryIds = incorrectCountryIds.filter(
    (id) => PLAYABLE_COUNTRY_MAP[id]?.coverageTier === 'none'
  );

  const toCountries = (ids: string[]): PlayableCountry[] =>
    ids
      .map((id) => PLAYABLE_COUNTRY_MAP[id])
      .filter((c): c is PlayableCountry => Boolean(c));

  const poolForNotes =
    regionPoolCountries ??
    toCountries([...normalizedExpected, ...incorrectCountryIds]);

  const uncoveredCountryNotes = poolForNotes
    .filter((c) => c.coverageTier === 'none' || c.isTrapCountry)
    .slice(0, 6)
    .map((c) => `${c.name}: ${c.coverageNote}`);

  return {
    selectedCountryIds: uniqueSelected,
    expectedCountryIds: normalizedExpected,
    correctCountryIds,
    missedCountryIds,
    incorrectCountryIds,
    incorrectUncoveredCountryIds,
    correctCountries: toCountries(correctCountryIds),
    missedCountries: toCountries(missedCountryIds),
    incorrectCountries: toCountries(incorrectCountryIds),
    uncoveredCountryNotes,
    perfect: missedCountryIds.length === 0 && incorrectCountryIds.length === 0,
  };
}

function toRegionalCoverageNote(country: PlayableCountry): RegionalCoverageNote {
  return {
    countryId: country.id,
    countryName: country.name,
    region: country.region,
    subregion: country.subregion,
    coverageTier: country.coverageTier,
    coverageNote: country.coverageNote,
    isTrapCountry: country.isTrapCountry,
  };
}

export class PracticeEngine {
  private store: ProgressStore;
  private now: () => number;
  private rng: () => number;

  private activeSection: SectionId = 'languages';
  private activeGroupSelection: LanguageGroupSelectionId = 'east-asian';
  private drillMode: LanguageDrillMode = 'mixed';
  private activeCoverageFocus: CoverageFocusId = 'world';
  private coverageDrillMode: CoverageDrillMode = 'mixed';
  private stage0Prime: ContrastCardPrime | null = null;
  private currentTrial: PracticeTrial | null = null;
  private currentTrialAssisted = false;
  private activeGuidedBreakdown: GuidedBreakdown | null = null;
  private lastFeedback: LanguageTrialFeedback | null = null;
  private lastCoverageFeedback: CoverageTrialFeedback | null = null;

  private sessionTrialCounter = 0;
  private sessionLastPresentedAt = new Map<string, number>();
  private sessionSeenSamplesByLang = new Map<string, Set<string>>();
  private lastSampleIdByLang = new Map<string, string>();
  private lastTellIdByLang = new Map<string, string>();

  private followUpQueue: FollowUpQueueItem[] = [];
  private pendingContrastQueue: PendingContrastItem[] = [];
  private pendingBridgeQueue: string[] = []; // languageIds queued for Stage 3 Language -> Country Bridge
  private sessionBridgedLangs = new Set<string>();
  private pairConfusionsSinceTrigger = new Map<string, number>();
  private sessionPairBoostBySkill = new Map<string, number>();

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
    this.activeSection = 'languages';
    this.activeGroupSelection = config.groupId;
    this.drillMode = config.drillMode ?? 'mixed';
    this.sessionTrialCounter = 0;
    this.sessionLastPresentedAt.clear();
    this.sessionSeenSamplesByLang.clear();
    this.lastSampleIdByLang.clear();
    this.lastTellIdByLang.clear();
    this.followUpQueue = [];
    this.pendingContrastQueue = [];
    this.pendingBridgeQueue = [];
    this.sessionBridgedLangs.clear();
    this.pairConfusionsSinceTrigger.clear();
    this.sessionPairBoostBySkill.clear();
    this.currentTrial = null;
    this.currentTrialAssisted = false;
    this.activeGuidedBreakdown = null;
    this.lastFeedback = null;
    this.lastCoverageFeedback = null;
    this.sessionStats = {
      trialsCompleted: 0,
      correctCount: 0,
      fluentCount: 0,
      averageResponseTimeMs: 0,
    };

    if (
      config.groupId !== 'all-mixed' &&
      config.groupId !== 'smart-weakest' &&
      !config.skipPrime
    ) {
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

  startSmartPracticeSession(drillMode: LanguageDrillMode = 'mixed'): PracticeTrial {
    this.startLanguageSession({
      groupId: 'smart-weakest',
      skipPrime: true,
      drillMode,
    });
    return this.currentTrial!;
  }

  startCoverageSession(config: CoverageSessionConfig): PracticeTrial {
    this.activeSection = 'coverage';
    this.activeCoverageFocus = config.focusId;
    this.coverageDrillMode = config.drillMode ?? 'mixed';
    this.stage0Prime = null;
    this.sessionTrialCounter = 0;
    this.sessionLastPresentedAt.clear();
    this.followUpQueue = [];
    this.pendingContrastQueue = [];
    this.pendingBridgeQueue = [];
    this.sessionBridgedLangs.clear();
    this.pairConfusionsSinceTrigger.clear();
    this.sessionPairBoostBySkill.clear();
    this.currentTrial = null;
    this.currentTrialAssisted = false;
    this.activeGuidedBreakdown = null;
    this.lastFeedback = null;
    this.lastCoverageFeedback = null;
    this.sessionStats = {
      trialsCompleted: 0,
      correctCount: 0,
      fluentCount: 0,
      averageResponseTimeMs: 0,
    };
    return this.nextTrial();
  }

  getActiveSection(): SectionId {
    return this.activeSection;
  }

  getActiveCoverageFocus(): CoverageFocusId {
    return this.activeCoverageFocus;
  }

  getCoverageDrillMode(): CoverageDrillMode {
    return this.coverageDrillMode;
  }

  getLastCoverageFeedback(): CoverageTrialFeedback | null {
    return this.lastCoverageFeedback;
  }

  getActiveGroupSelection(): LanguageGroupSelectionId {
    return this.activeGroupSelection;
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

  getActiveGuidedBreakdown(): GuidedBreakdown | null {
    return this.activeGuidedBreakdown;
  }

  dismissGuidedBreakdown(): void {
    this.activeGuidedBreakdown = null;
  }

  getQueuedFollowUpCount(skillId?: string): number {
    if (!skillId) {
      return this.followUpQueue.length;
    }
    return this.followUpQueue.filter((item) => item.skillId === skillId).length;
  }

  getConfusionMatrix(): Record<string, Record<string, number>> {
    return this.store.getState().confusionMatrix;
  }

  getConfusionCount(expectedSkillId: string, chosenSkillId: string): number {
    return this.store.getState().confusionMatrix[expectedSkillId]?.[chosenSkillId] ?? 0;
  }

  getLastFeedback(): LanguageTrialFeedback | null {
    return this.lastFeedback;
  }

  getSessionStats(): SessionStats {
    return { ...this.sessionStats };
  }

  /**
   * Opens the on-demand Guided Breakdown ("Show me what to look for") for the active trial:
   * - Highlights the specific Tells (or structural/gestalt clues) on the current prompt
   * - Explains why each distractor option is ruled out
   * - Marks the trial as `assisted: true` (preventing false promotion to Mastered)
   * - Queues 2 follow-up trials for that skill/Tell after the minimum spacing delay D = 2
   */
  requestGuidedBreakdown(): GuidedBreakdown {
    const trial = this.currentTrial;
    if (!trial) {
      throw new Error('No active trial to request a Guided Breakdown for.');
    }

    if (this.activeGuidedBreakdown) {
      return this.activeGuidedBreakdown;
    }

    this.currentTrialAssisted = true;
    trial.assisted = true;

    if (
      trial.section === 'coverage' ||
      trial.kind === 'coverage-tier' ||
      trial.kind === 'coverage-cluster' ||
      trial.kind === 'coverage-map'
    ) {
      return this.buildCoverageGuidedBreakdown(trial);
    }

    const targetLanguage = LANGUAGE_MAP[trial.languageId];
    const matchedTells = findTellMatchesInSample(trial.sample, targetLanguage);
    const candidateCountries = getCandidateCountriesForLanguage(targetLanguage);

    const distractorEliminations: DistractorElimination[] = trial.options
      .filter((opt) => opt.id !== trial.skillId)
      .map((opt) => {
        const distLang = LANGUAGE_MAP[opt.languageId];
        if (!distLang) {
          return {
            optionId: opt.id,
            languageId: opt.languageId,
            languageName: opt.label,
            nativeName: opt.sublabel,
            reason: `Does not match the diagnostic features of ${targetLanguage.name}.`,
            expectedTellsMissing: [],
          };
        }

        const expectedTellsMissing = distLang.tells.slice(0, 2).map((t) => ({
          pattern: t.pattern,
          label: t.label,
        }));

        const targetCueSummary =
          matchedTells.length > 0
            ? matchedTells.map((m) => `${m.pattern} (${m.label})`).join(', ')
            : trial.sample.structuralClue ?? targetLanguage.gestaltNote;

        const missingSummary = expectedTellsMissing
          .map((t) => `${t.pattern} (${t.label})`)
          .join(' or ');

        const reason =
          matchedTells.length > 0
            ? `Ruled out: this prompt contains ${targetCueSummary} pointing to ${targetLanguage.name}, and lacks ${distLang.name} markers such as ${missingSummary}. ${distLang.contrastNote}`
            : `Ruled out: ${distLang.name} typically shows ${missingSummary}. ${distLang.contrastNote} Here, use ${targetLanguage.name}'s structural cue (${targetCueSummary}).`;

        return {
          optionId: opt.id,
          languageId: distLang.id,
          languageName: distLang.name,
          nativeName: distLang.nativeName,
          reason,
          expectedTellsMissing,
        };
      });

    const preferredTellId =
      trial.tellPrompt?.tellId ?? matchedTells[0]?.tellId ?? targetLanguage.tells[0]?.id;

    // Queue 2 follow-up trials for this skill/Tell (capped at 3 queued for the same skill)
    const existingQueuedForSkill = this.followUpQueue.filter(
      (q) => q.skillId === trial.skillId
    ).length;
    const toEnqueue = Math.max(
      0,
      Math.min(GUIDED_BREAKDOWN_FOLLOW_UP_COUNT, 3 - existingQueuedForSkill)
    );

    for (let i = 0; i < toEnqueue; i++) {
      this.followUpQueue.push({
        skillId: trial.skillId,
        languageId: targetLanguage.id,
        preferredTellId,
        queuedAtTrial: this.sessionTrialCounter,
      });
    }

    const breakdown: GuidedBreakdown = {
      skillId: trial.skillId,
      languageId: targetLanguage.id,
      languageName: targetLanguage.name,
      nativeName: targetLanguage.nativeName,
      script: targetLanguage.script,
      sample: trial.sample,
      translation: trial.sample.translation,
      matchedTells,
      structuralClue: trial.sample.structuralClue,
      gestaltNote: targetLanguage.gestaltNote,
      contrastNote: targetLanguage.contrastNote,
      distractorEliminations,
      candidateCountries,
      uncoveredCountryNotes: targetLanguage.uncoveredCountryNotes,
      assisted: true,
      queuedFollowUps: this.getQueuedFollowUpCount(trial.skillId),
    };

    this.activeGuidedBreakdown = breakdown;
    return breakdown;
  }

  nextTrial(): PracticeTrial {
    this.sessionTrialCounter += 1;
    this.lastFeedback = null;
    this.lastCoverageFeedback = null;
    this.currentTrialAssisted = false;
    this.activeGuidedBreakdown = null;

    if (this.activeSection === 'coverage') {
      return this.nextCoverageTrial();
    }

    // 1. Check if a Stage 2 Triggered Contrast Card is pending
    if (this.pendingContrastQueue.length > 0) {
      const pending = this.pendingContrastQueue.shift()!;
      this.currentTrial = this.buildTriggeredContrastTrial(pending);
      return this.currentTrial;
    }

    // 2. Check if a Stage 3 Language -> Country Bridge trial is pending
    if (
      (this.drillMode === 'mixed' || this.drillMode === 'bridge') &&
      this.pendingBridgeQueue.length > 0
    ) {
      const langId = this.pendingBridgeQueue.shift()!;
      const langSpec = LANGUAGE_MAP[langId];
      if (langSpec) {
        this.sessionBridgedLangs.add(langId);
        this.currentTrial = this.buildCountryBridgeTrial(langSpec);
        return this.currentTrial;
      }
    }

    // 3. Check if any Guided Breakdown follow-up item has satisfied the D = 2 spacing delay
    const eligibleFollowUpIdx = this.followUpQueue.findIndex((item) => {
      const lastSeen = this.sessionLastPresentedAt.get(item.skillId);
      const trialsSinceLastSeen =
        lastSeen !== undefined ? this.sessionTrialCounter - lastSeen : 999;
      return trialsSinceLastSeen > ARTS_SPACING_DELAY;
    });

    let chosenLanguage: LanguageSpec;
    let preferredTellId: string | undefined;
    let isFollowUp = false;

    if (eligibleFollowUpIdx !== -1) {
      const followUp = this.followUpQueue.splice(eligibleFollowUpIdx, 1)[0];
      chosenLanguage = LANGUAGE_MAP[followUp.languageId];
      preferredTellId = followUp.preferredTellId;
      isFollowUp = true;
    } else {
      const pool = this.getActiveLanguagePool();
      chosenLanguage = this.selectNextLanguageByArts(pool);
    }

    const skillId = `lang:${chosenLanguage.id}`;
    this.sessionLastPresentedAt.set(skillId, this.sessionTrialCounter);

    const state = this.store.getState();
    const currentMastery = state.skills[skillId]?.mastery ?? 'unseen';
    const isFluentOrRecognized =
      currentMastery === 'recognized' || currentMastery === 'mastered';

    if (
      this.drillMode === 'bridge' ||
      (this.drillMode === 'mixed' &&
        !isFollowUp &&
        isFluentOrRecognized &&
        (!this.sessionBridgedLangs.has(chosenLanguage.id) ||
          this.sessionTrialCounter % 3 === 0))
    ) {
      this.sessionBridgedLangs.add(chosenLanguage.id);
      this.currentTrial = this.buildCountryBridgeTrial(chosenLanguage);
      return this.currentTrial;
    }

    const trialKind: LanguageTrialKind =
      this.drillMode === 'tells'
        ? 'tell-recognition'
        : this.drillMode === 'samples'
          ? 'sample-recognition'
          : this.sessionTrialCounter % 4 === 0
            ? 'tell-recognition'
            : 'sample-recognition';

    const sample = this.selectFreshSample(chosenLanguage, preferredTellId);
    const tellPrompt =
      trialKind === 'tell-recognition'
        ? this.selectTellPrompt(chosenLanguage, sample, preferredTellId)
        : undefined;

    const options = this.buildOptionsForLanguage(chosenLanguage);
    const groupSpec = LANGUAGE_GROUP_MAP[chosenLanguage.groupId];

    const groupName =
      this.activeGroupSelection === 'smart-weakest'
        ? `Smart Practice · Weakest Spots (${groupSpec.name})`
        : this.activeGroupSelection === 'all-mixed'
          ? `All-Groups Mixed (${groupSpec.name})`
          : groupSpec.name;

    this.currentTrial = {
      trialNumber: this.sessionTrialCounter,
      kind: trialKind,
      skillId,
      languageId: chosenLanguage.id,
      groupName,
      fluencyThresholdMs: LANGUAGE_FLUENCY_THRESHOLD_MS,
      sample,
      tellPrompt,
      assisted: false,
      isFollowUp,
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

    if (trial.kind === 'country-bridge') {
      const parsedIds = chosenOptionId
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return this.submitCountryBridgeAnswer(parsedIds, explicitResponseTimeMs);
    }

    if (trial.kind === 'coverage-map') {
      const parsedIds = chosenOptionId
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const covFeedback = await this.submitCoverageMapAnswer(
        parsedIds,
        explicitResponseTimeMs
      );
      return this.lastFeedback!;
    }

    if (
      trial.section === 'coverage' ||
      trial.kind === 'coverage-tier' ||
      trial.kind === 'coverage-cluster'
    ) {
      await this.submitCoverageAnswer(chosenOptionId, explicitResponseTimeMs);
      return this.lastFeedback!;
    }

    const responseTimeMs =
      explicitResponseTimeMs ?? Math.max(100, this.now() - trial.startedAtMs);
    const correct = chosenOptionId === trial.skillId;
    const assisted =
      this.currentTrialAssisted ||
      Boolean(trial.assisted) ||
      trial.kind === 'triggered-contrast';

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
        assisted,
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
      if (!assisted && responseTimeMs <= trial.fluencyThresholdMs) {
        this.sessionStats.fluentCount += 1;
      }
    }
    this.sessionStats.averageResponseTimeMs = Math.round(
      (prevTotalRt + responseTimeMs) / this.sessionStats.trialsCompleted
    );

    await this.store.recordAttempt({
      section: 'languages',
      skillId: trial.skillId,
      chosenSkillId: chosenOptionId,
      sampleId: trial.sample.id,
      correct,
      responseTimeMs,
      assisted,
      mastery: newMastery,
      trialIndex: this.sessionTrialCounter,
      now: new Date(this.now()),
    });

    // When a language newly reaches recognized or mastered (or is practiced in recognized/mastered without having done a bridge trial yet in this session), queue Stage 3 Language -> Country Bridge
    let bridgeQueued = false;
    if (
      (this.drillMode === 'mixed' || this.drillMode === 'bridge') &&
      correct &&
      !assisted &&
      (newMastery === 'recognized' || newMastery === 'mastered') &&
      !this.sessionBridgedLangs.has(targetLanguage.id) &&
      !this.pendingBridgeQueue.includes(targetLanguage.id)
    ) {
      this.pendingBridgeQueue.push(targetLanguage.id);
      bridgeQueued = true;
    }

    // Check if this error triggers a Stage 2 Contrast Card for (trial.skillId, chosenOptionId)
    let triggeredContrastQueued = false;
    if (
      !correct &&
      trial.kind !== 'triggered-contrast' &&
      chosenOptionId !== trial.skillId &&
      chosenLanguage
    ) {
      const pairKey = [trial.skillId, chosenOptionId].sort().join('<->');
      const nextCount = (this.pairConfusionsSinceTrigger.get(pairKey) ?? 0) + 1;
      this.pairConfusionsSinceTrigger.set(pairKey, nextCount);

      // Boost priority immediately on any confusion, and trigger Stage 2 Contrast Card on 2nd confusion
      this.sessionPairBoostBySkill.set(
        trial.skillId,
        Math.max(4.0, (this.sessionPairBoostBySkill.get(trial.skillId) ?? 0) + 4.0)
      );
      this.sessionPairBoostBySkill.set(
        chosenOptionId,
        Math.max(4.0, (this.sessionPairBoostBySkill.get(chosenOptionId) ?? 0) + 4.0)
      );

      if (nextCount >= 2) {
        this.pairConfusionsSinceTrigger.set(pairKey, 0);
        // Strong symmetric boost for both Skill A and Skill B following the Contrast Card
        this.sessionPairBoostBySkill.set(trial.skillId, 16.0);
        this.sessionPairBoostBySkill.set(chosenOptionId, 16.0);

        const totalPairConfusions =
          this.getConfusionCount(trial.skillId, chosenOptionId) +
          this.getConfusionCount(chosenOptionId, trial.skillId);

        this.pendingContrastQueue.push({
          pairKey,
          expectedSkillId: trial.skillId,
          confusedWithSkillId: chosenOptionId,
          confusionCount: Math.max(2, totalPairConfusions),
        });
        triggeredContrastQueued = true;
      }
    }

    const feedback: LanguageTrialFeedback = {
      correct,
      assisted,
      skillId: trial.skillId,
      languageId: targetLanguage.id,
      languageName: targetLanguage.name,
      nativeName: targetLanguage.nativeName,
      chosenOptionId,
      chosenLanguageName: chosenLanguage?.name ?? chosenOptionId,
      responseTimeMs,
      fluencyTargetMs: trial.fluencyThresholdMs,
      isFluentSpeed: correct && !assisted && responseTimeMs <= trial.fluencyThresholdMs,
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
      triggeredContrastQueued,
      bridgeQueued,
    };

    this.lastFeedback = feedback;
    return feedback;
  }

  /**
   * Validates a multi-country map selection for a Stage 3 Language -> Country Bridge trial.
   * Marks correct selections (emerald), missed Candidate Countries (amber), and incorrect clicks
   * including uncovered countries (rose), while returning informational footnotes for uncovered countries.
   */
  async submitCountryBridgeAnswer(
    selectedCountryIds: string[],
    explicitResponseTimeMs?: number
  ): Promise<LanguageTrialFeedback> {
    const trial = this.currentTrial;
    if (!trial || trial.kind !== 'country-bridge') {
      throw new Error('No active Stage 3 Country Bridge trial to submit map selections for.');
    }

    const responseTimeMs =
      explicitResponseTimeMs ?? Math.max(100, this.now() - trial.startedAtMs);
    const targetLanguage = LANGUAGE_MAP[trial.languageId];
    const mapEvaluation = evaluateCountryBridgeSelection(
      targetLanguage,
      selectedCountryIds
    );
    const correct = mapEvaluation.perfect;
    const assisted = this.currentTrialAssisted || Boolean(trial.assisted);

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
        assisted,
        chosenSkillId: `map:${mapEvaluation.selectedCountryIds.join(',')}`,
        sampleId: trial.sample.id,
      },
    ];

    const newMastery = calculateMasteryState(
      simulatedAttempts,
      trial.fluencyThresholdMs
    );

    const prevTotalRt =
      this.sessionStats.averageResponseTimeMs * this.sessionStats.trialsCompleted;
    this.sessionStats.trialsCompleted += 1;
    if (correct) {
      this.sessionStats.correctCount += 1;
      if (!assisted && responseTimeMs <= trial.fluencyThresholdMs) {
        this.sessionStats.fluentCount += 1;
      }
    }
    this.sessionStats.averageResponseTimeMs = Math.round(
      (prevTotalRt + responseTimeMs) / this.sessionStats.trialsCompleted
    );

    await this.store.recordAttempt({
      section: 'languages',
      skillId: trial.skillId,
      chosenSkillId: correct
        ? trial.skillId
        : `map:${mapEvaluation.selectedCountryIds.join(',') || 'none'}`,
      sampleId: trial.sample.id,
      correct,
      responseTimeMs,
      assisted,
      mastery: newMastery,
      trialIndex: this.sessionTrialCounter,
      now: new Date(this.now()),
    });

    const matchedTells = findTellMatchesInSample(trial.sample, targetLanguage);
    const candidateCountries = getCandidateCountriesForLanguage(targetLanguage);

    const feedback: LanguageTrialFeedback = {
      correct,
      assisted,
      skillId: trial.skillId,
      languageId: targetLanguage.id,
      languageName: targetLanguage.name,
      nativeName: targetLanguage.nativeName,
      chosenOptionId: mapEvaluation.selectedCountryIds.join(','),
      chosenLanguageName:
        mapEvaluation.selectedCountryIds.length > 0
          ? mapEvaluation.selectedCountryIds
              .map((id) => PLAYABLE_COUNTRY_MAP[id]?.name ?? id)
              .join(', ')
          : 'None selected',
      responseTimeMs,
      fluencyTargetMs: trial.fluencyThresholdMs,
      isFluentSpeed: correct && !assisted && responseTimeMs <= trial.fluencyThresholdMs,
      previousMastery,
      newMastery,
      sample: trial.sample,
      translation: trial.sample.translation,
      matchedTells,
      structuralClue: trial.sample.structuralClue,
      gestaltNote: targetLanguage.gestaltNote,
      contrastNote: targetLanguage.contrastNote,
      candidateCountries,
      uncoveredCountryNotes: targetLanguage.uncoveredCountryNotes,
      mapEvaluation,
    };

    this.lastFeedback = feedback;
    return feedback;
  }

  private buildCountryBridgeTrial(language: LanguageSpec): PracticeTrial {
    const skillId = `lang:${language.id}`;
    const sample = this.selectFreshSample(language);
    const candidateCountries = getCandidateCountriesForLanguage(language);
    const suggestedRegionPreset = inferBestRegionPresetForCountries(candidateCountries);
    const groupSpec = LANGUAGE_GROUP_MAP[language.groupId];

    return {
      trialNumber: this.sessionTrialCounter,
      kind: 'country-bridge',
      skillId,
      languageId: language.id,
      groupName: `${groupSpec.name} · Stage 3 Language → Country Bridge`,
      fluencyThresholdMs: MAP_BRIDGE_FLUENCY_THRESHOLD_MS,
      sample,
      bridgePrompt: {
        languageId: language.id,
        languageName: language.name,
        nativeName: language.nativeName,
        script: language.script,
        expectedCountryIds: candidateCountries.map((c) => c.id),
        expectedCount: candidateCountries.length,
        suggestedRegionPreset,
        matchedTells: findTellMatchesInSample(sample, language),
        uncoveredCountryNotes: language.uncoveredCountryNotes,
      },
      assisted: false,
      options: [],
      startedAtMs: this.now(),
    };
  }

  private buildTriggeredContrastTrial(pending: PendingContrastItem): PracticeTrial {
    const langAId = pending.expectedSkillId.replace(/^lang:/, '');
    const langBId = pending.confusedWithSkillId.replace(/^lang:/, '');
    const langA = LANGUAGE_MAP[langAId];
    const langB = LANGUAGE_MAP[langBId];

    const sampleA = this.selectFreshSample(langA);
    const sampleB = this.selectFreshSample(langB);

    const sideA: TriggeredContrastSide = {
      skillId: pending.expectedSkillId,
      languageId: langA.id,
      name: langA.name,
      nativeName: langA.nativeName,
      script: langA.script,
      sample: sampleA,
      matchedTells: findTellMatchesInSample(sampleA, langA),
      tells: langA.tells,
      contrastNote: langA.contrastNote,
      gestaltNote: langA.gestaltNote,
      candidateCountries: getCandidateCountriesForLanguage(langA),
    };

    const sideB: TriggeredContrastSide = {
      skillId: pending.confusedWithSkillId,
      languageId: langB.id,
      name: langB.name,
      nativeName: langB.nativeName,
      script: langB.script,
      sample: sampleB,
      matchedTells: findTellMatchesInSample(sampleB, langB),
      tells: langB.tells,
      contrastNote: langB.contrastNote,
      gestaltNote: langB.gestaltNote,
      candidateCountries: getCandidateCountriesForLanguage(langB),
    };

    const groupSpec = LANGUAGE_GROUP_MAP[langA.groupId];

    const options: TrialOption[] = [
      {
        id: pending.expectedSkillId,
        languageId: langA.id,
        label: `Left: ${langA.name} · Right: ${langB.name}`,
        sublabel: `${langA.nativeName} vs ${langB.nativeName}`,
        shortcutKey: 1,
      },
      {
        id: pending.confusedWithSkillId,
        languageId: langB.id,
        label: `Left: ${langB.name} · Right: ${langA.name}`,
        sublabel: `${langB.nativeName} vs ${langA.nativeName}`,
        shortcutKey: 2,
      },
    ];

    return {
      trialNumber: this.sessionTrialCounter,
      kind: 'triggered-contrast',
      skillId: pending.expectedSkillId,
      contrastedSkillId: pending.confusedWithSkillId,
      languageId: langA.id,
      groupName: `${groupSpec.name} · Stage 2 Triggered Contrast`,
      fluencyThresholdMs: LANGUAGE_FLUENCY_THRESHOLD_MS,
      sample: sampleA,
      triggeredContrast: {
        pairKey: pending.pairKey,
        expectedSkillId: pending.expectedSkillId,
        confusedWithSkillId: pending.confusedWithSkillId,
        confusionCount: pending.confusionCount,
        leftSide: sideA,
        rightSide: sideB,
      },
      assisted: true,
      options,
      startedAtMs: this.now(),
    };
  }

  private getActiveLanguagePool(): LanguageSpec[] {
    if (this.activeGroupSelection !== 'smart-weakest') {
      return getLanguagesForGroupSelection(this.activeGroupSelection);
    }

    const state = this.store.getState();
    const targetIds = new Set<string>();

    // 1. All languages currently in 'learning' Mastery State
    for (const [skillId, record] of Object.entries(state.skills)) {
      if (skillId.startsWith('lang:') && record.mastery === 'learning') {
        const langId = skillId.replace(/^lang:/, '');
        if (LANGUAGE_MAP[langId]) {
          targetIds.add(langId);
        }
      }
    }

    // 2. All languages involved in recorded confusion pairs (both expected and chosen)
    for (const [expectedId, targets] of Object.entries(state.confusionMatrix)) {
      for (const [chosenId, count] of Object.entries(targets)) {
        if (count > 0) {
          const expLang = expectedId.replace(/^lang:/, '');
          const choLang = chosenId.replace(/^lang:/, '');
          if (LANGUAGE_MAP[expLang]) targetIds.add(expLang);
          if (LANGUAGE_MAP[choLang]) targetIds.add(choLang);
        }
      }
    }

    if (targetIds.size === 0) {
      return LANGUAGES;
    }

    // Ensure at least 4 skills in the rotation so ARTS spacing delay D = 2 is always satisfiable
    if (targetIds.size < 4) {
      const primaryGroups = new Set<LanguageGroupId>();
      for (const langId of targetIds) {
        const spec = LANGUAGE_MAP[langId];
        if (spec) primaryGroups.add(spec.groupId);
      }
      for (const groupId of primaryGroups) {
        for (const peerId of LANGUAGE_GROUP_MAP[groupId].languageIds) {
          if (targetIds.size >= 4) break;
          targetIds.add(peerId);
        }
      }
    }

    return Array.from(targetIds)
      .map((id) => LANGUAGE_MAP[id])
      .filter((l): l is LanguageSpec => Boolean(l));
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
      const outgoingConfusions = Object.values(
        state.confusionMatrix[skillId] ?? {}
      ).reduce((sum, count) => sum + count, 0);
      let incomingConfusions = 0;
      for (const row of Object.values(state.confusionMatrix)) {
        incomingConfusions += row[skillId] ?? 0;
      }
      const totalConfusions = outgoingConfusions + incomingConfusions;
      const sessionPairBoost = this.sessionPairBoostBySkill.get(skillId) ?? 0;
      const confusionBoost =
        Math.min(6.0, totalConfusions * 0.75) + sessionPairBoost;

      let priority: number;
      if (trialsSinceLastSeen <= ARTS_SPACING_DELAY) {
        // Blocked by spacing delay D = 2
        priority = trialsSinceLastSeen - ARTS_SPACING_DELAY - 10;
      } else if (!record || record.attempts.length === 0) {
        // Unseen skill: introduce steadily, or boost if part of an active confusion pair
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

    const chosen = scored[0].lang;
    const chosenSkillId = `lang:${chosen.id}`;
    if (this.sessionPairBoostBySkill.has(chosenSkillId)) {
      const prev = this.sessionPairBoostBySkill.get(chosenSkillId) ?? 0;
      if (prev <= 4.0) {
        this.sessionPairBoostBySkill.delete(chosenSkillId);
      } else {
        this.sessionPairBoostBySkill.set(chosenSkillId, prev * 0.5);
      }
    }

    return chosen;
  }

  private selectFreshSample(
    language: LanguageSpec,
    preferredTellId?: string
  ): LanguageSample {
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

    // If this is a follow-up for a specific Tell, prefer a fresh sample containing that Tell
    let chosen = candidates[0];
    if (preferredTellId) {
      const matchingSample = candidates.find((s) =>
        s.tellIds.includes(preferredTellId)
      );
      if (matchingSample) {
        chosen = matchingSample;
      }
    }

    seenInSession.add(chosen.id);
    this.sessionSeenSamplesByLang.set(language.id, seenInSession);
    this.lastSampleIdByLang.set(language.id, chosen.id);
    return chosen;
  }

  private selectTellPrompt(
    language: LanguageSpec,
    sample: LanguageSample,
    preferredTellId?: string
  ): {
    tellId: string;
    pattern: string;
    label: string;
    script: string;
  } {
    const lastTellId = this.lastTellIdByLang.get(language.id);
    const preferredTell = preferredTellId
      ? language.tells.find((t) => t.id === preferredTellId)
      : undefined;
    const matchingTell = language.tells.find(
      (t) => sample.tellIds.includes(t.id) && t.id !== lastTellId
    );
    const chosenTell =
      preferredTell ??
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

  // ===========================================================================
  // COVERAGE SECTION (Official vs Limited vs None Drills & Regional Map Quizzes)
  // ===========================================================================

  async submitCoverageAnswer(
    chosenOptionId: string,
    explicitResponseTimeMs?: number
  ): Promise<CoverageTrialFeedback> {
    const trial = this.currentTrial;
    if (!trial || (trial.kind !== 'coverage-tier' && trial.kind !== 'coverage-cluster')) {
      throw new Error('No active Coverage classification/cluster trial to submit an answer for.');
    }

    const targetCountry =
      trial.country ??
      PLAYABLE_COUNTRY_MAP[trial.countryId ?? trial.skillId.replace(/^cov:/, '')];
    if (!targetCountry) {
      throw new Error(`Unknown PlayableCountry for Coverage skill ${trial.skillId}`);
    }

    const responseTimeMs =
      explicitResponseTimeMs ?? Math.max(100, this.now() - trial.startedAtMs);
    const normalizedChoice = chosenOptionId.trim().toLowerCase();

    const correct =
      trial.kind === 'coverage-tier'
        ? normalizedChoice === `tier:${targetCountry.coverageTier}` ||
          normalizedChoice === targetCountry.coverageTier ||
          normalizedChoice === trial.skillId.toLowerCase()
        : normalizedChoice === trial.skillId.toLowerCase() ||
          normalizedChoice === targetCountry.id.toLowerCase();

    const assisted = this.currentTrialAssisted || Boolean(trial.assisted);

    const state = this.store.getState();
    const existingRecord = state.skills[trial.skillId];
    const previousMastery: MasteryState = existingRecord?.mastery ?? 'unseen';
    const existingAttempts: SkillAttempt[] = existingRecord?.attempts ?? [];

    const recordedChosenSkillId = correct
      ? trial.skillId
      : normalizedChoice.startsWith('cov:') || normalizedChoice.startsWith('tier:')
        ? normalizedChoice
        : trial.kind === 'coverage-tier'
          ? `tier:${normalizedChoice}`
          : `cov:${normalizedChoice}`;

    const simulatedAttempts: SkillAttempt[] = [
      ...existingAttempts,
      {
        timestamp: this.now(),
        correct,
        responseTimeMs,
        assisted,
        chosenSkillId: recordedChosenSkillId,
        sampleId: trial.sample.id,
      },
    ];

    const newMastery = calculateMasteryState(
      simulatedAttempts,
      trial.fluencyThresholdMs
    );

    const prevTotalRt =
      this.sessionStats.averageResponseTimeMs * this.sessionStats.trialsCompleted;
    this.sessionStats.trialsCompleted += 1;
    if (correct) {
      this.sessionStats.correctCount += 1;
      if (!assisted && responseTimeMs <= trial.fluencyThresholdMs) {
        this.sessionStats.fluentCount += 1;
      }
    }
    this.sessionStats.averageResponseTimeMs = Math.round(
      (prevTotalRt + responseTimeMs) / this.sessionStats.trialsCompleted
    );

    await this.store.recordAttempt({
      section: 'coverage',
      skillId: trial.skillId,
      chosenSkillId: recordedChosenSkillId,
      sampleId: trial.sample.id,
      correct,
      responseTimeMs,
      assisted,
      mastery: newMastery,
      trialIndex: this.sessionTrialCounter,
      now: new Date(this.now()),
    });

    const clusterCountries = trial.coveragePrompt?.clusterCountries ?? [targetCountry];
    const mapHighlightedCountryIds =
      trial.kind === 'coverage-cluster'
        ? clusterCountries.map((c) => c.id)
        : [targetCountry.id];

    const regionalLimitedNotes = this.collectRegionalLimitedNotes(
      targetCountry,
      clusterCountries
    );
    const trapCountryNotes = this.collectTrapCountryNotes(
      targetCountry,
      clusterCountries
    );

    const matchedOption = trial.options.find(
      (o) =>
        o.id.toLowerCase() === normalizedChoice ||
        o.languageId.toLowerCase() === normalizedChoice
    );
    const chosenLabel = matchedOption?.label ?? chosenOptionId;

    const covFeedback: CoverageTrialFeedback = {
      correct,
      assisted,
      skillId: trial.skillId,
      countryId: targetCountry.id,
      countryName: targetCountry.name,
      country: targetCountry,
      coverageTier: targetCountry.coverageTier,
      coverageNote: targetCountry.coverageNote,
      chosenOptionId: recordedChosenSkillId,
      chosenLabel,
      responseTimeMs,
      fluencyTargetMs: trial.fluencyThresholdMs,
      isFluentSpeed: correct && !assisted && responseTimeMs <= trial.fluencyThresholdMs,
      previousMastery,
      newMastery,
      mapHighlightedCountryIds,
      regionalLimitedNotes,
      trapCountryNotes,
    };

    this.lastCoverageFeedback = covFeedback;
    this.lastFeedback = this.toUnifiedLanguageTrialFeedback(trial, covFeedback);
    return covFeedback;
  }

  async submitCoverageMapAnswer(
    selectedCountryIds: string[],
    explicitResponseTimeMs?: number
  ): Promise<CoverageTrialFeedback> {
    const trial = this.currentTrial;
    if (!trial || trial.kind !== 'coverage-map' || !trial.coveragePrompt) {
      throw new Error('No active Coverage regional map trial to submit selections for.');
    }

    const prompt = trial.coveragePrompt;
    const targetCountry = prompt.targetCountry;
    const expectedCountryIds = prompt.expectedCountryIds ?? [targetCountry.id];
    const regionPool = prompt.regionPoolCountries ?? [targetCountry];

    const mapEvaluation = evaluateCoverageMapSelection(
      expectedCountryIds,
      selectedCountryIds,
      regionPool
    );

    const responseTimeMs =
      explicitResponseTimeMs ?? Math.max(100, this.now() - trial.startedAtMs);
    const correct = mapEvaluation.perfect;
    const assisted = this.currentTrialAssisted || Boolean(trial.assisted);

    const state = this.store.getState();
    const existingRecord = state.skills[trial.skillId];
    const previousMastery: MasteryState = existingRecord?.mastery ?? 'unseen';
    const existingAttempts: SkillAttempt[] = existingRecord?.attempts ?? [];

    const chosenSkillId = correct
      ? trial.skillId
      : `map:${mapEvaluation.selectedCountryIds.join(',') || 'none'}`;

    const simulatedAttempts: SkillAttempt[] = [
      ...existingAttempts,
      {
        timestamp: this.now(),
        correct,
        responseTimeMs,
        assisted,
        chosenSkillId,
        sampleId: trial.sample.id,
      },
    ];

    const newMastery = calculateMasteryState(
      simulatedAttempts,
      trial.fluencyThresholdMs
    );

    const prevTotalRt =
      this.sessionStats.averageResponseTimeMs * this.sessionStats.trialsCompleted;
    this.sessionStats.trialsCompleted += 1;
    if (correct) {
      this.sessionStats.correctCount += 1;
      if (!assisted && responseTimeMs <= trial.fluencyThresholdMs) {
        this.sessionStats.fluentCount += 1;
      }
    }
    this.sessionStats.averageResponseTimeMs = Math.round(
      (prevTotalRt + responseTimeMs) / this.sessionStats.trialsCompleted
    );

    await this.store.recordAttempt({
      section: 'coverage',
      skillId: trial.skillId,
      chosenSkillId,
      sampleId: trial.sample.id,
      correct,
      responseTimeMs,
      assisted,
      mastery: newMastery,
      trialIndex: this.sessionTrialCounter,
      now: new Date(this.now()),
    });

    const regionalLimitedNotes = this.collectRegionalLimitedNotes(
      targetCountry,
      regionPool
    );
    const trapCountryNotes = this.collectTrapCountryNotes(
      targetCountry,
      regionPool
    );

    const covFeedback: CoverageTrialFeedback = {
      correct,
      assisted,
      skillId: trial.skillId,
      countryId: targetCountry.id,
      countryName: targetCountry.name,
      country: targetCountry,
      coverageTier: targetCountry.coverageTier,
      coverageNote: targetCountry.coverageNote,
      chosenOptionId: mapEvaluation.selectedCountryIds.join(','),
      chosenLabel:
        mapEvaluation.selectedCountryIds.length > 0
          ? mapEvaluation.selectedCountryIds
              .map((id) => PLAYABLE_COUNTRY_MAP[id]?.name ?? id)
              .join(', ')
          : 'None selected',
      responseTimeMs,
      fluencyTargetMs: trial.fluencyThresholdMs,
      isFluentSpeed: correct && !assisted && responseTimeMs <= trial.fluencyThresholdMs,
      previousMastery,
      newMastery,
      mapHighlightedCountryIds: expectedCountryIds,
      regionalLimitedNotes,
      trapCountryNotes,
      mapEvaluation,
    };

    this.lastCoverageFeedback = covFeedback;
    this.lastFeedback = this.toUnifiedLanguageTrialFeedback(trial, covFeedback);
    return covFeedback;
  }

  private buildCoverageGuidedBreakdown(trial: PracticeTrial): GuidedBreakdown {
    const targetCountry =
      trial.country ??
      PLAYABLE_COUNTRY_MAP[trial.countryId ?? trial.skillId.replace(/^cov:/, '')] ??
      PLAYABLE_COUNTRIES[0];

    const existingQueuedForSkill = this.followUpQueue.filter(
      (q) => q.skillId === trial.skillId
    ).length;
    const toEnqueue = Math.max(
      0,
      Math.min(GUIDED_BREAKDOWN_FOLLOW_UP_COUNT, 3 - existingQueuedForSkill)
    );

    for (let i = 0; i < toEnqueue; i++) {
      this.followUpQueue.push({
        skillId: trial.skillId,
        languageId: targetCountry.id,
        queuedAtTrial: this.sessionTrialCounter,
      });
    }

    const distractorEliminations: DistractorElimination[] = [];
    if (trial.kind === 'coverage-tier') {
      const expectedOptionId = `tier:${targetCountry.coverageTier}`;
      for (const opt of trial.options) {
        if (opt.id === expectedOptionId) continue;
        const reason =
          opt.languageId === 'official'
            ? `Ruled out: ${targetCountry.name} does not have broad nationwide Official coverage (${targetCountry.coverageTier.toUpperCase()} — ${targetCountry.coverageNote})`
            : opt.languageId === 'limited'
              ? `Ruled out: ${targetCountry.name} is ${targetCountry.coverageTier.toUpperCase()}, not Limited (${targetCountry.coverageNote})`
              : `Ruled out: ${targetCountry.name} is playable in Street View (${targetCountry.coverageTier.toUpperCase()} — ${targetCountry.coverageNote})`;
        distractorEliminations.push({
          optionId: opt.id,
          languageId: opt.languageId,
          languageName: `${opt.label} Coverage Tier`,
          nativeName: opt.sublabel,
          reason,
          expectedTellsMissing: [],
        });
      }
    } else if (trial.kind === 'coverage-cluster') {
      for (const opt of trial.options) {
        if (opt.id === trial.skillId) continue;
        const distCountry = PLAYABLE_COUNTRY_MAP[opt.languageId];
        distractorEliminations.push({
          optionId: opt.id,
          languageId: opt.languageId,
          languageName: distCountry?.name ?? opt.label,
          nativeName: distCountry
            ? `${distCountry.coverageTier.toUpperCase()} Coverage`
            : opt.sublabel,
          reason: distCountry
            ? `Ruled out: ${distCountry.name} has ${distCountry.coverageTier.toUpperCase()} coverage (${distCountry.coverageNote})`
            : `Does not match the target Coverage Tier for this cluster.`,
          expectedTellsMissing: [],
        });
      }
    }

    const contextCountries =
      trial.coveragePrompt?.clusterCountries ??
      trial.coveragePrompt?.regionPoolCountries ??
      [targetCountry];
    const coveredCandidates =
      trial.kind === 'coverage-map' && trial.coveragePrompt?.expectedCountryIds
        ? trial.coveragePrompt.expectedCountryIds
            .map((id) => PLAYABLE_COUNTRY_MAP[id])
            .filter((c): c is PlayableCountry => Boolean(c))
        : contextCountries.filter((c) => c.coverageTier !== 'none');

    const uncoveredNotes = contextCountries
      .filter((c) => c.coverageTier === 'none' || c.isTrapCountry)
      .map((c) => `${c.name} (${c.coverageTier.toUpperCase()}): ${c.coverageNote}`);

    const regionalLimitedNotes = this.collectRegionalLimitedNotes(
      targetCountry,
      contextCountries
    );

    const breakdown: GuidedBreakdown = {
      skillId: trial.skillId,
      languageId: targetCountry.id,
      languageName: targetCountry.name,
      nativeName: `${targetCountry.coverageTier.toUpperCase()} Coverage · ${targetCountry.region}`,
      script: targetCountry.subregion,
      sample: trial.sample,
      translation: targetCountry.coverageNote,
      matchedTells: [],
      structuralClue: `${targetCountry.name} has ${targetCountry.coverageTier.toUpperCase()} Street View coverage: ${targetCountry.coverageNote}`,
      gestaltNote: targetCountry.coverageNote,
      contrastNote:
        uncoveredNotes.length > 0
          ? uncoveredNotes.slice(0, 3).join(' · ')
          : `${targetCountry.name} (${targetCountry.coverageTier.toUpperCase()}): ${targetCountry.coverageNote}`,
      distractorEliminations,
      candidateCountries:
        coveredCandidates.length > 0 ? coveredCandidates : [targetCountry],
      uncoveredCountryNotes: uncoveredNotes,
      countryId: targetCountry.id,
      country: targetCountry,
      coverageTier: targetCountry.coverageTier,
      coverageNote: targetCountry.coverageNote,
      regionalLimitedNotes,
      assisted: true,
      queuedFollowUps: this.getQueuedFollowUpCount(trial.skillId),
    };

    this.activeGuidedBreakdown = breakdown;
    return breakdown;
  }

  private nextCoverageTrial(): PracticeTrial {
    // 1. Check if any Guided Breakdown follow-up item has satisfied the D = 2 spacing delay
    const eligibleFollowUpIdx = this.followUpQueue.findIndex((item) => {
      const lastSeen = this.sessionLastPresentedAt.get(item.skillId);
      const trialsSinceLastSeen =
        lastSeen !== undefined ? this.sessionTrialCounter - lastSeen : 999;
      return trialsSinceLastSeen > ARTS_SPACING_DELAY;
    });

    let targetCountry: PlayableCountry;
    let isFollowUp = false;

    if (eligibleFollowUpIdx !== -1) {
      const followUp = this.followUpQueue.splice(eligibleFollowUpIdx, 1)[0];
      const countryId = followUp.skillId.replace(/^cov:/, '');
      targetCountry =
        PLAYABLE_COUNTRY_MAP[countryId] ??
        getCountriesForCoverageFocus(this.activeCoverageFocus)[0];
      isFollowUp = true;
    } else {
      const pool = getCountriesForCoverageFocus(this.activeCoverageFocus);
      targetCountry = this.selectNextCoverageCountryByArts(pool);
    }

    const skillId = `cov:${targetCountry.id}`;
    this.sessionLastPresentedAt.set(skillId, this.sessionTrialCounter);

    let drillKind: 'coverage-tier' | 'coverage-cluster' | 'coverage-map';
    if (this.coverageDrillMode === 'tier-speed') {
      drillKind = 'coverage-tier';
    } else if (this.coverageDrillMode === 'regional-map') {
      drillKind = 'coverage-map';
    } else if (this.coverageDrillMode === 'neighbor-cluster') {
      drillKind = 'coverage-cluster';
    } else {
      // 'mixed' mode: interleave speed tier classification, neighbor cluster trap drills, and regional map drills
      if (isFollowUp) {
        drillKind = 'coverage-tier';
      } else if (this.sessionTrialCounter % 4 === 0) {
        drillKind = 'coverage-map';
      } else if (this.sessionTrialCounter % 3 === 0) {
        drillKind = 'coverage-cluster';
      } else {
        drillKind = 'coverage-tier';
      }
    }

    if (drillKind === 'coverage-map') {
      this.currentTrial = this.buildCoverageMapTrial(targetCountry, isFollowUp);
    } else if (drillKind === 'coverage-cluster') {
      this.currentTrial = this.buildCoverageClusterTrial(targetCountry, isFollowUp);
    } else {
      this.currentTrial = this.buildCoverageTierTrial(targetCountry, isFollowUp);
    }

    return this.currentTrial;
  }

  private buildCoverageTierTrial(
    country: PlayableCountry,
    isFollowUp: boolean
  ): PracticeTrial {
    const skillId = `cov:${country.id}`;
    const focusSpec = COVERAGE_FOCUS_MAP[this.activeCoverageFocus];
    const suggestedRegionPreset = inferBestRegionPresetForCountries([country]);

    const options: TrialOption[] = [
      {
        id: 'tier:official',
        languageId: 'official',
        label: 'Official',
        sublabel: 'Broad road Street View coverage',
        shortcutKey: 1,
      },
      {
        id: 'tier:limited',
        languageId: 'limited',
        label: 'Limited',
        sublabel: 'Specific regions, select cities, or trekker-only',
        shortcutKey: 2,
      },
      {
        id: 'tier:none',
        languageId: 'none',
        label: 'None',
        sublabel: 'No playable Street View road coverage',
        shortcutKey: 3,
      },
    ];

    const sample: LanguageSample = {
      id: `cov-tier-${country.id}`,
      text: `${country.name} (${country.subregion}, ${country.region} · ${country.tld})`,
      translation: country.coverageNote,
      kind: 'sign',
      tellIds: [],
      structuralClue: country.coverageNote,
    };

    return {
      trialNumber: this.sessionTrialCounter,
      section: 'coverage',
      kind: 'coverage-tier',
      skillId,
      languageId: country.id,
      countryId: country.id,
      country,
      groupName: `Coverage · ${focusSpec.name}`,
      fluencyThresholdMs: LANGUAGE_FLUENCY_THRESHOLD_MS,
      sample,
      coveragePrompt: {
        focusId: this.activeCoverageFocus,
        focusLabel: focusSpec.name,
        drillKind: 'coverage-tier',
        targetCountry: country,
        promptTitle: `What is the Street View Coverage Tier of ${country.name}?`,
        promptDescription: `${country.subregion} (${country.region}) · Domain ${country.tld} · Drives ${country.drivingSide}`,
        suggestedRegionPreset,
      },
      assisted: false,
      isFollowUp,
      options,
      startedAtMs: this.now(),
    };
  }

  private buildCoverageClusterTrial(
    country: PlayableCountry,
    isFollowUp: boolean
  ): PracticeTrial {
    // In neighbor-cluster drills, prefer contrasting a country against neighbors with a different coverage tier
    let targetCountry = country;
    if (
      !isFollowUp &&
      this.coverageDrillMode === 'neighbor-cluster' &&
      targetCountry.coverageTier === 'official'
    ) {
      // Find a nearby trap / None or Limited country in the same region that is not blocked by D = 2 spacing delay
      const regionTraps = PLAYABLE_COUNTRIES.filter(
        (c) =>
          c.region === targetCountry.region &&
          (c.coverageTier === 'none' || c.isTrapCountry)
      );
      const eligibleTrap = regionTraps.find((c) => {
        const lastSeen = this.sessionLastPresentedAt.get(`cov:${c.id}`);
        const n = lastSeen !== undefined ? this.sessionTrialCounter - lastSeen : 999;
        return n > ARTS_SPACING_DELAY;
      });
      if (eligibleTrap) {
        targetCountry = eligibleTrap;
        this.sessionLastPresentedAt.set(
          `cov:${targetCountry.id}`,
          this.sessionTrialCounter
        );
      }
    }

    const skillId = `cov:${targetCountry.id}`;
    const focusSpec = COVERAGE_FOCUS_MAP[this.activeCoverageFocus];
    const targetTier = targetCountry.coverageTier;

    // Pick 3–4 neighboring countries in the same subregion/region that do NOT have targetTier
    const sameSubregionDiffTier = PLAYABLE_COUNTRIES.filter(
      (c) =>
        c.id !== targetCountry.id &&
        c.subregion === targetCountry.subregion &&
        c.coverageTier !== targetTier
    );
    const sameRegionDiffTier = PLAYABLE_COUNTRIES.filter(
      (c) =>
        c.id !== targetCountry.id &&
        c.region === targetCountry.region &&
        c.subregion !== targetCountry.subregion &&
        c.coverageTier !== targetTier
    );
    const fallbackDiffTier = PLAYABLE_COUNTRIES.filter(
      (c) => c.id !== targetCountry.id && c.coverageTier !== targetTier
    );

    const distractors = [
      ...sameSubregionDiffTier,
      ...sameRegionDiffTier,
      ...fallbackDiffTier,
    ].slice(0, 3);

    const clusterCountries = [targetCountry, ...distractors].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const suggestedRegionPreset = inferBestRegionPresetForCountries(clusterCountries);

    const promptTitle =
      targetTier === 'none'
        ? `Which of these neighboring countries in ${targetCountry.subregion} has NO playable Street View coverage (None)?`
        : targetTier === 'limited'
          ? `Which of these neighboring countries in ${targetCountry.subregion} has LIMITED (partial regional or trekker) Street View coverage?`
          : `Which of these neighboring countries in ${targetCountry.subregion} has full OFFICIAL Street View road coverage?`;

    const options: TrialOption[] = clusterCountries.map((c, idx) => ({
      id: `cov:${c.id}`,
      languageId: c.id,
      label: c.name,
      sublabel: `${c.subregion} · ${c.tld}`,
      shortcutKey: idx + 1,
    }));

    const sample: LanguageSample = {
      id: `cov-cluster-${targetCountry.id}`,
      text: promptTitle,
      translation: targetCountry.coverageNote,
      kind: 'sign',
      tellIds: [],
      structuralClue: targetCountry.coverageNote,
    };

    return {
      trialNumber: this.sessionTrialCounter,
      section: 'coverage',
      kind: 'coverage-cluster',
      skillId,
      languageId: targetCountry.id,
      countryId: targetCountry.id,
      country: targetCountry,
      groupName: `Coverage · ${focusSpec.name} · Neighboring Cluster`,
      fluencyThresholdMs: LANGUAGE_FLUENCY_THRESHOLD_MS,
      sample,
      coveragePrompt: {
        focusId: this.activeCoverageFocus,
        focusLabel: focusSpec.name,
        drillKind: 'coverage-cluster',
        targetCountry,
        promptTitle,
        promptDescription: `Compare neighboring countries in ${targetCountry.subregion} (${targetCountry.region}) and spot the ${targetTier.toUpperCase()} coverage country.`,
        suggestedRegionPreset,
        clusterName: targetCountry.subregion,
        clusterCountries,
        targetTierQuestion: targetTier,
      },
      assisted: false,
      isFollowUp,
      options,
      startedAtMs: this.now(),
    };
  }

  private buildCoverageMapTrial(
    country: PlayableCountry,
    isFollowUp: boolean
  ): PracticeTrial {
    const skillId = `cov:${country.id}`;
    const focusSpec = COVERAGE_FOCUS_MAP[this.activeCoverageFocus];

    // Scope the regional map drill to the country's region (or subregion for large regions when appropriate)
    const regionName = country.region;
    const regionCountries = PLAYABLE_COUNTRIES.filter(
      (c) => c.region === regionName
    );
    const uncoveredInRegion = regionCountries.filter(
      (c) => c.coverageTier === 'none'
    );
    const limitedInRegion = regionCountries.filter(
      (c) => c.coverageTier === 'limited'
    );

    let mapTargetFilter: CoverageMapTargetFilter;
    let poolCountries = regionCountries;
    let mapRegionLabel: string = regionName;

    if (country.coverageTier === 'none' && uncoveredInRegion.length > 0) {
      mapTargetFilter = 'uncovered';
    } else if (
      country.coverageTier === 'limited' &&
      limitedInRegion.length > 0 &&
      this.sessionTrialCounter % 2 === 1
    ) {
      mapTargetFilter = 'limited';
    } else if (regionName === 'Europe' && country.coverageTier === 'official') {
      // Scope covered European map drill to the country's subregion (e.g. Eastern Europe, Southern Europe, Northern Europe, Western Europe) so clicking is fast & focused
      const subregionCountries = regionCountries.filter(
        (c) => c.subregion === country.subregion
      );
      if (subregionCountries.length >= 4) {
        poolCountries = subregionCountries;
        mapRegionLabel = country.subregion;
      }
      mapTargetFilter = 'covered';
    } else {
      mapTargetFilter = 'covered';
    }

    const expectedCountries = poolCountries.filter((c) => {
      if (mapTargetFilter === 'uncovered') return c.coverageTier === 'none';
      if (mapTargetFilter === 'limited') return c.coverageTier === 'limited';
      return c.coverageTier === 'official' || c.coverageTier === 'limited';
    });

    const expectedCountryIds = expectedCountries.map((c) => c.id);
    const suggestedRegionPreset = inferBestRegionPresetForCountries(poolCountries);

    const promptTitle =
      mapTargetFilter === 'uncovered'
        ? `Click all countries in ${mapRegionLabel} with NO Street View coverage (None)`
        : mapTargetFilter === 'limited'
          ? `Click all countries in ${mapRegionLabel} with LIMITED Street View coverage`
          : `Click all covered countries (Official + Limited) in ${mapRegionLabel}`;

    const promptDescription =
      mapTargetFilter === 'uncovered'
        ? `Select every uncovered trap country (coverageTier: none) in ${mapRegionLabel} (${expectedCountryIds.length} expected).`
        : mapTargetFilter === 'limited'
          ? `Select every country in ${mapRegionLabel} with partial regional or trekker-only coverage (${expectedCountryIds.length} expected).`
          : `Select every Playable Country in ${mapRegionLabel} with Official or Limited Street View coverage (${expectedCountryIds.length} expected).`;

    const sample: LanguageSample = {
      id: `cov-map-${mapRegionLabel.toLowerCase().replace(/\s+/g, '-')}-${mapTargetFilter}`,
      text: promptTitle,
      translation: promptDescription,
      kind: 'sign',
      tellIds: [],
      structuralClue: country.coverageNote,
    };

    return {
      trialNumber: this.sessionTrialCounter,
      section: 'coverage',
      kind: 'coverage-map',
      skillId,
      languageId: country.id,
      countryId: country.id,
      country,
      groupName: `Coverage · ${focusSpec.name} · Regional Map Quiz`,
      fluencyThresholdMs: MAP_BRIDGE_FLUENCY_THRESHOLD_MS,
      sample,
      coveragePrompt: {
        focusId: this.activeCoverageFocus,
        focusLabel: focusSpec.name,
        drillKind: 'coverage-map',
        targetCountry: country,
        promptTitle,
        promptDescription,
        suggestedRegionPreset,
        mapTargetFilter,
        mapRegionLabel,
        regionPoolCountries: poolCountries,
        expectedCountryIds,
      },
      assisted: false,
      isFollowUp,
      options: [],
      startedAtMs: this.now(),
    };
  }

  private selectNextCoverageCountryByArts(
    pool: PlayableCountry[]
  ): PlayableCountry {
    const state = this.store.getState();

    const scored = pool.map((country, index) => {
      const skillId = `cov:${country.id}`;
      const lastSessionTrial = this.sessionLastPresentedAt.get(skillId);
      const trialsSinceLastSeen =
        lastSessionTrial !== undefined
          ? this.sessionTrialCounter - lastSessionTrial
          : 999;

      const record = state.skills[skillId];
      const outgoingConfusions = Object.values(
        state.confusionMatrix[skillId] ?? {}
      ).reduce((sum, count) => sum + count, 0);
      let incomingConfusions = 0;
      for (const row of Object.values(state.confusionMatrix)) {
        incomingConfusions += row[skillId] ?? 0;
      }
      const totalConfusions = outgoingConfusions + incomingConfusions;
      const confusionBoost = Math.min(6.0, totalConfusions * 0.75);

      let priority: number;
      if (trialsSinceLastSeen <= ARTS_SPACING_DELAY) {
        // Blocked by spacing delay D = 2
        priority = trialsSinceLastSeen - ARTS_SPACING_DELAY - 10;
      } else if (!record || record.attempts.length === 0) {
        // Unseen skill: introduce in focus order (which prioritizes trap, limited, and contrast countries)
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

      return { country, priority, trialsSinceLastSeen };
    });

    scored.sort((a, b) => {
      if (Math.abs(b.priority - a.priority) > 1e-6) {
        return b.priority - a.priority;
      }
      return b.trialsSinceLastSeen - a.trialsSinceLastSeen;
    });

    return scored[0].country;
  }

  private collectRegionalLimitedNotes(
    targetCountry: PlayableCountry,
    contextCountries: PlayableCountry[]
  ): RegionalCoverageNote[] {
    const notes: RegionalCoverageNote[] = [];
    const seen = new Set<string>();

    if (targetCountry.coverageTier === 'limited') {
      notes.push(toRegionalCoverageNote(targetCountry));
      seen.add(targetCountry.id);
    }

    for (const c of contextCountries) {
      if (c.coverageTier === 'limited' && !seen.has(c.id)) {
        notes.push(toRegionalCoverageNote(c));
        seen.add(c.id);
      }
    }

    // If neither targetCountry nor contextCountries had a 'limited' country, include a nearby regional 'limited' country for reference
    if (notes.length === 0) {
      const nearbyLimited = PLAYABLE_COUNTRIES.filter(
        (c) =>
          c.coverageTier === 'limited' &&
          (c.subregion === targetCountry.subregion || c.region === targetCountry.region)
      ).slice(0, 2);
      for (const c of nearbyLimited) {
        notes.push(toRegionalCoverageNote(c));
      }
    }

    return notes.slice(0, 6);
  }

  private collectTrapCountryNotes(
    targetCountry: PlayableCountry,
    contextCountries: PlayableCountry[]
  ): RegionalCoverageNote[] {
    const notes: RegionalCoverageNote[] = [];
    const seen = new Set<string>();

    if (targetCountry.coverageTier === 'none' || targetCountry.isTrapCountry) {
      notes.push(toRegionalCoverageNote(targetCountry));
      seen.add(targetCountry.id);
    }

    for (const c of contextCountries) {
      if ((c.coverageTier === 'none' || c.isTrapCountry) && !seen.has(c.id)) {
        notes.push(toRegionalCoverageNote(c));
        seen.add(c.id);
      }
    }

    return notes.slice(0, 6);
  }

  private toUnifiedLanguageTrialFeedback(
    trial: PracticeTrial,
    cov: CoverageTrialFeedback
  ): LanguageTrialFeedback {
    return {
      correct: cov.correct,
      assisted: cov.assisted,
      skillId: cov.skillId,
      languageId: cov.countryId,
      languageName: cov.countryName,
      nativeName: `${cov.coverageTier.toUpperCase()} Coverage`,
      chosenOptionId: cov.chosenOptionId,
      chosenLanguageName: cov.chosenLabel,
      responseTimeMs: cov.responseTimeMs,
      fluencyTargetMs: cov.fluencyTargetMs,
      isFluentSpeed: cov.isFluentSpeed,
      previousMastery: cov.previousMastery,
      newMastery: cov.newMastery,
      sample: trial.sample,
      translation: cov.coverageNote,
      matchedTells: [],
      structuralClue: cov.coverageNote,
      gestaltNote: cov.coverageNote,
      contrastNote: cov.coverageNote,
      candidateCountries:
        cov.country.coverageTier !== 'none' ? [cov.country] : [],
      uncoveredCountryNotes: cov.trapCountryNotes.map(
        (n) => `${n.countryName} (${n.coverageTier.toUpperCase()}): ${n.coverageNote}`
      ),
      mapEvaluation: cov.mapEvaluation,
      countryId: cov.countryId,
      country: cov.country,
      coverageTier: cov.coverageTier,
      coverageNote: cov.coverageNote,
      regionalLimitedNotes: cov.regionalLimitedNotes,
      trapCountryNotes: cov.trapCountryNotes,
      mapHighlightedCountryIds: cov.mapHighlightedCountryIds,
      coverageFeedback: cov,
    };
  }
}
