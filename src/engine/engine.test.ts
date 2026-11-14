import { describe, expect, it } from 'vitest';
import { CLUES, LESSONS } from '../content/index.ts';
import { createInitialProgressData, type ProgressData } from '../storage/schema.ts';
import { nextAction, nextLesson, topConfusions } from './curriculum.ts';
import { masteryOf } from './mastery.ts';
import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import {
  buildQuestion,
  gradeMapSelection,
  MAP_MAX_COUNTRIES,
  MAP_MIN_COUNTRIES,
  pickQuestionKind,
  serializeSelection,
  supportedKinds,
} from './questionGen.ts';
import { seededRng } from './random.ts';
import { gradeFor, isDue, reviewClue } from './scheduler.ts';
import { buildSession, dueClues, interleave, requeueMissed, SESSION_LENGTH } from './sessionBuilder.ts';
import { Rating } from 'ts-fsrs';

const T0 = new Date('2026-03-01T09:00:00Z');
const days = (n: number) => new Date(T0.getTime() + n * 86_400_000);

describe('scheduler', () => {
  it('maps answers to FSRS grades', () => {
    expect(gradeFor('wrong', 1000, 5)).toBe(Rating.Again);
    expect(gradeFor('hint', 1000, 5)).toBe(Rating.Hard);
    expect(gradeFor('correct', 9000, 5)).toBe(Rating.Good);
    expect(gradeFor('correct', 1000, 0)).toBe(Rating.Good); // never "easy" on a first sight
    expect(gradeFor('correct', 1000, 3)).toBe(Rating.Easy);
  });

  it('spaces successful reviews further apart and brings failures back soon', () => {
    let rec = reviewClue(undefined, 'correct', 3000, T0);
    let now = new Date(rec.card.due);
    rec = reviewClue(rec, 'correct', 3000, now);
    now = new Date(rec.card.due);
    rec = reviewClue(rec, 'correct', 3000, now);
    const gapGood = new Date(rec.card.due).getTime() - now.getTime();
    expect(gapGood).toBeGreaterThan(3 * 86_400_000);

    const failed = reviewClue(rec, 'wrong', 3000, new Date(rec.card.due));
    const gapFail = new Date(failed.card.due).getTime() - new Date(rec.card.due).getTime();
    expect(gapFail).toBeLessThan(86_400_000);
    expect(failed.card.lapses).toBe(1);
  });

  it('knows when a clue is due', () => {
    const rec = reviewClue(undefined, 'correct', 3000, T0);
    expect(isDue(rec, T0)).toBe(false);
    expect(isDue(rec, days(30))).toBe(true);
    expect(isDue(undefined, days(30))).toBe(false);
  });
});

describe('mastery', () => {
  it('starts new, becomes learning, and only reaches mastered through spaced successes', () => {
    expect(masteryOf(undefined)).toBe('new');
    let rec = reviewClue(undefined, 'correct', 3000, T0);
    expect(masteryOf(rec)).toBe('learning');
    let now = T0;
    for (let i = 0; i < 6; i += 1) {
      now = new Date(rec.card.due);
      rec = reviewClue(rec, 'correct', 2000, now);
    }
    expect(['familiar', 'mastered']).toContain(masteryOf(rec));
    expect(masteryOf(reviewClue(rec, 'wrong', 2000, new Date(rec.card.due)))).toBe('learning');
  });
});

function progressWith(ids: string[], result: 'correct' | 'wrong' = 'correct'): ProgressData {
  const p = createInitialProgressData(T0);
  for (const id of ids) p.clues[id] = reviewClue(undefined, result, 3000, T0);
  return p;
}

