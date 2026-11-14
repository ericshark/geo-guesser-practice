import { CLUES, CLUE_MAP, type Clue, type Stimulus } from '../content/index.ts';
import { PLAYABLE_COUNTRIES, PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import { shuffle, type Rng } from './random.ts';

export interface Option {
  /** A clue id, or a foil id (`foil-...`) for answers that are not clues. */
  id: string;
  label: string;
  sublabel?: string;
  isFoil: boolean;
}

/** One side of a side-by-side question: a clue plus the sample of it that is shown. */
export interface PairOption extends Option {
  stimulus: Stimulus;
  stimulusIndex: number;
}

interface QuestionBase {
  id: string;
  clueId: string;
  stem: string;
  stimulus: Stimulus;
  stimulusIndex: number;
  /** For `choice` and `pair` the id of the right option; for `map` the sorted target ids joined by commas. */
  correctId: string;
}

/** Four options, one right: the default. */
export interface ChoiceQuestion extends QuestionBase {
  kind: 'choice';
  options: Option[];
}

/** Two samples side by side (the clue and its closest look-alike): which one is the clue? */
export interface PairQuestion extends QuestionBase {
  kind: 'pair';
  options: PairOption[];
}

/** Click every country on the map that the clue applies to. */
export interface MapQuestion extends QuestionBase {
  kind: 'map';
  /** Countries that must be selected. */
  targetIds: string[];
  /** Countries that can be clicked: the targets plus other covered countries in the same regions. */
  candidateIds: string[];
}

export type Question = ChoiceQuestion | PairQuestion | MapQuestion;
export type QuestionKind = Question['kind'];

const OPTION_COUNT = 4;
/** Map questions only make sense for a handful of countries: one is a plain choice, a dozen is a chore. */
export const MAP_MIN_COUNTRIES = 2;
export const MAP_MAX_COUNTRIES = 6;
/** Chance that a clue which supports a different format is asked in it. */
const VARIANT_CHANCE = 0.4;

function clueOption(clue: Clue): Option {
  // For visual clues the subtitle describes the picture, so showing it would give the answer away.
  const hidesSubtitle = clue.stimuli.some((s) => s.visual);
  return { id: clue.id, label: clue.title, sublabel: hidesSubtitle ? undefined : clue.subtitle, isFoil: false };
}

/**
 * Picks distractors that are genuinely confusable: declared look-alikes first, then the rest
 * of the clue's choice group, then explicit foils. This is what makes practice discriminative.
 */
function pickDistractors(clue: Clue, rng: Rng, needed: number): Option[] {
  const chosen: Option[] = [];
  const used = new Set<string>([clue.id]);
  const add = (option: Option) => {
    if (chosen.length < needed && !used.has(option.id)) {
      used.add(option.id);
      chosen.push(option);
    }
  };

  for (const c of shuffle(clue.confusables, rng)) {
    const other = CLUE_MAP[c.clueId];
    if (other && other.choiceGroup === clue.choiceGroup) add(clueOption(other));
  }

  if (clue.choiceGroup) {
    const peers = CLUES.filter((c) => c.choiceGroup === clue.choiceGroup && c.id !== clue.id);
    for (const peer of shuffle(peers, rng)) add(clueOption(peer));
  }

  for (const foil of shuffle(clue.foils, rng)) {
    add({ id: foil.id, label: foil.label, isFoil: true });
  }

  return chosen;
}

/** True when a sample can be put in front of the learner on its own (a picture or real text). */
function isShowable(stimulus: Stimulus): boolean {
  return Boolean(stimulus.visual) || stimulus.kind !== 'plain' || Boolean(stimulus.mono);
}

function showableIndices(clue: Clue): number[] {
  return clue.stimuli.flatMap((s, i) => (isShowable(s) ? [i] : []));
}

/** Countries a map question may use as targets: all known, and between two and six of them. */
function mapTargets(clue: Clue): string[] {
  const ids = [...new Set(clue.countryIds.filter((id) => PLAYABLE_COUNTRY_MAP[id]))];
  return ids.length >= MAP_MIN_COUNTRIES && ids.length <= MAP_MAX_COUNTRIES ? ids : [];
}

/** The look-alike clues that can be shown beside this clue in a side-by-side question. */
function pairPartners(clue: Clue): Clue[] {
  if (showableIndices(clue).length === 0) return [];
  return clue.confusables
    .map((c) => CLUE_MAP[c.clueId])
    .filter((other): other is Clue => Boolean(other) && other.id !== clue.id && other.topicId === clue.topicId)
    .filter((other) => showableIndices(other).length > 0);
}

/** Which formats a clue can be asked in. `choice` is always possible. */
export function supportedKinds(clue: Clue): QuestionKind[] {
  const kinds: QuestionKind[] = ['choice'];
  if (mapTargets(clue).length > 0) kinds.push('map');
  if (pairPartners(clue).length > 0) kinds.push('pair');
  return kinds;
}

/**
 * Picks the format for a question. The learner never chooses it: it follows from what the clue
 * supports. A clue's first question is always a plain choice (the learner has just studied it), and
 * after that a clue that supports another format is asked in it some of the time.
 */
export function pickQuestionKind(clue: Clue, rng: Rng, timesSeen: number): QuestionKind {
  if (timesSeen < 1) return 'choice';
  const variants = supportedKinds(clue).filter((k) => k !== 'choice');
  if (variants.length === 0 || rng() >= VARIANT_CHANCE) return 'choice';
  return variants[Math.floor(rng() * variants.length)];
}

function pickIndex(indices: number[], avoid: number | undefined, rng: Rng): number {
  const preferred = indices.filter((i) => i !== avoid);
  const pool = preferred.length > 0 ? preferred : indices;
  return pool[Math.floor(rng() * pool.length)];
}

function questionId(clue: Clue, stimulusIndex: number, rng: Rng, kind: QuestionKind): string {
  return `${clue.id}#${stimulusIndex}#${kind}#${Math.floor(rng() * 1e9)}`;
}

function buildMapQuestion(clue: Clue, targets: string[], stimulusIndex: number, rng: Rng): MapQuestion {
  const regions = new Set(clue.regions);
  const candidates = PLAYABLE_COUNTRIES.filter(
    (c) => targets.includes(c.id) || (regions.has(c.region) && c.coverageTier !== 'none')
  ).map((c) => c.id);
  return {
    kind: 'map',
    id: questionId(clue, stimulusIndex, rng, 'map'),
    clueId: clue.id,
    stem: 'Click every country this applies to.',
    stimulus: clue.stimuli[stimulusIndex],
    stimulusIndex,
    targetIds: [...targets].sort(),
    candidateIds: candidates,
    correctId: [...targets].sort().join(','),
  };
}

function buildPairQuestion(clue: Clue, partners: Clue[], stimulusIndex: number, rng: Rng): PairQuestion {
  const partner = partners[Math.floor(rng() * partners.length)];
  const partnerIndex = pickIndex(showableIndices(partner), undefined, rng);
  const mine: PairOption = {
    ...clueOption(clue),
    sublabel: undefined,
    stimulus: clue.stimuli[stimulusIndex],
    stimulusIndex,
  };
  const theirs: PairOption = {
    ...clueOption(partner),
    sublabel: undefined,
    stimulus: partner.stimuli[partnerIndex],
    stimulusIndex: partnerIndex,
  };
  return {
    kind: 'pair',
    id: questionId(clue, stimulusIndex, rng, 'pair'),
    clueId: clue.id,
    stem: `Which one is ${clue.title}?`,
    stimulus: clue.stimuli[stimulusIndex],
    stimulusIndex,
    options: shuffle([mine, theirs], rng),
    correctId: clue.id,
  };
}

export function buildQuestion(
  clue: Clue,
  rng: Rng,
  options: { avoidStimulusIndex?: number; timesSeen?: number; forceKind?: QuestionKind } = {}
): Question {
  const kind = options.forceKind ?? pickQuestionKind(clue, rng, options.timesSeen ?? 0);
  const all = clue.stimuli.map((_, i) => i);

  if (kind === 'map') {
    const targets = mapTargets(clue);
    if (targets.length > 0) return buildMapQuestion(clue, targets, pickIndex(all, options.avoidStimulusIndex, rng), rng);
  }
  if (kind === 'pair') {
    const partners = pairPartners(clue);
    if (partners.length > 0) {
      return buildPairQuestion(clue, partners, pickIndex(showableIndices(clue), options.avoidStimulusIndex, rng), rng);
    }
  }

  const stimulusIndex = pickIndex(all, options.avoidStimulusIndex, rng);
  const distractors = pickDistractors(clue, rng, OPTION_COUNT - 1);
  return {
    kind: 'choice',
    id: questionId(clue, stimulusIndex, rng, 'choice'),
    clueId: clue.id,
    stem: clue.stem,
    stimulus: clue.stimuli[stimulusIndex],
    stimulusIndex,
    options: shuffle([clueOption(clue), ...distractors], rng),
    correctId: clue.id,
  };
}

/** The selection a map answer is graded on: exactly the target countries, nothing more or less. */
export function serializeSelection(ids: Iterable<string>): string {
  return [...new Set(ids)].sort().join(',');
}

export function gradeMapSelection(question: MapQuestion, selectedIds: string[]) {
  const picked = new Set(selectedIds);
  const targets = new Set(question.targetIds);
  return {
    correct: serializeSelection(picked) === question.correctId,
    missed: question.targetIds.filter((id) => !picked.has(id)),
    extra: [...picked].filter((id) => !targets.has(id)),
  };
}
