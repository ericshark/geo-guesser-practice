import {
  DOMAINS_CURRENCIES_SKILL_MAP,
  DOMAINS_CURRENCIES_SKILLS,
} from '../data/domainsCurrencies.ts';
import {
  computeDrivingSideNarrowingCandidates,
  COVERAGE_FOCUS_MAP,
  DRIVING_SIDE_FOCUS_MAP,
  findTellMatchesInSample,
  getCandidateCountriesForLanguage,
  getCountriesForCoverageFocus,
  getCountriesForDrivingSideFocus,
  getCountryScripts,
  getLanguagesForGroupSelection,
  inferBestRegionPresetForCountries,
  LANGUAGE_GROUP_MAP,
  LANGUAGE_MAP,
  LANGUAGES,
  PLAYABLE_COUNTRIES,
  PLAYABLE_COUNTRY_MAP,
  type CoverageFocusId,
  type CoverageTier,
  type DrivingSide,
  type DrivingSideFocusId,
  type DrivingSideNarrowingFilter,
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
  const signSkill = DOMAINS_CURRENCIES_SKILL_MAP.get(skillId);
  if (signSkill) {
    return {
      label: signSkill.label,
      sublabel: signSkill.kind === 'domain' ? signSkill.countries[0].name : 'Currency',
    };
  }
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
  } else if (skillId.startsWith('drive:') || skillId.startsWith('cov:')) {
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
    const fluencyCeiling =
      record.section === 'driving-side'
        ? DRIVING_SIDE_FLUENCY_THRESHOLD_MS
        : LANGUAGE_FLUENCY_THRESHOLD_MS;
    const weaknessScore =
      learningBonus +
      (100 - accuracyPercent) * 0.6 +
      assistedCount * 12 +
      confusionCount * 15 +
      Math.min(30, Math.max(0, (averageRtMs - fluencyCeiling) / 250));

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

export type DrivingSideDrillMode =
  | 'mixed'
  | 'speed-left-right'
  | 'regional-map'
  | 'multi-clue-narrowing';

export interface DrivingSideSessionConfig {
  focusId: DrivingSideFocusId;
  drillMode?: DrivingSideDrillMode;
}

export interface DrivingSideBorderContrastNote {
  countryId: string;
  countryName: string;
  region: string;
  subregion: string;
  drivingSide: DrivingSide;
  coverageTier: CoverageTier;
  drivingNote: string;
}

export interface DrivingSideTrialPrompt {
  focusId: DrivingSideFocusId;
  focusLabel: string;
  drillKind: 'driving-speed' | 'driving-map' | 'driving-narrowing';
  targetCountry: PlayableCountry;
  promptTitle: string;
  promptDescription: string;
  suggestedRegionPreset: MapRegionPresetId;
  mapRegionLabel?: string;
  mapTargetSide?: DrivingSide;
  regionPoolCountries?: PlayableCountry[];
  expectedCountryIds?: string[];
  narrowingFilter?: DrivingSideNarrowingFilter;
  narrowingClueSummary?: string;
  signLanguage?: LanguageSpec;
  signSample?: LanguageSample;
  matchedTells?: TellSpanMatch[];
  uncoveredCountryNotes?: string[];
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

export function getLanguageGroupContrastCard(
  groupId: LanguageGroupId,
  state: ProgressData,
  sampleKind?: LanguageSample['kind']
): ContrastCardPrime {
  const groupSpec = LANGUAGE_GROUP_MAP[groupId];
  const languages = getLanguagesForGroupSelection(groupId);
  return {
    groupId,
    groupName: groupSpec.name,
    description: groupSpec.description,
    primeSummary: groupSpec.primeSummary,
    alreadyViewed: state.completedPrimes.includes(groupId),
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
        exampleSample: lang.samples.find(({ kind }) => kind === sampleKind) ?? lang.samples[0],
        mastery,
      };
    }),
  };
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
  | 'coverage-map'
  | 'driving-speed'
  | 'driving-map'
  | 'driving-narrowing'
  | 'domain'
  | 'currency';

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
  drivingSide?: DrivingSide;
  drivingNote?: string;
  borderContrastNotes?: DrivingSideBorderContrastNote[];
  assisted: true;
  queuedFollowUps: number;
}

export interface PracticeTrial {
  trialNumber: number;
  section?: SectionId;
  kind: LanguageTrialKind;
  skillId: string; // e.g., 'lang:cs' or 'cov:ng' or 'drive:ke'
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
  drivingPrompt?: DrivingSideTrialPrompt;
  domainsCurrenciesPrompt?: DomainsCurrenciesPrompt;
  assisted?: boolean;
  isFollowUp?: boolean;
  options: TrialOption[];
  startedAtMs: number;
}

export type DomainsCurrenciesDrillMode = 'mixed' | 'domains' | 'currencies';

export interface DomainsCurrenciesPrompt {
  marker: string;
  countries: PlayableCountry[];
}