describe('session builder', () => {
  const lesson = LESSONS.find((l) => l.id.startsWith('lang-romance'))!;

  it('a new lesson studies every new clue and asks each at least twice', () => {
    const plan = buildSession({ kind: 'lesson', lessonId: lesson.id }, createInitialProgressData(T0), T0, seededRng(1));
    expect(plan.study.map((c) => c.id)).toEqual(lesson.clueIds);
    for (const id of lesson.clueIds) expect(plan.queue.filter((q) => q === id).length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < plan.queue.length; i += 1) expect(plan.queue[i]).not.toBe(plan.queue[i - 1]);
  });

  it('folds due clues from earlier lessons into a new lesson', () => {
    const earlier = CLUES.find((c) => c.lessonId !== lesson.id)!;
    const progress = progressWith([earlier.id]);
    const plan = buildSession({ kind: 'lesson', lessonId: lesson.id }, progress, days(10), seededRng(1));
    expect(plan.queue).toContain(earlier.id);
  });

  it('review contains only due clues, most overdue first', () => {
    const [a, b, c] = CLUES;
    const progress = createInitialProgressData(T0);
    progress.clues[a.id] = reviewClue(undefined, 'correct', 3000, days(0));
    progress.clues[b.id] = reviewClue(undefined, 'correct', 3000, days(-5));
    progress.clues[c.id] = reviewClue(undefined, 'correct', 3000, days(40));
    const due = dueClues(progress, days(2)).map((x) => x.id);
    expect(due).toEqual([b.id, a.id]);
    const plan = buildSession({ kind: 'review' }, progress, days(2), seededRng(1));
    expect(new Set(plan.queue)).toEqual(new Set([a.id, b.id]));
  });

  it('mixed practice only uses learned clues and respects the region', () => {
    const european = CLUES.filter((c) => c.regions.includes('Europe')).slice(0, 8);
    const asian = CLUES.filter((c) => c.regions.length === 1 && c.regions[0] === 'Asia').slice(0, 4);
    const progress = progressWith([...european, ...asian].map((c) => c.id));
    const plan = buildSession({ kind: 'mixed', region: 'Europe' }, progress, T0, seededRng(2));
    expect(plan.queue.length).toBeGreaterThan(0);
    expect(plan.queue.length).toBeLessThanOrEqual(SESSION_LENGTH);
    for (const id of plan.queue) expect(european.map((c) => c.id)).toContain(id);

    const none = buildSession({ kind: 'mixed', region: 'all' }, createInitialProgressData(T0), T0, seededRng(2));
    expect(none.queue).toHaveLength(0);
    expect(none.emptyReason).toBeTruthy();
  });

  it('interleaves choice groups when it can', () => {
    const lang = CLUES.filter((c) => c.topicId === 'languages').slice(0, 12);
    const out = interleave(lang.map((c) => c.id));
    expect(new Set(out)).toEqual(new Set(lang.map((c) => c.id)));
    const same = out.filter((id, i) => i > 0 && CLUES.find((c) => c.id === id)!.choiceGroup === CLUES.find((c) => c.id === out[i - 1])!.choiceGroup);
    expect(same.length).toBeLessThan(out.length - 1);
  });

  it('re-asks a missed clue a few questions later', () => {
    const q = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(requeueMissed(q, 1, 'b')).toEqual(['a', 'b', 'c', 'd', 'e', 'b', 'f']);
    expect(requeueMissed(['a', 'b'], 1, 'b')).toEqual(['a', 'b', 'b']);
  });
});

describe('curriculum selectors', () => {
  it('recommends the first lesson to a new learner, review once a backlog builds', () => {
    const fresh = createInitialProgressData(T0);
    const first = nextAction(fresh, T0);
    expect(first.kind).toBe('lesson');
    if (first.kind === 'lesson') expect(first.lesson.id).toBe(LESSONS[0].id);

    const ids = CLUES.slice(0, 6).map((c) => c.id);
    const backlog = progressWith(ids);
    const action = nextAction(backlog, days(30));
    expect(action.kind).toBe('review');
  });

  it('rotates through topics instead of finishing one long topic first', () => {
    const p = createInitialProgressData(T0);
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const lesson = nextLesson(p)!;
      seen.push(lesson.topicId);
      p.completedLessons.push(lesson.id);
    }
    expect(new Set(seen).size).toBe(4);
    expect(seen[0]).toBe(LESSONS[0].topicId);
  });

  it('only reports repeated real mix-ups', () => {
    const [a, b, c] = CLUES;
    const p = createInitialProgressData(T0);
    p.confusions[a.id] = { [b.id]: 3, [c.id]: 1, 'foil-right:xx': 9 };
    expect(topConfusions(p)).toEqual([{ expectedId: a.id, chosenId: b.id, count: 3 }]);
  });
});

