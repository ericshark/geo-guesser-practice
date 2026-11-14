import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLUES, CLUE_MAP, LESSONS, LESSON_MAP, TOPICS } from './index.ts';
import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import { buildQuestion, type ChoiceQuestion } from '../engine/questionGen.ts';
import { seededRng } from '../engine/random.ts';

describe('curriculum content', () => {
  it('has unique clue ids and every lesson resolves to real clues', () => {
    expect(new Set(CLUES.map((c) => c.id)).size).toBe(CLUES.length);
    for (const lesson of LESSONS) {
      expect(lesson.clueIds.length, lesson.id).toBeGreaterThan(0);
      for (const id of lesson.clueIds) {
        expect(CLUE_MAP[id], `${lesson.id} -> ${id}`).toBeDefined();
        expect(CLUE_MAP[id].lessonId).toBe(lesson.id);
      }
    }
  });

  it('assigns every clue to exactly one lesson of its own topic', () => {
    const owners = new Map<string, string>();
    for (const topic of TOPICS) {
      for (const lesson of topic.lessons) {
        for (const id of lesson.clueIds) {
          expect(owners.has(id), `${id} appears in two lessons`).toBe(false);
          owners.set(id, lesson.id);
          expect(CLUE_MAP[id].topicId).toBe(topic.id);
        }
      }
    }
    expect(owners.size).toBe(CLUES.length);
    expect(Object.keys(LESSON_MAP).length).toBe(LESSONS.length);
  });

  it('keeps lessons short enough to learn (at most 6 new clues)', () => {
    for (const lesson of LESSONS) expect(lesson.clueIds.length, lesson.id).toBeLessThanOrEqual(6);
  });

  it('only references known countries and has complete teaching text', () => {
    for (const clue of CLUES) {
      expect(clue.title.length, clue.id).toBeGreaterThan(0);
      expect(clue.spot.length, clue.id).toBeGreaterThan(10);
      expect(clue.stimuli.length, clue.id).toBeGreaterThan(0);
      expect(clue.detail.length, clue.id).toBeLessThanOrEqual(3);
      for (const c of clue.countryIds) expect(PLAYABLE_COUNTRY_MAP[c], `${clue.id} -> ${c}`).toBeDefined();
      for (const conf of clue.confusables) expect(CLUE_MAP[conf.clueId], `${clue.id} -> ${conf.clueId}`).toBeDefined();
    }
  });

  it('can always build a fair 4-option question with exactly one correct answer', () => {
    const rng = seededRng(7);
    for (const clue of CLUES) {
      for (let i = 0; i < 3; i += 1) {
        // A clue's first question is always a plain choice.
        const q = buildQuestion(clue, rng) as ChoiceQuestion;
        expect(q.kind).toBe('choice');
        const label = (id: string) => q.options.find((o) => o.id === id)!.label;
        expect(q.options.length, clue.id).toBe(4);
        expect(new Set(q.options.map((o) => o.id)).size, clue.id).toBe(4);
        expect(new Set(q.options.map((o) => o.label)).size, `${clue.id} duplicate labels`).toBe(4);
        expect(q.options.filter((o) => o.id === q.correctId)).toHaveLength(1);
        expect(label(q.correctId)).toBe(clue.title);
      }
    }
  });

  it('never shows identical text for two clues that are offered as options for each other', () => {
    const owner = new Map<string, string>(); // `${choiceGroup}|${text}` -> clue id
    for (const clue of CLUES.filter((c) => c.choiceGroup)) {
      for (const s of clue.stimuli) {
        const key = `${clue.choiceGroup}|${s.text}`;
        expect(owner.has(key) && owner.get(key) !== clue.id, `${s.text} is ambiguous`).toBe(false);
        owner.set(key, clue.id);
      }
    }
  });

  it('gives language clues varied material and at least one verified highlight', () => {
    const languages = CLUES.filter((c) => c.topicId === 'languages');
    expect(languages.length).toBe(69);
    // Languages that used to be missing or thin (5 samples) must now carry about a dozen varied samples.
    const DEEP = ['en', 'kl', 'ms', 'my', 'dz', 'ne', 'ur', 'kk', 'sq', 'fa', 'az', 'hy', 'uz', 'am', 'lo', 'km', 'si', 'gu', 'zu', 'yo', 'mn', 'ky'];
    for (const id of DEEP) {
      const clue = languages.find((c) => c.id === `lang:${id}`);
      expect(clue, id).toBeDefined();
      expect(clue!.stimuli.length, id).toBeGreaterThanOrEqual(12);
      expect(new Set(clue!.stimuli.map((s) => s.text)).size, id).toBe(clue!.stimuli.length);
    }
    for (const clue of languages) {
      expect(clue.stimuli.length, clue.id).toBeGreaterThanOrEqual(5);
      expect(clue.stimuli.some((s) => (s.tellIds?.length ?? 0) > 0), clue.id).toBe(true);
    }
    // The old "reduce speed near the school" template should no longer dominate.
    const school = languages.filter((c) => c.stimuli.some((s) => /school/i.test(s.translation ?? '')));
    expect(school.length).toBeGreaterThan(0); // base samples still exist
    for (const clue of languages) {
      const share = clue.stimuli.filter((s) => /school/i.test(s.translation ?? '')).length / clue.stimuli.length;
      expect(share, clue.id).toBeLessThanOrEqual(0.5);
    }
  });

  it('credits every bundled photo with an author and an open licence', async () => {
    const credits = JSON.parse(await fs.readFile(path.resolve(process.cwd(), 'src/content/mediaCredits.json'), 'utf-8'));
    for (const clue of CLUES) {
      for (const s of clue.stimuli) {
        if (s.visual?.kind !== 'photo') continue;
        const credit = credits[s.visual.id];
        expect(credit, `${s.visual.id} has no credit`).toBeDefined();
        expect(credit.author.length).toBeGreaterThan(1);
        expect(credit.licence).toMatch(/^(CC BY(-SA)? \d\.\d|CC0|Public domain)/i);
        await expect(fs.access(path.resolve(process.cwd(), `public/media/${s.visual.id}.jpg`))).resolves.toBeUndefined();
      }
    }
  });

  it('never offers another correct answer as a distractor in single-answer clue sets', () => {
    // "Which of these drives on the left?" must not list another left-driving country.
    const rng = seededRng(11);
    for (const clue of CLUES.filter((c) => c.id.startsWith('drive-left:'))) {
      for (let i = 0; i < 5; i += 1) {
        const q = buildQuestion(clue, rng) as ChoiceQuestion;
        for (const option of q.options) {
          if (option.id === clue.id) continue;
          expect(option.isFoil, `${clue.id} offered non-foil ${option.id}`).toBe(true);
          const country = PLAYABLE_COUNTRY_MAP[option.id.replace('foil-right:', '')];
          expect(country.drivingSide).toBe('right');
        }
      }
    }
  });
});
