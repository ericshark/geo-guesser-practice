import { CLUES, CLUE_MAP, cluesForLesson, LESSON_MAP, TOPIC_MAP, type Clue } from '../content/index.ts';
import type { WorldRegion } from '../data/types.ts';
import type { ProgressData } from '../storage/schema.ts';
import { isDue } from './scheduler.ts';
import { shuffle, type Rng } from './random.ts';

export const SESSION_LENGTH = 12;
const MAX_DUE_EXTRAS_IN_LESSON = 3;
const DAY_MS = 86_400_000;

export type PracticeRegion = 'all' | WorldRegion;

export type SessionScope =
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'review' }
  | { kind: 'mixed'; region: PracticeRegion }
  | { kind: 'confusion'; clueIds: string[]; label: string }
  | { kind: 'country'; countryId: string; label: string };

export interface SessionPlan {
  scope: SessionScope;
  title: string;
  subtitle: string;
  /** New clues to study before the questions start. */
  study: Clue[];
  /** Clue ids in the order they are asked. */
  queue: string[];
  /** Set when there is nothing to practise, so the UI can explain why. */
  emptyReason?: string;
}

/** Reorders so the same choice group is not asked twice in a row when avoidable (interleaving). */
export function interleave(clueIds: string[]): string[] {
  const remaining = [...clueIds];
  const out: string[] = [];
  while (remaining.length > 0) {
    const last = out.length > 0 ? CLUE_MAP[out[out.length - 1]] : undefined;
    let idx = remaining.findIndex((id) => {
      const clue = CLUE_MAP[id];
      return !last || id !== last.id && clue.choiceGroup !== last.choiceGroup;
    });
    if (idx === -1) idx = remaining.findIndex((id) => id !== last?.id);
    if (idx === -1) idx = 0;
    out.push(remaining.splice(idx, 1)[0]);
  }
  return out;
}

/** Avoids asking the same clue back-to-back by swapping with a later different one. */
function separateRepeats(queue: string[]): string[] {
  const out = [...queue];
  for (let i = 1; i < out.length; i += 1) {
    if (out[i] !== out[i - 1]) continue;
    const swapWith = out.findIndex((id, j) => j > i && id !== out[i]);
    if (swapWith !== -1) [out[i], out[swapWith]] = [out[swapWith], out[i]];
  }
  return out;
}

function priority(clue: Clue, progress: ProgressData, now: Date, rng: Rng): number {
  const record = progress.clues[clue.id];
  if (!record) return 0;
  let score = 0;
  if (isDue(record, now)) {
    score += 10 + Math.min(10, (now.getTime() - new Date(record.card.due).getTime()) / DAY_MS);
  } else {
    score += 4 / (1 + record.card.stability);
  }
  if (record.lastResult !== 'correct') score += 3;
  const confusionCount = Object.values(progress.confusions[clue.id] ?? {}).reduce((a, b) => a + b, 0);
  score += Math.min(3, confusionCount * 0.5);
  return score + rng() * 1.5; // noise keeps sessions from always showing the same items
}

export function dueClues(progress: ProgressData, now: Date): Clue[] {
  return CLUES.filter((c) => isDue(progress.clues[c.id], now)).sort(
    (a, b) =>
      new Date(progress.clues[a.id].card.due).getTime() -
      new Date(progress.clues[b.id].card.due).getTime()
  );
}

function learned(progress: ProgressData): Clue[] {
  return CLUES.filter((c) => progress.clues[c.id]);
}

