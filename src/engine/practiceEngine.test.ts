import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressStore, createInMemoryProgressAdapter } from '../storage/index.ts';
import { PracticeEngine, calculateMasteryState, computeArtsPriority } from './practiceEngine.ts';

describe('Primary Seam — PracticeEngine (Session & ARTS Learning Controller)', () => {
  let store: ProgressStore;
  let currentTime: number;
  let engine: PracticeEngine;

  beforeEach(async () => {
    currentTime = 1_700_000_000_000;
    store = new ProgressStore(createInMemoryProgressAdapter());
    await store.load();
    engine = new PracticeEngine(store, {
      now: () => currentTime,
      rng: () => 0.25,
    });
  });

  it('delivers Stage 0 Quick Prime Contrast Card for a Language Group and allows completing or skipping into Stage 1', async () => {
    engine.startLanguageSession({
      groupId: 'central-slavic-hungarian',
      drillMode: 'samples',
    });

    const prime = engine.getStage0Prime();
    expect(prime).not.toBeNull();
    expect(prime!.groupId).toBe('central-slavic-hungarian');
    expect(prime!.languages.length).toBeGreaterThanOrEqual(4);
    expect(prime!.languages.map((l) => l.id)).toEqual(
      expect.arrayContaining(['pl', 'cs', 'sk', 'hu'])
    );

    // Completing Stage 0 Prime persists prime completion and starts Stage 1 drill
    await engine.completeStage0Prime();
    expect(engine.getStage0Prime()).toBeNull();
    expect(store.getState().completedPrimes).toContain('central-slavic-hungarian');

    const firstTrial = engine.getCurrentTrial();
    expect(firstTrial).not.toBeNull();
    expect(firstTrial!.options.length).toBeGreaterThanOrEqual(4);
  });

  it('enforces ARTS spacing delay D = 2 (at least 2 intervening trials before repeating a skill) and prioritizes errors and slow correct answers ahead of fast correct answers', async () => {
    // Direct unit check on ARTS priority formula
    const blockedByDelay = computeArtsPriority({
      trialsSinceLastSeen: 2, // N <= D (D = 2)
      lastCorrect: false,
      lastAssisted: false,
      lastResponseTimeMs: 5000,
      fluencyThresholdMs: 3500,
      mastery: 'learning',
      confusionBoost: 0,
    });
    expect(blockedByDelay).toBeLessThanOrEqual(0);

    const errorPriority = computeArtsPriority({
      trialsSinceLastSeen: 3, // N = 3 > D
      lastCorrect: false,
      lastAssisted: false,
      lastResponseTimeMs: 2500,
      fluencyThresholdMs: 3500,
      mastery: 'learning',
      confusionBoost: 0,
    });
    const slowCorrectPriority = computeArtsPriority({
      trialsSinceLastSeen: 3,
      lastCorrect: true,
      lastAssisted: false,
      lastResponseTimeMs: 5800,
      fluencyThresholdMs: 3500,
      mastery: 'learning',
      confusionBoost: 0,
    });
    const fastCorrectPriority = computeArtsPriority({
      trialsSinceLastSeen: 3,
      lastCorrect: true,
      lastAssisted: false,
      lastResponseTimeMs: 950,
      fluencyThresholdMs: 3500,
      mastery: 'learning',
      confusionBoost: 0,
    });

    expect(errorPriority).toBeGreaterThan(slowCorrectPriority);
    expect(slowCorrectPriority).toBeGreaterThan(fastCorrectPriority);
    expect(fastCorrectPriority).toBeGreaterThan(0);

    // Session-level scheduling check across trials
    engine.startLanguageSession({
      groupId: 'east-asian', // ja, ko, zh-hans, zh-hant
      skipPrime: true,
      drillMode: 'samples',
    });

    // Trial 1: answer WRONG on first skill (e.g., lang:ja)
    const t1 = engine.getCurrentTrial()!;
    const missedSkillId = t1.skillId;
    const wrongOption = t1.options.find((o) => o.id !== missedSkillId)!.id;
    await engine.submitAnswer(wrongOption, 4000);

    // Trial 2 (0 intervening trials since t1): must NOT repeat missedSkillId
    const t2 = engine.nextTrial()!;
    expect(t2.skillId).not.toBe(missedSkillId);
    await engine.submitAnswer(t2.skillId, 1100); // fast correct

    // Trial 3 (1 intervening trial since t1): must STILL NOT repeat missedSkillId (D = 2)
    const t3 = engine.nextTrial()!;
    expect(t3.skillId).not.toBe(missedSkillId);
    expect(t3.skillId).not.toBe(t2.skillId);
    await engine.submitAnswer(t3.skillId, 1100); // fast correct

    // Trial 4 (2 intervening trials since t1): missedSkillId is now eligible (N = 3 > D = 2) and must be prioritized due to error weight!
    const t4 = engine.nextTrial()!;
    expect(t4.skillId).toBe(missedSkillId);
  });

  it('never repeats the same Sample consecutively for a language and returns accurate Tell character spans, translation, and covered Candidate Countries in feedback', async () => {
    engine.startLanguageSession({
      groupId: 'baltic-finnic',
      skipPrime: true,
      drillMode: 'samples',
    });

    const seenSamplesByLanguage = new Map<string, string[]>();

    for (let i = 0; i < 16; i++) {
      const trial = i === 0 ? engine.getCurrentTrial()! : engine.nextTrial()!;
      expect(trial.sample).toBeDefined();
      const prevSamples = seenSamplesByLanguage.get(trial.languageId) ?? [];
      if (prevSamples.length > 0) {
        // Must never repeat the immediately preceding sampleId consecutively
        expect(trial.sample.id).not.toBe(prevSamples[prevSamples.length - 1]);
      }
      // Until the language's sample pool (5 samples) is exhausted, all samples must be unique
      if (prevSamples.length < 5) {
        expect(prevSamples).not.toContain(trial.sample.id);
      }
      prevSamples.push(trial.sample.id);
      seenSamplesByLanguage.set(trial.languageId, prevSamples);

      const feedback = await engine.submitAnswer(trial.skillId, 2000);
      expect(feedback.correct).toBe(true);
      expect(feedback.translation).toBe(trial.sample.translation);
      expect(feedback.candidateCountries.length).toBeGreaterThan(0);
      for (const country of feedback.candidateCountries) {
        expect(country.coverageTier).not.toBe('none');
      }
      for (const match of feedback.matchedTells) {
        for (const span of match.spans) {
          expect(feedback.sample.text.slice(span.start, span.end)).toBe(span.text);
        }
      }
    }
  });

  it('supports Tell Recognition micro-questions alongside Sample Recognition drills', async () => {
    engine.startLanguageSession({
      groupId: 'central-slavic-hungarian',
      skipPrime: true,
      drillMode: 'tells',
    });

    const trial = engine.getCurrentTrial()!;
    expect(trial.kind).toBe('tell-recognition');
    expect(trial.tellPrompt).toBeDefined();
    expect(trial.tellPrompt!.pattern.length).toBeGreaterThan(0);

    const feedback = await engine.submitAnswer(trial.skillId, 1800);
    expect(feedback.correct).toBe(true);
    expect(feedback.candidateCountries.length).toBeGreaterThan(0);
  });

  it('transitions Mastery States accurately: unseen -> learning -> recognized -> mastered', () => {
    const ceiling = 3500;

    // 0 attempts -> unseen
    expect(calculateMasteryState([], ceiling)).toBe('unseen');

    // 1–3 attempts -> learning
    expect(
      calculateMasteryState(
        [
          { timestamp: 1, correct: true, responseTimeMs: 1500, assisted: false },
          { timestamp: 2, correct: true, responseTimeMs: 1500, assisted: false },
        ],
        ceiling
      )
    ).toBe('learning');

    // 4 of 4 correct without assistance, but at least one of the last 3 was slower than ceiling (4200ms > 3500ms) -> recognized
    expect(
      calculateMasteryState(
        [
          { timestamp: 1, correct: true, responseTimeMs: 1800, assisted: false },
          { timestamp: 2, correct: true, responseTimeMs: 4200, assisted: false },
          { timestamp: 3, correct: true, responseTimeMs: 2100, assisted: false },
          { timestamp: 4, correct: true, responseTimeMs: 1900, assisted: false },
        ],
        ceiling
      )
    ).toBe('recognized');

    // 4 of last 5 correct without assistance, and last 3 consecutive correct under 3500ms -> mastered
    expect(
      calculateMasteryState(
        [
          { timestamp: 1, correct: false, responseTimeMs: 5000, assisted: false },
          { timestamp: 2, correct: true, responseTimeMs: 4100, assisted: false },
          { timestamp: 3, correct: true, responseTimeMs: 2400, assisted: false },
          { timestamp: 4, correct: true, responseTimeMs: 1900, assisted: false },
          { timestamp: 5, correct: true, responseTimeMs: 1700, assisted: false },
        ],
        ceiling
      )
    ).toBe('mastered');

    // Assisted on most recent attempt prevents false promotion to mastered/recognized -> learning
    expect(
      calculateMasteryState(
        [
          { timestamp: 1, correct: true, responseTimeMs: 1800, assisted: false },
          { timestamp: 2, correct: true, responseTimeMs: 1800, assisted: false },
          { timestamp: 3, correct: true, responseTimeMs: 1800, assisted: false },
          { timestamp: 4, correct: true, responseTimeMs: 1800, assisted: true },
        ],
        ceiling
      )
    ).toBe('learning');
  });
});
