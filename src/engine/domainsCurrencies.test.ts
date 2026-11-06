import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryProgressAdapter, ProgressStore } from '../storage/index.ts';
import { PracticeEngine } from './practiceEngine.ts';

describe('Domains & Currencies through PracticeEngine', () => {
  let store: ProgressStore;
  let engine: PracticeEngine;

  beforeEach(async () => {
    store = new ProgressStore(createInMemoryProgressAdapter());
    await store.load();
    engine = new PracticeEngine(store, { now: () => 1000, rng: () => 0.25 });
  });

  it('drills the ccTLD in a URL and records the country answer in Dashboard progress', async () => {
    const trial = engine.startDomainsCurrenciesSession('domains', 'domain:hr');
    expect(trial.sample.text).toBe('www.pekara.hr');
    expect(trial.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'hr', label: 'Croatia' }),
    ]));
    expect(trial.fluencyThresholdMs).toBe(3500);

    const feedback = await engine.submitDomainsCurrenciesAnswer(['hr'], 1200);
    expect(feedback).toMatchObject({ correct: true, isFluentSpeed: true, newMastery: 'learning' });
    expect(store.getSectionMasteryBreakdown('domains-currencies')).toMatchObject({
      learning: 1,
      practicedTrials: 1,
    });
  });

  it('checks all listed matches for a shared sign without assigning it to one currency code', async () => {
    const trial = engine.startDomainsCurrenciesSession('currencies', 'curr:sign:kr');
    expect(trial.sample.text).toBe('89 kr');
    const krCountries = ['dk', 'fo', 'gl', 'no', 'se', 'is'];
    expect(trial.domainsCurrenciesPrompt?.countries.map(({ id }) => id).sort()).toEqual(krCountries.sort());
    const matchingChoices = trial.options.filter(({ id }) => krCountries.includes(id)).map(({ id }) => id);
    expect(matchingChoices).toHaveLength(4);

    const incomplete = await engine.submitDomainsCurrenciesAnswer(matchingChoices.slice(1), 1200);
    expect(incomplete).toMatchObject({ correct: false, expectedCountryIds: matchingChoices });
    expect(store.getState().skills['curr:dkk']).toBeUndefined();

    const next = engine.startDomainsCurrenciesSession('currencies', 'curr:sign:kr');
    expect(next.sample.text).not.toBe(trial.sample.text);
    const allMatches = next.options.filter(({ id }) => krCountries.includes(id)).map(({ id }) => id);
    const complete = await engine.submitDomainsCurrenciesAnswer(allMatches, 1300);
    expect(complete).toMatchObject({ correct: true, isFluentSpeed: true });
  });

  it('rejects a matching currency country outside the choices and records each trial once', async () => {
    const trial = engine.startDomainsCurrenciesSession('currencies', 'curr:eur');
    const euroCountries = trial.domainsCurrenciesPrompt!.countries.map(({ id }) => id);
    const listed = trial.options.filter(({ id }) => euroCountries.includes(id)).map(({ id }) => id);
    const outsideChoices = euroCountries.find((id) => !listed.includes(id))!;
    expect(trial.sample.text).toContain('€');
    expect(outsideChoices).toBeDefined();

    const result = await engine.submitDomainsCurrenciesAnswer([...listed, outsideChoices], 1400);
    expect(result.correct).toBe(false);
    expect(await engine.submitDomainsCurrenciesAnswer(listed, 1100)).toEqual(result);
    expect(store.getState().totalTrials).toBe(1);
  });

  it('records assistance, spaces two fresh follow-ups, and applies the 3.5-second Mastery threshold', async () => {
    const first = engine.startDomainsCurrenciesSession('currencies', 'curr:pln');
    expect(first.sample.text).toBe('24,99 zł');
    const breakdown = engine.requestGuidedBreakdown();
    expect(breakdown).toMatchObject({
      queuedFollowUps: 2,
      assisted: true,
      candidateCountries: [expect.objectContaining({ name: 'Poland' })],
    });
    expect(breakdown.distractorEliminations).toHaveLength(5);
    engine.dismissGuidedBreakdown();
    const helped = await engine.submitDomainsCurrenciesAnswer(['pl'], 1000);
    expect(helped).toMatchObject({ assisted: true, correct: true, isFluentSpeed: false });

    const seen = [first.sample.text];
    for (let i = 0; i < 2; i++) {
      expect(engine.nextTrial().skillId).not.toBe('curr:pln');
      expect(engine.nextTrial().skillId).not.toBe('curr:pln');
      const followUp = engine.nextTrial();
      expect(followUp).toMatchObject({ skillId: 'curr:pln', isFollowUp: true });
      expect(followUp.sample.text).not.toBe(seen.at(-1));
      seen.push(followUp.sample.text);
      await engine.submitDomainsCurrenciesAnswer(['pl'], 3500);
    }

    const answerPoland = (rt: number) => {
      engine.startDomainsCurrenciesSession('currencies', 'curr:pln');
      return engine.submitDomainsCurrenciesAnswer(['pl', 'pl'], rt);
    };
    await answerPoland(3500);
    expect(await answerPoland(3500)).toMatchObject({ newMastery: 'recognized', isFluentSpeed: false });
    await answerPoland(1100);
    await answerPoland(1200);
    expect(await answerPoland(1300)).toMatchObject({ newMastery: 'mastered', isFluentSpeed: true });
    expect(store.getSectionMasteryBreakdown('domains-currencies').mastered).toBe(1);
  });

  it('presents the bundled rupee symbol as well as its currency code', async () => {
    const trial = engine.startDomainsCurrenciesSession('currencies', 'curr:pkr');
    expect(trial.sample.text).toContain('₨');
    await engine.submitDomainsCurrenciesAnswer(['pk'], 1200);
    expect(engine.startDomainsCurrenciesSession('currencies', 'curr:pkr').sample.text).toContain('PKR');
  });


  it('introduces high-yield currency and domain skills in a long Mixed session', async () => {
    let trial = engine.startDomainsCurrenciesSession();
    const seen = new Set<string>();
    for (let i = 0; i < 450; i++) {
      seen.add(trial.skillId);
      const matching = trial.options.filter(({ id }) =>
        trial.domainsCurrenciesPrompt!.countries.some((country) => country.id === id)
      );
      await engine.submitDomainsCurrenciesAnswer(matching.map(({ id }) => id), 1000);
      trial = engine.nextTrial();
    }
    expect([...seen]).toEqual(expect.arrayContaining([
      'curr:pln', 'curr:czk', 'curr:huf', 'curr:php', 'domain:dz', 'domain:ae', 'domain:by',
    ]));
  });

  it('keeps rotating Euro price tags after the persisted 12-Sample window fills', async () => {
    const prices = new Set<string>();
    for (let i = 0; i < 16; i++) {
      const trial = engine.startDomainsCurrenciesSession('currencies', 'curr:eur');
      expect(prices.has(trial.sample.text)).toBe(false);
      prices.add(trial.sample.text);
      const choices = trial.options.filter(({ id }) =>
        trial.domainsCurrenciesPrompt!.countries.some((country) => country.id === id)
      );
      await engine.submitDomainsCurrenciesAnswer(choices.map(({ id }) => id), 1000);
    }
  });


  it('keeps a single result visible in progress when its save fails', async () => {
    let writes = 0;
    const adapter = createInMemoryProgressAdapter();
    store = new ProgressStore({
      load: adapter.load,
      async save(progress) {
        writes += 1;
        if (writes > 1) throw new Error('Disk write failed');
        await adapter.save(progress);
      },
    });
    await store.load();
    let observedTrials = 0;
    store.subscribe((progress) => { observedTrials = progress.totalTrials; });
    engine = new PracticeEngine(store);
    engine.startDomainsCurrenciesSession('domains', 'domain:hr');

    const feedback = await engine.submitDomainsCurrenciesAnswer(['hr'], 1000);
    expect(feedback).toMatchObject({ correct: true, saveFailed: true });
    expect(observedTrials).toBe(1);
    expect(await engine.submitDomainsCurrenciesAnswer(['hr'], 1000)).toEqual(feedback);
    expect(writes).toBe(2);
  });
});