function lessonPlan(lessonId: string, progress: ProgressData, now: Date, rng: Rng): SessionPlan {
  const lesson = LESSON_MAP[lessonId];
  const topic = TOPIC_MAP[lesson.topicId];
  const clues = cluesForLesson(lessonId);
  const study = clues.filter((c) => !progress.clues[c.id]);

  // New clues are asked twice (immediate retrieval, then again after other items); known ones once.
  const first = clues.map((c) => c.id);
  const second = clues
    .filter((c) => !progress.clues[c.id] || progress.clues[c.id].lastResult !== 'correct')
    .map((c) => c.id);
  const rotated = second.length > 1 ? [...second.slice(Math.ceil(second.length / 2)), ...second.slice(0, Math.ceil(second.length / 2))] : second;
  let queue = [...first, ...rotated];

  // Fold in a few due clues from earlier lessons (spaced review inside new learning).
  const extras = dueClues(progress, now)
    .filter((c) => c.lessonId !== lessonId)
    .slice(0, MAX_DUE_EXTRAS_IN_LESSON)
    .map((c) => c.id);
  extras.forEach((id, i) => {
    queue.splice(Math.min(queue.length, 3 + i * 3), 0, id);
  });
  queue = separateRepeats(queue);

  return {
    scope: { kind: 'lesson', lessonId },
    title: lesson.title,
    subtitle: `${topic.title} · ${study.length > 0 ? `${study.length} new clue${study.length === 1 ? '' : 's'}` : 'review lesson'}`,
    study,
    queue,
  };
}

function poolPlan(
  scope: SessionScope,
  title: string,
  subtitle: string,
  pool: Clue[],
  progress: ProgressData,
  now: Date,
  rng: Rng,
  emptyReason: string
): SessionPlan {
  const ranked = [...pool]
    .map((c) => ({ c, p: priority(c, progress, now, rng) }))
    .sort((a, b) => b.p - a.p)
    .slice(0, SESSION_LENGTH)
    .map((x) => x.c.id);
  return {
    scope,
    title,
    subtitle,
    study: [],
    queue: interleave(ranked),
    emptyReason: ranked.length === 0 ? emptyReason : undefined,
  };
}

export function buildSession(
  scope: SessionScope,
  progress: ProgressData,
  now: Date = new Date(),
  rng: Rng = Math.random
): SessionPlan {
  switch (scope.kind) {
    case 'lesson':
      return lessonPlan(scope.lessonId, progress, now, rng);

    case 'review': {
      const due = dueClues(progress, now).slice(0, SESSION_LENGTH);
      return {
        scope,
        title: 'Review',
        subtitle: `${due.length} clue${due.length === 1 ? '' : 's'} due`,
        study: [],
        queue: interleave(due.map((c) => c.id)),
        emptyReason: due.length === 0 ? 'Nothing is due right now. Come back later or start a lesson.' : undefined,
      };
    }

    case 'mixed': {
      const pool = learned(progress).filter(
        (c) => scope.region === 'all' || c.regions.includes(scope.region)
      );
      return poolPlan(
        scope,
        scope.region === 'all' ? 'Mixed practice' : `Mixed practice · ${scope.region}`,
        scope.region === 'all' ? 'Everything you have learned' : `Clues you have learned that apply to ${scope.region}`,
        pool,
        progress,
        now,
        rng,
        scope.region === 'all'
          ? 'Complete a lesson first; practice draws on what you have learned.'
          : `You have not learned any clues for ${scope.region} yet.`
      );
    }

    case 'confusion': {
      const ids = scope.clueIds.filter((id) => CLUE_MAP[id]);
      const queue = separateRepeats([...ids, ...shuffle(ids, rng)]);
      return {
        scope,
        title: `Tell apart: ${scope.label}`,
        subtitle: 'Look-alikes you have mixed up',
        study: [],
        queue,
        emptyReason: queue.length === 0 ? 'No mix-ups to drill.' : undefined,
      };
    }

    case 'country': {
      const clues = CLUES.filter((c) => c.countryIds.includes(scope.countryId));
      const study = clues.filter((c) => !progress.clues[c.id]);
      const queue = separateRepeats([...clues.map((c) => c.id), ...shuffle(clues.map((c) => c.id), rng)]);
      return {
        scope,
        title: scope.label,
        subtitle: `${clues.length} clue${clues.length === 1 ? '' : 's'} for this country`,
        study,
        queue: queue.slice(0, SESSION_LENGTH),
        emptyReason: clues.length === 0 ? 'No clues cover this country yet.' : undefined,
      };
    }
  }
}

/**
 * After a miss, ask the clue again a few questions later (once per session) so the correction
 * is retrieved, not just read.
 */
export function requeueMissed(queue: string[], currentIndex: number, clueId: string): string[] {
  const out = [...queue];
  out.splice(Math.min(out.length, currentIndex + 4), 0, clueId);
  return out;
}