describe('question formats', () => {
  const multi = CLUES.filter((c) => supportedKinds(c).includes('map'));
  const paired = CLUES.filter((c) => supportedKinds(c).includes('pair'));

  it('offers the map and side-by-side formats only where the clue supports them', () => {
    expect(multi.length).toBeGreaterThan(0);
    expect(paired.length).toBeGreaterThan(0);
    for (const clue of multi) {
      const countries = new Set(clue.countryIds.filter((id) => PLAYABLE_COUNTRY_MAP[id]));
      expect(countries.size, clue.id).toBeGreaterThanOrEqual(MAP_MIN_COUNTRIES);
      expect(countries.size, clue.id).toBeLessThanOrEqual(MAP_MAX_COUNTRIES);
    }
    for (const clue of CLUES.filter((c) => c.countryIds.length < 2)) {
      expect(supportedKinds(clue), clue.id).not.toContain('map');
    }
    for (const clue of paired) expect(clue.confusables.length, clue.id).toBeGreaterThan(0);
  });

  it('always asks a clue as a plain choice the first time it is seen', () => {
    const rng = seededRng(3);
    for (const clue of [...multi, ...paired]) {
      for (let i = 0; i < 10; i += 1) expect(pickQuestionKind(clue, rng, 0)).toBe('choice');
    }
  });

  it('mixes formats in once a clue has been seen, and never for clues that support only choice', () => {
    const rng = seededRng(5);
    const clue = multi[0];
    const kinds = new Set(Array.from({ length: 200 }, () => pickQuestionKind(clue, rng, 2)));
    expect(kinds.has('choice')).toBe(true);
    expect(kinds.size).toBeGreaterThan(1);
    const plain = CLUES.find((c) => supportedKinds(c).length === 1)!;
    for (let i = 0; i < 50; i += 1) expect(pickQuestionKind(plain, rng, 5)).toBe('choice');
  });

  it('builds a valid map question whose targets are all clickable', () => {
    const rng = seededRng(9);
    for (const clue of multi) {
      const q = buildQuestion(clue, rng, { forceKind: 'map', timesSeen: 3 });
      expect(q.kind, clue.id).toBe('map');
      if (q.kind !== 'map') continue;
      for (const id of q.targetIds) expect(q.candidateIds, clue.id).toContain(id);
      expect(q.candidateIds.length, clue.id).toBeGreaterThan(q.targetIds.length - 1);
      expect(q.correctId).toBe(serializeSelection(q.targetIds));
    }
  });

  it('grades a map answer as correct only for the exact set of countries', () => {
    const clue = multi[0];
    const q = buildQuestion(clue, seededRng(1), { forceKind: 'map', timesSeen: 3 });
    if (q.kind !== 'map') throw new Error('expected a map question');
    expect(gradeMapSelection(q, q.targetIds).correct).toBe(true);
    expect(gradeMapSelection(q, [...q.targetIds].reverse()).correct).toBe(true);
    const missing = gradeMapSelection(q, q.targetIds.slice(1));
    expect(missing.correct).toBe(false);
    expect(missing.missed).toEqual([q.targetIds[0]]);
    const outsider = q.candidateIds.find((id) => !q.targetIds.includes(id));
    if (outsider) {
      const extra = gradeMapSelection(q, [...q.targetIds, outsider]);
      expect(extra.correct).toBe(false);
      expect(extra.extra).toEqual([outsider]);
    }
    expect(gradeMapSelection(q, []).correct).toBe(false);
  });

  it('pairs a clue with one of its declared look-alikes, both with something to show', () => {
    const rng = seededRng(13);
    for (const clue of paired) {
      const q = buildQuestion(clue, rng, { forceKind: 'pair', timesSeen: 3 });
      expect(q.kind, clue.id).toBe('pair');
      if (q.kind !== 'pair') continue;
      expect(q.options, clue.id).toHaveLength(2);
      expect(q.options.map((o) => o.id)).toContain(clue.id);
      const other = q.options.find((o) => o.id !== clue.id)!;
      expect(clue.confusables.map((c) => c.clueId), clue.id).toContain(other.id);
      for (const o of q.options) {
        const s = o.stimulus;
        expect(Boolean(s.visual) || s.kind !== 'plain' || Boolean(s.mono), o.id).toBe(true);
      }
      expect(q.correctId).toBe(clue.id);
    }
  });

  it('falls back to a plain choice when a requested format is not supported', () => {
    const single = CLUES.find((c) => supportedKinds(c).length === 1)!;
    expect(buildQuestion(single, seededRng(2), { forceKind: 'map', timesSeen: 3 }).kind).toBe('choice');
    expect(buildQuestion(single, seededRng(2), { forceKind: 'pair', timesSeen: 3 }).kind).toBe('choice');
  });
});
