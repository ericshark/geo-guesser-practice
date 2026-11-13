import { CLUES, CLUE_MAP, type Clue, type Stimulus } from '../content/index.ts';
import { shuffle, type Rng } from './random.ts';

export interface Option {
  /** A clue id, or a foil id (`foil-...`) for answers that are not clues. */
  id: string;
  label: string;
  sublabel?: string;
  isFoil: boolean;
}

export interface Question {
  id: string;
  clueId: string;
  stem: string;
  stimulus: Stimulus;
  stimulusIndex: number;
  options: Option[];
  correctId: string;
}

const OPTION_COUNT = 4;

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

export function buildQuestion(
  clue: Clue,
  rng: Rng,
  options: { avoidStimulusIndex?: number } = {}
): Question {
  const indices = clue.stimuli.map((_, i) => i);
  const preferred = indices.filter((i) => i !== options.avoidStimulusIndex);
  const pool = preferred.length > 0 ? preferred : indices;
  const stimulusIndex = pool[Math.floor(rng() * pool.length)];

  const distractors = pickDistractors(clue, rng, OPTION_COUNT - 1);
  const all = shuffle([clueOption(clue), ...distractors], rng);

  return {
    id: `${clue.id}#${stimulusIndex}#${Math.floor(rng() * 1e9)}`,
    clueId: clue.id,
    stem: clue.stem,
    stimulus: clue.stimuli[stimulusIndex],
    stimulusIndex,
    options: all,
    correctId: clue.id,
  };
}
