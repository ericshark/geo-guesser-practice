import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { AnswerResult, ClueRecord, StoredCard } from '../storage/schema.ts';

/** Fuzz is off so scheduling is deterministic and testable. 90% target recall is the FSRS default. */
const scheduler = fsrs({ enable_fuzz: false, request_retention: 0.9 });

/** A correct answer faster than this counts as "easy" (only once the clue is established). */
export const FAST_ANSWER_MS = 4000;

export function gradeFor(result: AnswerResult, responseTimeMs: number, priorReps: number): Grade {
  if (result === 'wrong') return Rating.Again;
  if (result === 'hint') return Rating.Hard;
  return priorReps >= 2 && responseTimeMs <= FAST_ANSWER_MS ? Rating.Easy : Rating.Good;
}

function toStored(card: Card): StoredCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString(),
  };
}

function fromStored(card: StoredCard): Card {
  return {
    ...card,
    state: card.state as State,
    due: new Date(card.due),
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}

/** Applies one answer to a clue's schedule and returns the updated record. */
export function reviewClue(
  previous: ClueRecord | undefined,
  result: AnswerResult,
  responseTimeMs: number,
  now: Date
): ClueRecord {
  const card = previous ? fromStored(previous.card) : createEmptyCard(now);
  const grade = gradeFor(result, responseTimeMs, previous?.card.reps ?? 0);
  const next = scheduler.next(card, now, grade).card;
  return {
    card: toStored(next),
    seen: (previous?.seen ?? 0) + 1,
    correct: (previous?.correct ?? 0) + (result === 'correct' ? 1 : 0),
    lastResult: result,
    lastAt: now.toISOString(),
  };
}

export function isDue(record: ClueRecord | undefined, now: Date): boolean {
  return Boolean(record) && new Date(record!.card.due).getTime() <= now.getTime();
}

/** Whether the card is in an FSRS (re)learning step rather than long-term review. */
export function isLearningState(record: ClueRecord): boolean {
  return record.card.state === State.Learning || record.card.state === State.Relearning;
}
