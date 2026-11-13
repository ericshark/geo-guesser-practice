import { CLUE_MAP, type Clue } from '../content/index.ts';
import { matchTells } from '../data/tells.ts';
import { buildHighlightedTextSegments, type TextSegment } from '../utils/highlightSpans.ts';
import type { Question } from './questionGen.ts';

export interface ExplainSide {
  label: string;
  subtitle?: string;
  spot: string;
  detail: string[];
  countryIds: string[];
}

export interface Explanation {
  /** What the learner should have recognised. */
  right: ExplainSide;
  /** What they picked instead, when they were wrong. */
  wrong?: ExplainSide;
  /** One line on how to tell the two apart. */
  contrast?: string;
}

function side(clue: Clue): ExplainSide {
  return {
    label: clue.title,
    subtitle: clue.subtitle,
    spot: clue.spot,
    detail: clue.detail,
    countryIds: clue.countryIds,
  };
}

export function explain(question: Question, chosenId: string | null): Explanation {
  const correct = CLUE_MAP[question.clueId];
  const right = side(correct);
  if (!chosenId || chosenId === question.correctId) return { right };

  const chosenClue = CLUE_MAP[chosenId];
  if (chosenClue) {
    const declared = correct.confusables.find((c) => c.clueId === chosenId);
    return {
      right,
      wrong: side(chosenClue),
      contrast: declared?.howToTell ?? correct.spot,
    };
  }

  const foil = correct.foils.find((f) => f.id === chosenId);
  return {
    right,
    wrong: foil ? { label: foil.label, spot: foil.note, detail: [], countryIds: [] } : undefined,
    contrast: correct.spot,
  };
}

/** Splits a stimulus into plain and highlighted pieces, using the clue's tells. */
export function highlightStimulus(clue: Clue, text: string, tellIds: string[] = []): TextSegment[] {
  // Only the tells this stimulus is meant to teach are highlighted, so nothing misleading lights up.
  return buildHighlightedTextSegments(text, matchTells(text, clue.tells, tellIds, true));
}