export interface DomainsCurrenciesFeedback {
  saveFailed?: true;
  correct: boolean;
  assisted: boolean;
  responseTimeMs: number;
  isFluentSpeed: boolean;
  newMastery: MasteryState;
  selectedCountryIds: string[];
  expectedCountryIds: string[];
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

export interface DrivingSideTrialFeedback {
  correct: boolean;
  assisted: boolean;
  skillId: string; // 'drive:<countryId>'
  countryId: string;
  countryName: string;
  country: PlayableCountry;
  drivingSide: DrivingSide;
  drivingNote: string;
  chosenOptionId: string;
  chosenLabel: string;
  responseTimeMs: number;
  fluencyTargetMs: number;
  isFluentSpeed: boolean;
  previousMastery: MasteryState;
  newMastery: MasteryState;
  mapHighlightedCountryIds: string[];
  borderContrastNotes: DrivingSideBorderContrastNote[];
  uncoveredCountryNotes: string[];
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
  drivingSide?: DrivingSide;
  drivingNote?: string;
  borderContrastNotes?: DrivingSideBorderContrastNote[];
  drivingFeedback?: DrivingSideTrialFeedback;
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

export function evaluateDrivingMapSelection(
  expectedCountryIds: string[],
  selectedCountryIds: string[],
  regionPoolCountries?: PlayableCountry[],
  customUncoveredNotes?: string[]
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

  const uncoveredCountryNotes =
    customUncoveredNotes && customUncoveredNotes.length > 0
      ? customUncoveredNotes
      : poolForNotes
          .filter((c) => c.coverageTier === 'none')
          .slice(0, 6)
          .map(
            (c) =>
              `${c.name} (${c.drivingSide.toUpperCase()}, None coverage): ${
                c.drivingNote ?? c.coverageNote
              }`
          );

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

function toDrivingBorderContrastNote(
  country: PlayableCountry
): DrivingSideBorderContrastNote {
  return {
    countryId: country.id,
    countryName: country.name,
    region: country.region,
    subregion: country.subregion,
    drivingSide: country.drivingSide,
    coverageTier: country.coverageTier,
    drivingNote: country.drivingNote ?? country.coverageNote,
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
  private activeDrivingFocus: DrivingSideFocusId = 'world';
  private drivingDrillMode: DrivingSideDrillMode = 'mixed';
  private domainsCurrenciesMode: DomainsCurrenciesDrillMode = 'mixed';
  private shownSignCluesBySkill = new Map<string, Set<string>>();
  private domainsCurrenciesFeedback: DomainsCurrenciesFeedback | null = null;
  private stage0Prime: ContrastCardPrime | null = null;
  private currentTrial: PracticeTrial | null = null;
  private currentTrialAssisted = false;
  private activeGuidedBreakdown: GuidedBreakdown | null = null;
  private lastFeedback: LanguageTrialFeedback | null = null;
  private lastCoverageFeedback: CoverageTrialFeedback | null = null;
  private lastDrivingFeedback: DrivingSideTrialFeedback | null = null;

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
      this.stage0Prime = getLanguageGroupContrastCard(config.groupId, this.store.getState());
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
    this.resetGeographySession();
    return this.nextTrial();
  }

  startDrivingSideSession(config: DrivingSideSessionConfig): PracticeTrial {
    this.activeSection = 'driving-side';
    this.activeDrivingFocus = config.focusId;
    this.drivingDrillMode = config.drillMode ?? 'mixed';
    this.resetGeographySession();
    return this.nextTrial();
  }

  startDomainsCurrenciesSession(
    mode: DomainsCurrenciesDrillMode = 'mixed',
    initialSkillId?: string
  ): PracticeTrial {
    this.activeSection = 'domains-currencies';
    this.domainsCurrenciesMode = mode;
    this.resetGeographySession();
    this.sessionTrialCounter += 1;
    return this.nextDomainsCurrenciesTrial(initialSkillId);
  }

  private resetGeographySession(): void {
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
    this.lastDrivingFeedback = null;
    this.sessionStats = {
      trialsCompleted: 0,
      correctCount: 0,
      fluentCount: 0,
      averageResponseTimeMs: 0,
    };
    this.domainsCurrenciesFeedback = null;
  }

  getActiveSection(): SectionId {
    return this.activeSection;
  }

  getActiveDrivingFocus(): DrivingSideFocusId {
    return this.activeDrivingFocus;
  }

  getDrivingDrillMode(): DrivingSideDrillMode {
    return this.drivingDrillMode;
  }

  getLastDrivingFeedback(): DrivingSideTrialFeedback | null {
    return this.lastDrivingFeedback;
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

    const alreadyAssisted = this.currentTrialAssisted;
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

    if (
      trial.section === 'driving-side' ||
      trial.kind === 'driving-speed' ||
      trial.kind === 'driving-map' ||
      trial.kind === 'driving-narrowing'
    ) {
      return this.buildDrivingGuidedBreakdown(trial);
    }

    if (trial.domainsCurrenciesPrompt) {
      return this.buildDomainsCurrenciesBreakdown(trial, trial.domainsCurrenciesPrompt, alreadyAssisted);
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
    this.lastDrivingFeedback = null;
    this.currentTrialAssisted = false;
    this.activeGuidedBreakdown = null;

    if (this.activeSection === 'coverage') {
      return this.nextCoverageTrial();
    }

    if (this.activeSection === 'driving-side') {
      return this.nextDrivingSideTrial();
    }

    if (this.activeSection === 'domains-currencies') {
      return this.nextDomainsCurrenciesTrial();
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

    if (trial.domainsCurrenciesPrompt) {
      throw new Error('Use submitDomainsCurrenciesAnswer for this trial.');
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

    if (
      trial.kind === 'driving-map' ||
      trial.kind === 'driving-narrowing'
    ) {
      const parsedIds = chosenOptionId
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await this.submitDrivingMapAnswer(parsedIds, explicitResponseTimeMs);
      return this.lastFeedback!;
    }

    if (
      trial.section === 'driving-side' ||
      trial.kind === 'driving-speed'
    ) {
      await this.submitDrivingSideAnswer(chosenOptionId, explicitResponseTimeMs);
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

  private nextDomainsCurrenciesTrial(initialSkillId?: string): PracticeTrial {
    const pool = DOMAINS_CURRENCIES_SKILLS.filter((skill) =>
      this.domainsCurrenciesMode === 'mixed' ||
      (this.domainsCurrenciesMode === 'domains' ? skill.kind === 'domain' : skill.kind === 'currency')
    );
    const followUpIndex = this.followUpQueue.findIndex(({ skillId }) =>
      this.sessionTrialCounter - (this.sessionLastPresentedAt.get(skillId) ?? 0) > ARTS_SPACING_DELAY
    );
    const followUp = followUpIndex < 0 ? undefined : this.followUpQueue.splice(followUpIndex, 1)[0];
    const state = this.store.getState();
    // Reserve every other turn for new skills while the large Section pool still has unseen items.
    const introductions = this.sessionTrialCounter % 2 === 0
      ? pool.filter(({ id }) => !state.skills[id]?.attempts.length && !this.sessionLastPresentedAt.has(id))
      : [];
    const skill = pool.find(({ id }) => id === (followUp?.skillId ?? initialSkillId))
      ?? this.selectByGeographyArts(introductions.length ? introductions : pool, ({ id }) => id);

    const shown = this.shownSignCluesBySkill.get(skill.id) ?? new Set<string>();
    const recentIds = [...(state.skills[skill.id]?.recentSampleIds ?? []), ...shown];
    const clueId = (text: string) => `${skill.id}:${text}`;
    const clue = skill.clues.reduce((oldest, candidate) =>
      recentIds.lastIndexOf(clueId(candidate.text)) < recentIds.lastIndexOf(clueId(oldest.text))
        ? candidate : oldest
    );
    // Set insertion order keeps the most recently shown clue at the end.
    shown.delete(clueId(clue.text));
    shown.add(clueId(clue.text));
    this.shownSignCluesBySkill.set(skill.id, shown);

    // Keep large currency sets keyboard-friendly. Every listed match is required.
    const expected = this.shuffleCountries(skill.countries).slice(0, 4);
    const distractors = this.shuffleCountries(PLAYABLE_COUNTRIES.filter((country) =>
      !skill.countries.includes(country) &&
      (skill.kind === 'domain' || country.coverageTier !== 'none') &&
      // A compound dollar mark on a sign may also be shortened to a bare dollar sign.
      (clue.marker !== '$' || !country.currencies.some(({ symbol }) => symbol.endsWith('$')))
    ));
    if (skill.kind === 'domain') {
      const region = skill.countries[0].region;
      distractors.sort((a, b) => Number(b.region === region) - Number(a.region === region));
    }
    const choices = this.shuffleCountries([...expected, ...distractors.slice(0, 6 - expected.length)]);

    this.sessionLastPresentedAt.set(skill.id, this.sessionTrialCounter);
    this.domainsCurrenciesFeedback = null;
    this.currentTrial = {
      trialNumber: this.sessionTrialCounter,
      section: 'domains-currencies',
      kind: skill.kind,
      skillId: skill.id,
      languageId: '',
      groupName: 'Domains & Currencies',
      fluencyThresholdMs: LANGUAGE_FLUENCY_THRESHOLD_MS,
      sample: { id: clueId(clue.text), text: clue.text, kind: 'sign', translation: '', tellIds: [] },
      domainsCurrenciesPrompt: { marker: clue.marker, countries: skill.countries },
      isFollowUp: Boolean(followUp),
      options: choices.map((country, index) => ({
        id: country.id,
        languageId: '',
        label: country.name,
        sublabel: '',
        shortcutKey: index + 1,
      })),
      startedAtMs: this.now(),
    };
    return this.currentTrial;
  }

  private shuffleCountries(countries: PlayableCountry[]): PlayableCountry[] {
    const shuffled = [...countries];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async submitDomainsCurrenciesAnswer(
    countryIds: string[],
    explicitResponseTimeMs?: number
  ): Promise<DomainsCurrenciesFeedback> {
    const trial = this.currentTrial;
    const prompt = trial?.domainsCurrenciesPrompt;
    if (!trial || !prompt) throw new Error('No active Domains & Currencies trial.');
    if (this.domainsCurrenciesFeedback) return this.domainsCurrenciesFeedback;

    const selectedCountryIds = [...new Set(countryIds)];
    const expectedCountryIds = trial.options.map(({ id }) => id).filter((id) =>
      prompt.countries.some((country) => country.id === id)
    );
    const correct = selectedCountryIds.length === expectedCountryIds.length &&
      expectedCountryIds.every((id) => selectedCountryIds.includes(id));
    const timestamp = this.now();
    const responseTimeMs = Math.max(0, Math.round(explicitResponseTimeMs ?? timestamp - trial.startedAtMs));
    const assisted = this.currentTrialAssisted;
    const isFluentSpeed = correct && !assisted && responseTimeMs < trial.fluencyThresholdMs;
    const attempts = this.store.getState().skills[trial.skillId]?.attempts ?? [];
    const newMastery = calculateMasteryState(
      [...attempts, { timestamp, correct, assisted, responseTimeMs }],
      trial.fluencyThresholdMs - 1
    );

    const stats = this.sessionStats;
    stats.averageResponseTimeMs = Math.round(
      (stats.averageResponseTimeMs * stats.trialsCompleted + responseTimeMs) / (stats.trialsCompleted + 1)
    );
    stats.trialsCompleted += 1;
    stats.correctCount += Number(correct);
    stats.fluentCount += Number(isFluentSpeed);

    const feedback: DomainsCurrenciesFeedback = {
      correct, assisted, responseTimeMs, isFluentSpeed, newMastery, selectedCountryIds, expectedCountryIds,
    };
    this.domainsCurrenciesFeedback = feedback;
    const wrongId = selectedCountryIds.find((id) => !expectedCountryIds.includes(id) &&
      trial.options.some((option) => option.id === id));
    const wrongCountry = wrongId ? PLAYABLE_COUNTRY_MAP[wrongId] : undefined;
    const wrongCurrency = wrongCountry?.currencies[0];
    const chosenSkillId = trial.kind === 'domain' && wrongCountry
      ? `domain:${wrongCountry.id}`
      : wrongCurrency && `curr:${wrongCurrency.code.toLowerCase()}`;

    try {
      await this.store.recordAttempt({
        section: 'domains-currencies',
        skillId: trial.skillId,
        chosenSkillId,
        sampleId: trial.sample.id,
        correct,
        assisted,
        responseTimeMs,
        mastery: newMastery,
        trialIndex: trial.trialNumber,
        now: new Date(timestamp),
      });
    } catch {
      feedback.saveFailed = true;
    }
    return feedback;
  }

  private buildDomainsCurrenciesBreakdown(
    trial: PracticeTrial,
    prompt: DomainsCurrenciesPrompt,
    alreadyAssisted: boolean
  ): GuidedBreakdown {
    const isDomain = trial.kind === 'domain';
    const expected = new Set(prompt.countries.map(({ id }) => id));
    const explanation = isDomain
      ? `Read the country-code suffix at the end of the address. ${prompt.marker} belongs to ${prompt.countries[0].name}.`
      : `Read the currency mark next to the amount. Every listed country whose currency uses ${prompt.marker} is a match.`;

    const toQueue = alreadyAssisted ? 0 : Math.min(
      GUIDED_BREAKDOWN_FOLLOW_UP_COUNT,
      3 - this.getQueuedFollowUpCount(trial.skillId)
    );
    for (let i = 0; i < toQueue; i++) {
      this.followUpQueue.push({
        skillId: trial.skillId,
        languageId: '',
        queuedAtTrial: this.sessionTrialCounter,
      });
    }
    this.activeGuidedBreakdown = {
      skillId: trial.skillId,
      languageId: '',
      languageName: '',
      nativeName: '',
      script: '',
      sample: trial.sample,
      translation: '',
      matchedTells: [],
      gestaltNote: explanation,
      contrastNote: '',
      candidateCountries: prompt.countries,
      uncoveredCountryNotes: [],
      distractorEliminations: trial.options.filter(({ id }) => !expected.has(id)).map((option) => {
        const country = PLAYABLE_COUNTRY_MAP[option.id];
        const clue = isDomain ? country.tld : country.currencies.map(({ code, symbol }) =>
          code === symbol ? code : `${code} (${symbol})`
        ).join(', ');
        return {
          optionId: option.id,
          languageId: '',
          languageName: country.name,
          nativeName: '',
          reason: `${country.name} uses ${clue}.`,
          expectedTellsMissing: [],
        };
      }),
      assisted: true,
      queuedFollowUps: this.getQueuedFollowUpCount(trial.skillId),
    };
    return this.activeGuidedBreakdown;
  }

  private selectNextCoverageCountryByArts(
    pool: PlayableCountry[]
  ): PlayableCountry {
    return this.selectByGeographyArts(pool, (country) => `cov:${country.id}`);
  }

  private selectByGeographyArts<T>(pool: T[], getSkillId: (item: T) => string): T {
    const state = this.store.getState();

    const scored = pool.map((item, index) => {
      const skillId = getSkillId(item);
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
        // Unseen skill: introduce in pool order
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

      return { item, priority, trialsSinceLastSeen };
    });

    scored.sort((a, b) => {
      if (Math.abs(b.priority - a.priority) > 1e-6) {
        return b.priority - a.priority;
      }
      return b.trialsSinceLastSeen - a.trialsSinceLastSeen;
    });

    return scored[0].item;
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

  // ===========================================================================
  // DRIVING SIDE SECTION (Regional Map Drills, Left/Right Speed Drills & Multi-Clue Narrowing)
  // ===========================================================================

  async submitDrivingSideAnswer(
    chosenOptionId: string,
    explicitResponseTimeMs?: number
  ): Promise<DrivingSideTrialFeedback> {
    const trial = this.currentTrial;
    if (!trial || trial.kind !== 'driving-speed') {
      throw new Error('No active Driving Side speed trial to submit an answer for.');
    }

    const targetCountry =
      trial.country ??
      PLAYABLE_COUNTRY_MAP[trial.countryId ?? trial.skillId.replace(/^drive:/, '')];
    if (!targetCountry) {
      throw new Error(`Unknown PlayableCountry for Driving Side skill ${trial.skillId}`);
    }

    const responseTimeMs =
      explicitResponseTimeMs ?? Math.max(100, this.now() - trial.startedAtMs);
    const normalizedChoice = chosenOptionId.trim().toLowerCase();

    const correct =
      normalizedChoice === `side:${targetCountry.drivingSide}` ||
      normalizedChoice === targetCountry.drivingSide ||
      normalizedChoice === trial.skillId.toLowerCase();

    const assisted = this.currentTrialAssisted || Boolean(trial.assisted);

    const state = this.store.getState();
    const existingRecord = state.skills[trial.skillId];
    const previousMastery: MasteryState = existingRecord?.mastery ?? 'unseen';
    const existingAttempts: SkillAttempt[] = existingRecord?.attempts ?? [];

    const recordedChosenSkillId = correct
      ? trial.skillId
      : normalizedChoice.startsWith('side:') || normalizedChoice.startsWith('drive:')
        ? normalizedChoice
        : `side:${normalizedChoice}`;

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
      section: 'driving-side',
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

    const borderContrastNotes = this.collectDrivingBorderContrastNotes(targetCountry);
    const mapHighlightedCountryIds = [
      targetCountry.id,
      ...borderContrastNotes.slice(0, 4).map((n) => n.countryId),
    ];

    const matchedOption = trial.options.find(
      (o) =>
        o.id.toLowerCase() === normalizedChoice ||
        o.languageId.toLowerCase() === normalizedChoice
    );
    const chosenLabel = matchedOption?.label ?? chosenOptionId;
    const drivingNote =
      targetCountry.drivingNote ??
      `Traffic in ${targetCountry.name} drives on the ${targetCountry.drivingSide.toUpperCase()}. ${targetCountry.coverageNote}`;

    const drivingFeedback: DrivingSideTrialFeedback = {
      correct,
      assisted,
      skillId: trial.skillId,
      countryId: targetCountry.id,
      countryName: targetCountry.name,
      country: targetCountry,
      drivingSide: targetCountry.drivingSide,
      drivingNote,
      chosenOptionId: recordedChosenSkillId,
      chosenLabel,
      responseTimeMs,
      fluencyTargetMs: trial.fluencyThresholdMs,
      isFluentSpeed: correct && !assisted && responseTimeMs <= trial.fluencyThresholdMs,
      previousMastery,
      newMastery,
      mapHighlightedCountryIds,
      borderContrastNotes,
      uncoveredCountryNotes:
        targetCountry.coverageTier === 'none'
          ? [
              `${targetCountry.name} (${targetCountry.drivingSide.toUpperCase()}, None coverage): ${drivingNote}`,
            ]
          : [],
    };

    this.lastDrivingFeedback = drivingFeedback;
    this.lastFeedback = this.toUnifiedDrivingLanguageFeedback(trial, drivingFeedback);
    return drivingFeedback;
  }

  async submitDrivingMapAnswer(
    selectedCountryIds: string[],
    explicitResponseTimeMs?: number
  ): Promise<DrivingSideTrialFeedback> {
    const trial = this.currentTrial;
    if (
      !trial ||
      (trial.kind !== 'driving-map' && trial.kind !== 'driving-narrowing') ||
      !trial.drivingPrompt
    ) {
      throw new Error(
        'No active Driving Side regional map or multi-clue narrowing trial to submit selections for.'
      );
    }

    const prompt = trial.drivingPrompt;
    const targetCountry = prompt.targetCountry;
    const expectedCountryIds = prompt.expectedCountryIds ?? [targetCountry.id];
    const regionPool = prompt.regionPoolCountries ?? [targetCountry];

    const mapEvaluation = evaluateDrivingMapSelection(
      expectedCountryIds,
      selectedCountryIds,
      regionPool,
      prompt.uncoveredCountryNotes
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
      section: 'driving-side',
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

    const borderContrastNotes = this.collectDrivingBorderContrastNotes(
      targetCountry,
      regionPool
    );
    const drivingNote =
      targetCountry.drivingNote ??
      `Traffic in ${targetCountry.name} drives on the ${targetCountry.drivingSide.toUpperCase()}. ${targetCountry.coverageNote}`;

    const drivingFeedback: DrivingSideTrialFeedback = {
      correct,
      assisted,
      skillId: trial.skillId,
      countryId: targetCountry.id,
      countryName: targetCountry.name,
      country: targetCountry,
      drivingSide: targetCountry.drivingSide,
      drivingNote,
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
      borderContrastNotes,
      uncoveredCountryNotes: mapEvaluation.uncoveredCountryNotes,
      mapEvaluation,
    };

    this.lastDrivingFeedback = drivingFeedback;
    this.lastFeedback = this.toUnifiedDrivingLanguageFeedback(trial, drivingFeedback);
    return drivingFeedback;
  }

  private buildDrivingGuidedBreakdown(trial: PracticeTrial): GuidedBreakdown {
    const targetCountry =
      trial.country ??
      PLAYABLE_COUNTRY_MAP[trial.countryId ?? trial.skillId.replace(/^drive:/, '')] ??
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

    const drivingNote =
      targetCountry.drivingNote ??
      `Traffic in ${targetCountry.name} drives on the ${targetCountry.drivingSide.toUpperCase()}. ${targetCountry.coverageNote}`;
    const borderContrastNotes = this.collectDrivingBorderContrastNotes(
      targetCountry,
      trial.drivingPrompt?.regionPoolCountries
    );

    const distractorEliminations: DistractorElimination[] = [];
    if (trial.kind === 'driving-speed') {
      const oppositeSide: DrivingSide =
        targetCountry.drivingSide === 'left' ? 'right' : 'left';
      const oppositeOpt = trial.options.find(
        (o) => o.id === `side:${oppositeSide}` || o.languageId === oppositeSide
      );
      if (oppositeOpt) {
        distractorEliminations.push({
          optionId: oppositeOpt.id,
          languageId: oppositeOpt.languageId,
          languageName: oppositeOpt.label,
          nativeName: oppositeOpt.sublabel,
          reason: `Ruled out: ${targetCountry.name} (${targetCountry.subregion}) uses ${targetCountry.drivingSide.toUpperCase()}-hand traffic. ${drivingNote}`,
          expectedTellsMissing: [],
        });
      }
      for (const note of borderContrastNotes.slice(0, 2)) {
        distractorEliminations.push({
          optionId: `drive:${note.countryId}`,
          languageId: note.countryId,
          languageName: `${note.countryName} (${note.drivingSide.toUpperCase()})`,
          nativeName: note.subregion,
          reason: `Regional contrast: ${note.countryName} drives on the ${note.drivingSide.toUpperCase()} — ${note.drivingNote}`,
          expectedTellsMissing: [],
        });
      }
    } else {
      for (const note of borderContrastNotes.slice(0, 3)) {
        distractorEliminations.push({
          optionId: `drive:${note.countryId}`,
          languageId: note.countryId,
          languageName: `${note.countryName} (${note.drivingSide.toUpperCase()})`,
          nativeName: `${note.coverageTier.toUpperCase()} coverage`,
          reason:
            note.coverageTier === 'none'
              ? `Uncovered trap: ${note.countryName} has None official Street View coverage (${note.drivingNote}).`
              : `Contrasting neighbor: ${note.countryName} drives on the ${note.drivingSide.toUpperCase()} (${note.drivingNote}).`,
          expectedTellsMissing: [],
        });
      }
    }

    const expectedCandidateIds =
      trial.drivingPrompt?.expectedCountryIds ?? [targetCountry.id];
    const candidateCountries = expectedCandidateIds
      .map((id) => PLAYABLE_COUNTRY_MAP[id])
      .filter((c): c is PlayableCountry => Boolean(c));

    const uncoveredNotes =
      trial.drivingPrompt?.uncoveredCountryNotes ??
      borderContrastNotes
        .filter((n) => n.coverageTier === 'none')
        .map(
          (n) =>
            `${n.countryName} (${n.drivingSide.toUpperCase()}, None coverage): ${n.drivingNote}`
        );

    const matchedTells = trial.drivingPrompt?.matchedTells ?? [];

    const breakdown: GuidedBreakdown = {
      skillId: trial.skillId,
      languageId: targetCountry.id,
      languageName:
        trial.kind === 'driving-map'
          ? `${trial.drivingPrompt?.mapRegionLabel ?? targetCountry.region} Left-Driving Map`
          : trial.kind === 'driving-narrowing'
            ? trial.drivingPrompt?.narrowingClueSummary ?? targetCountry.name
            : targetCountry.name,
      nativeName: `${targetCountry.drivingSide.toUpperCase()}-Hand Traffic · ${targetCountry.subregion}`,
      script:
        trial.drivingPrompt?.signLanguage?.script ??
        getCountryScripts(targetCountry).join(', '),
      sample: trial.sample,
      translation:
        trial.drivingPrompt?.signSample?.translation ?? drivingNote,
      matchedTells,
      structuralClue: drivingNote,
      gestaltNote: drivingNote,
      contrastNote:
        borderContrastNotes.length > 0
          ? borderContrastNotes
              .slice(0, 3)
              .map(
                (n) =>
                  `${n.countryName} (${n.drivingSide.toUpperCase()}): ${n.drivingNote}`
              )
              .join(' · ')
          : drivingNote,
      distractorEliminations,
      candidateCountries:
        candidateCountries.length > 0 ? candidateCountries : [targetCountry],
      uncoveredCountryNotes: uncoveredNotes,
      countryId: targetCountry.id,
      country: targetCountry,
      coverageTier: targetCountry.coverageTier,
      coverageNote: targetCountry.coverageNote,
      drivingSide: targetCountry.drivingSide,
      drivingNote,
      borderContrastNotes,
      assisted: true,
      queuedFollowUps: this.getQueuedFollowUpCount(trial.skillId),
    };

    this.activeGuidedBreakdown = breakdown;
    return breakdown;
  }

  private nextDrivingSideTrial(): PracticeTrial {
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
      const countryId = followUp.skillId.replace(/^drive:/, '');
      targetCountry =
        PLAYABLE_COUNTRY_MAP[countryId] ??
        getCountriesForDrivingSideFocus(this.activeDrivingFocus)[0];
      isFollowUp = true;
    } else {
      const pool = getCountriesForDrivingSideFocus(this.activeDrivingFocus);
      targetCountry = this.selectNextDrivingCountryByArts(pool);
    }

    const skillId = `drive:${targetCountry.id}`;
    this.sessionLastPresentedAt.set(skillId, this.sessionTrialCounter);

    let drillKind: 'driving-speed' | 'driving-map' | 'driving-narrowing';
    if (this.drivingDrillMode === 'speed-left-right') {
      drillKind = 'driving-speed';
    } else if (this.drivingDrillMode === 'regional-map') {
      drillKind = 'driving-map';
    } else if (this.drivingDrillMode === 'multi-clue-narrowing') {
      drillKind = 'driving-narrowing';
    } else {
      // 'mixed' mode: interleave rapid Left/Right speed prompts (<2500ms ceiling), regional map drills, and multi-clue narrowing drills
      if (isFollowUp) {
        drillKind = 'driving-speed';
      } else if (this.sessionTrialCounter % 4 === 0) {
        drillKind = 'driving-map';
      } else if (this.sessionTrialCounter % 3 === 0) {
        drillKind = 'driving-narrowing';
      } else {
        drillKind = 'driving-speed';
      }
    }

    if (drillKind === 'driving-map') {
      this.currentTrial = this.buildDrivingMapTrial(targetCountry, isFollowUp);
    } else if (drillKind === 'driving-narrowing') {
      this.currentTrial = this.buildDrivingNarrowingTrial(
        targetCountry,
        isFollowUp
      );
    } else {
      this.currentTrial = this.buildDrivingSpeedTrial(targetCountry, isFollowUp);
    }

    return this.currentTrial;
  }

  private buildDrivingSpeedTrial(
    country: PlayableCountry,
    isFollowUp: boolean
  ): PracticeTrial {
    const skillId = `drive:${country.id}`;
    const focusSpec = DRIVING_SIDE_FOCUS_MAP[this.activeDrivingFocus];
    const suggestedRegionPreset = inferBestRegionPresetForCountries([country]);
    const drivingNote =
      country.drivingNote ??
      `Traffic in ${country.name} drives on the ${country.drivingSide.toUpperCase()}. ${country.coverageNote}`;

    const options: TrialOption[] = [
      {
        id: 'side:left',
        languageId: 'left',
        label: 'Left-Hand Traffic (LHT)',
        sublabel: 'Keep left · Steering wheel on right · Clockwise roundabouts',
        shortcutKey: 1,
      },
      {
        id: 'side:right',
        languageId: 'right',
        label: 'Right-Hand Traffic (RHT)',
        sublabel: 'Keep right · Steering wheel on left · Counter-clockwise roundabouts',
        shortcutKey: 2,
      },
    ];

    const sample: LanguageSample = {
      id: `drive-speed-${country.id}`,
      text: `Does traffic in ${country.name} drive on the left or right?`,
      translation: drivingNote,
      kind: 'sign',
      tellIds: [],
      structuralClue: drivingNote,
    };

    return {
      trialNumber: this.sessionTrialCounter,
      section: 'driving-side',
      kind: 'driving-speed',
      skillId,
      languageId: country.id,
      countryId: country.id,
      country,
      groupName: `Driving Side · ${focusSpec.name}`,
      fluencyThresholdMs: DRIVING_SIDE_FLUENCY_THRESHOLD_MS,
      sample,
      drivingPrompt: {
        focusId: this.activeDrivingFocus,
        focusLabel: focusSpec.name,
        drillKind: 'driving-speed',
        targetCountry: country,
        promptTitle: `Does traffic in ${country.name} drive on the left or right?`,
        promptDescription: `${country.subregion} (${country.region}) · Domain ${country.tld} · Coverage: ${country.coverageTier.toUpperCase()}`,
        suggestedRegionPreset,
      },
      assisted: false,
      isFollowUp,
      options,
      startedAtMs: this.now(),
    };
  }

  private getDrivingMapRegionConfig(
    focusId: DrivingSideFocusId,
    targetCountry: PlayableCountry
  ): {
    mapRegionLabel: string;
    suggestedRegionPreset: MapRegionPresetId;
    poolCountries: PlayableCountry[];
    expectedCountries: PlayableCountry[];
    uncoveredNotes: string[];
  } {
    let effectiveFocus:
      | 'europe'
      | 'southern-eastern-africa'
      | 'south-se-asia'
      | 'oceania'
      | 'americas-caribbean';

    if (
      focusId === 'europe' ||
      focusId === 'southern-eastern-africa' ||
      focusId === 'south-se-asia' ||
      focusId === 'oceania' ||
      focusId === 'americas-caribbean'
    ) {
      effectiveFocus = focusId;
    } else {
      // Infer from targetCountry when focusId is 'world' or 'tricky-borders'
      if (targetCountry.region === 'Europe') {
        effectiveFocus = 'europe';
      } else if (targetCountry.region === 'Africa') {
        effectiveFocus = 'southern-eastern-africa';
      } else if (targetCountry.region === 'Oceania') {
        effectiveFocus = 'oceania';
      } else if (targetCountry.region === 'Americas') {
        effectiveFocus = 'americas-caribbean';
      } else {
        effectiveFocus = 'south-se-asia';
      }
    }

    switch (effectiveFocus) {
      case 'europe': {
        const poolCountries = PLAYABLE_COUNTRIES.filter(
          (c) => c.region === 'Europe'
        );
        const expectedCountries = poolCountries.filter(
          (c) => c.coverageTier !== 'none' && c.drivingSide === 'left'
        );
        return {
          mapRegionLabel: 'Europe',
          suggestedRegionPreset: 'europe',
          poolCountries,
          expectedCountries,
          uncoveredNotes: [
            'Gibraltar (GI): UK territory on the Iberian Peninsula that switched to right-hand traffic in 1929 to match Spain.',
          ],
        };
      }
      case 'southern-eastern-africa': {
        const poolCountries = PLAYABLE_COUNTRIES.filter(
          (c) =>
            c.subregion === 'Southern Africa' || c.subregion === 'Eastern Africa'
        );
        const expectedCountries = poolCountries.filter(
          (c) => c.coverageTier !== 'none' && c.drivingSide === 'left'
        );
        const uncoveredLeft = poolCountries.filter(
          (c) => c.coverageTier === 'none' && c.drivingSide === 'left'
        );
        return {
          mapRegionLabel: 'Southern & Eastern Africa',
          suggestedRegionPreset: 'southern-eastern-africa',
          poolCountries,
          expectedCountries,
          uncoveredNotes: [
            ...uncoveredLeft.map(
              (c) =>
                `${c.name} (Left, None coverage): ${c.drivingNote ?? c.coverageNote}`
            ),
            'Rwanda (RW), Madagascar (MG) & Réunion (RE): Covered Eastern African countries/territories that drive on the RIGHT.',
          ],
        };
      }
      case 'south-se-asia': {
        const poolCountries = PLAYABLE_COUNTRIES.filter(
          (c) =>
            c.subregion === 'South Asia' || c.subregion === 'Southeast Asia'
        );
        const expectedCountries = poolCountries.filter(
          (c) => c.coverageTier !== 'none' && c.drivingSide === 'left'
        );
        const uncoveredLeft = poolCountries.filter(
          (c) => c.coverageTier === 'none' && c.drivingSide === 'left'
        );
        return {
          mapRegionLabel: 'South & SE Asia',
          suggestedRegionPreset: 'south-se-asia',
          poolCountries,
          expectedCountries,
          uncoveredNotes: [
            ...uncoveredLeft.map(
              (c) =>
                `${c.name} (Left, None coverage): ${c.drivingNote ?? c.coverageNote}`
            ),
            'Cambodia (KH), Laos (LA), Vietnam (VN) & Philippines (PH): Covered Southeast Asian nations that drive on the RIGHT.',
          ],
        };
      }
      case 'oceania': {
        const poolCountries = PLAYABLE_COUNTRIES.filter(
          (c) => c.region === 'Oceania'
        );
        const expectedCountries = poolCountries.filter(
          (c) => c.coverageTier !== 'none' && c.drivingSide === 'left'
        );
        return {
          mapRegionLabel: 'Oceania',
          suggestedRegionPreset: 'oceania',
          poolCountries,
          expectedCountries,
          uncoveredNotes: [
            'Guam (GU), Northern Mariana Islands (MP) & American Samoa (AS): U.S. Pacific territories in Oceania that drive on the RIGHT.',
          ],
        };
      }
      case 'americas-caribbean': {
        const poolCountries = PLAYABLE_COUNTRIES.filter(
          (c) => c.region === 'Americas'
        );
        const expectedCountries = poolCountries.filter(
          (c) => c.coverageTier !== 'none' && c.drivingSide === 'left'
        );
        const uncoveredLeft = poolCountries.filter(
          (c) => c.coverageTier === 'none' && c.drivingSide === 'left'
        );
        return {
          mapRegionLabel: 'Americas & Caribbean',
          suggestedRegionPreset: 'americas',
          poolCountries,
          expectedCountries,
          uncoveredNotes: [
            ...uncoveredLeft.map(
              (c) =>
                `${c.name} (Left, None coverage): ${c.drivingNote ?? c.coverageNote}`
            ),
            'Puerto Rico (PR) & Curaçao (CW): Covered Caribbean territories that drive on the RIGHT.',
          ],
        };
      }
    }
  }

  private buildDrivingMapTrial(
    country: PlayableCountry,
    isFollowUp: boolean
  ): PracticeTrial {
    const skillId = `drive:${country.id}`;
    const focusSpec = DRIVING_SIDE_FOCUS_MAP[this.activeDrivingFocus];
    const mapConfig = this.getDrivingMapRegionConfig(
      this.activeDrivingFocus,
      country
    );

    const expectedCountryIds = mapConfig.expectedCountries.map((c) => c.id);
    const promptTitle = `Click every left-driving covered country in ${mapConfig.mapRegionLabel}`;
    const promptDescription = `Select all ${expectedCountryIds.length} Playable Countries and territories in ${mapConfig.mapRegionLabel} that have Official or Limited Street View coverage and drive on the LEFT.`;

    const sample: LanguageSample = {
      id: `drive-map-${mapConfig.mapRegionLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      text: promptTitle,
      translation: promptDescription,
      kind: 'sign',
      tellIds: [],
      structuralClue:
        country.drivingNote ??
        `Left-driving covered countries in ${mapConfig.mapRegionLabel}: ${mapConfig.expectedCountries
          .map((c) => c.name)
          .join(', ')}.`,
    };

    return {
      trialNumber: this.sessionTrialCounter,
      section: 'driving-side',
      kind: 'driving-map',
      skillId,
      languageId: country.id,
      countryId: country.id,
      country,
      groupName: `Driving Side · ${focusSpec.name} · Regional Map Drill`,
      fluencyThresholdMs: MAP_BRIDGE_FLUENCY_THRESHOLD_MS,
      sample,
      drivingPrompt: {
        focusId: this.activeDrivingFocus,
        focusLabel: focusSpec.name,
        drillKind: 'driving-map',
        targetCountry: country,
        promptTitle,
        promptDescription,
        suggestedRegionPreset: mapConfig.suggestedRegionPreset,
        mapRegionLabel: mapConfig.mapRegionLabel,
        mapTargetSide: 'left',
        regionPoolCountries: mapConfig.poolCountries,
        expectedCountryIds,
        uncoveredCountryNotes: mapConfig.uncoveredNotes,
      },
      assisted: false,
      isFollowUp,
      options: [],
      startedAtMs: this.now(),
    };
  }

  private buildDrivingNarrowingTrial(
    country: PlayableCountry,
    isFollowUp: boolean
  ): PracticeTrial {
    // Ensure targetCountry for multi-clue narrowing is a covered Candidate Country
    let targetCountry = country;
    if (targetCountry.coverageTier === 'none') {
      const coveredInFocus = getCountriesForDrivingSideFocus(
        this.activeDrivingFocus
      ).filter((c) => c.coverageTier !== 'none');
      if (coveredInFocus.length > 0) {
        targetCountry = coveredInFocus[0];
        this.sessionLastPresentedAt.set(
          `drive:${targetCountry.id}`,
          this.sessionTrialCounter
        );
      }
    }

    const skillId = `drive:${targetCountry.id}`;
    const focusSpec = DRIVING_SIDE_FOCUS_MAP[this.activeDrivingFocus];
    const sideLabel =
      targetCountry.drivingSide === 'left'
        ? 'Left-hand traffic'
        : 'Right-hand traffic';

    // Determine whether to pair driving side with a Sign Text language sample or with a Script + Region clue
    const nonEnglishSignLangIds = targetCountry.signLanguages.filter(
      (id) => Boolean(LANGUAGE_MAP[id])
    );
    const useSignSampleClue =
      nonEnglishSignLangIds.length > 0 &&
      (targetCountry.region !== 'Africa' || this.sessionTrialCounter % 2 === 0);

    let narrowingFilter: DrivingSideNarrowingFilter;
    let promptTitle: string;
    let promptDescription: string;
    let narrowingClueSummary: string;
    let signLanguage: LanguageSpec | undefined;
    let signSample: LanguageSample | undefined;
    let matchedTells: TellSpanMatch[] = [];

    if (useSignSampleClue) {
      const chosenLangId = nonEnglishSignLangIds[0];
      signLanguage = LANGUAGE_MAP[chosenLangId];
      const signCandidates = signLanguage.samples.filter(
        (s) => s.kind === 'sign'
      );
      signSample =
        signCandidates.length > 0
          ? signCandidates[this.sessionTrialCounter % signCandidates.length]
          : signLanguage.samples[0];
      matchedTells = findTellMatchesInSample(signSample, signLanguage);

      narrowingFilter = {
        drivingSide: targetCountry.drivingSide,
        languageId: signLanguage.id,
      };
      promptTitle = `${sideLabel} + Sign Text sample (${signLanguage.name}) → Select the Candidate Countries`;
      promptDescription = `Combine ${sideLabel.toLowerCase()} with the ${signLanguage.name} (${signLanguage.script}) Sign Text clue below and select every matching Street View-covered Playable Country.`;
      narrowingClueSummary = `${sideLabel} + ${signLanguage.name} Sign Text ("${signSample.text}")`;
    } else {
      const scripts = getCountryScripts(targetCountry);
      const primaryScript = scripts[0] ?? 'Latin';
      narrowingFilter = {
        drivingSide: targetCountry.drivingSide,
        region: targetCountry.region,
        script: primaryScript,
      };
      promptTitle = `${sideLabel} + ${primaryScript} script in ${targetCountry.region} → Select the Candidate Countries`;
      promptDescription = `Combine ${sideLabel.toLowerCase()} with ${primaryScript} script road signage in ${targetCountry.region} and select every matching Street View-covered Playable Country.`;
      narrowingClueSummary = `${sideLabel} + ${primaryScript} script in ${targetCountry.region}`;
    }

    const narrowingResult =
      computeDrivingSideNarrowingCandidates(narrowingFilter);
    const expectedCountryIds = narrowingResult.candidateCountryIds;
    const suggestedRegionPreset = inferBestRegionPresetForCountries(
      narrowingResult.candidateCountries.length > 0
        ? narrowingResult.candidateCountries
        : [targetCountry]
    );

    const sample: LanguageSample = signSample ?? {
      id: `drive-narrow-${targetCountry.id}-${this.sessionTrialCounter}`,
      text: promptTitle,
      translation: `Candidate Countries: ${narrowingResult.candidateCountries
        .map((c) => c.name)
        .join(', ')}`,
      kind: 'sign',
      tellIds: [],
      structuralClue:
        targetCountry.drivingNote ??
        `${narrowingClueSummary} narrows to: ${narrowingResult.candidateCountries
          .map((c) => c.name)
          .join(', ')}.`,
    };

    const regionPoolCountries = PLAYABLE_COUNTRIES.filter(
      (c) => c.region === targetCountry.region
    );

    return {
      trialNumber: this.sessionTrialCounter,
      section: 'driving-side',
      kind: 'driving-narrowing',
      skillId,
      languageId: signLanguage?.id ?? targetCountry.id,
      countryId: targetCountry.id,
      country: targetCountry,
      groupName: `Driving Side · ${focusSpec.name} · Multi-Clue Narrowing`,
      fluencyThresholdMs: MAP_BRIDGE_FLUENCY_THRESHOLD_MS,
      sample,
      drivingPrompt: {
        focusId: this.activeDrivingFocus,
        focusLabel: focusSpec.name,
        drillKind: 'driving-narrowing',
        targetCountry,
        promptTitle,
        promptDescription,
        suggestedRegionPreset,
        mapRegionLabel: targetCountry.region,
        mapTargetSide: targetCountry.drivingSide,
        regionPoolCountries,
        expectedCountryIds,
        narrowingFilter,
        narrowingClueSummary,
        signLanguage,
        signSample,
        matchedTells,
        uncoveredCountryNotes: narrowingResult.uncoveredCountryNotes,
      },
      assisted: false,
      isFollowUp,
      options: [],
      startedAtMs: this.now(),
    };
  }

  private selectNextDrivingCountryByArts(
    pool: PlayableCountry[]
  ): PlayableCountry {
    const state = this.store.getState();

    const scored = pool.map((country, index) => {
      const skillId = `drive:${country.id}`;
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
        // Unseen skill: introduce in focus order (which prioritizes tricky left-driving countries and regional borders)
        priority = 2.0 - index * 0.01 + confusionBoost;
      } else {
        const lastAttempt = record.attempts[record.attempts.length - 1];
        priority = computeArtsPriority({
          trialsSinceLastSeen,
          lastCorrect: lastAttempt.correct,
          lastAssisted: lastAttempt.assisted,
          lastResponseTimeMs: lastAttempt.responseTimeMs,
          fluencyThresholdMs: DRIVING_SIDE_FLUENCY_THRESHOLD_MS,
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

  private collectDrivingBorderContrastNotes(
    targetCountry: PlayableCountry,
    contextCountries?: PlayableCountry[]
  ): DrivingSideBorderContrastNote[] {
    const notes: DrivingSideBorderContrastNote[] = [];
    const seen = new Set<string>([targetCountry.id]);

    const oppositeSide: DrivingSide =
      targetCountry.drivingSide === 'left' ? 'right' : 'left';

    const pool = contextCountries ?? PLAYABLE_COUNTRIES;
    // 1. Countries in the same subregion with the opposite driving side
    const sameSubregionOpposite = pool.filter(
      (c) =>
        !seen.has(c.id) &&
        c.subregion === targetCountry.subregion &&
        c.drivingSide === oppositeSide
    );
    // 2. Countries in the same region with the opposite driving side
    const sameRegionOpposite = pool.filter(
      (c) =>
        !seen.has(c.id) &&
        c.region === targetCountry.region &&
        c.subregion !== targetCountry.subregion &&
        c.drivingSide === oppositeSide
    );
    // 3. Same-side neighbors in the same subregion
    const sameSubregionSameSide = pool.filter(
      (c) =>
        !seen.has(c.id) &&
        c.subregion === targetCountry.subregion &&
        c.drivingSide === targetCountry.drivingSide
    );

    for (const c of [
      ...sameSubregionOpposite,
      ...sameRegionOpposite,
      ...sameSubregionSameSide,
    ]) {
      if (notes.length >= 5) break;
      if (!seen.has(c.id)) {
        seen.add(c.id);
        notes.push(toDrivingBorderContrastNote(c));
      }
    }

    return notes;
  }

  private toUnifiedDrivingLanguageFeedback(
    trial: PracticeTrial,
    drv: DrivingSideTrialFeedback
  ): LanguageTrialFeedback {
    return {
      correct: drv.correct,
      assisted: drv.assisted,
      skillId: drv.skillId,
      languageId: drv.countryId,
      languageName: drv.countryName,
      nativeName: `${drv.drivingSide.toUpperCase()}-Hand Traffic`,
      chosenOptionId: drv.chosenOptionId,
      chosenLanguageName: drv.chosenLabel,
      responseTimeMs: drv.responseTimeMs,
      fluencyTargetMs: drv.fluencyTargetMs,
      isFluentSpeed: drv.isFluentSpeed,
      previousMastery: drv.previousMastery,
      newMastery: drv.newMastery,
      sample: trial.sample,
      translation: drv.drivingNote,
      matchedTells: trial.drivingPrompt?.matchedTells ?? [],
      structuralClue: drv.drivingNote,
      gestaltNote: drv.drivingNote,
      contrastNote: drv.drivingNote,
      candidateCountries:
        drv.country.coverageTier !== 'none' ? [drv.country] : [],
      uncoveredCountryNotes: drv.uncoveredCountryNotes,
      mapEvaluation: drv.mapEvaluation,
      countryId: drv.countryId,
      country: drv.country,
      coverageTier: drv.country.coverageTier,
      coverageNote: drv.country.coverageNote,
      mapHighlightedCountryIds: drv.mapHighlightedCountryIds,
      drivingSide: drv.drivingSide,
      drivingNote: drv.drivingNote,
      borderContrastNotes: drv.borderContrastNotes,
      drivingFeedback: drv,
    };
  }
}
