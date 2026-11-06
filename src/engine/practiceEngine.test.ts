import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressStore, createInMemoryProgressAdapter } from '../storage/index.ts';
import {
  PracticeEngine,
  calculateMasteryState,
  computeArtsPriority,
  evaluateCountryBridgeSelection,
  getTopConfusionPairs,
  getWeakestLearningSkills,
} from './practiceEngine.ts';
import { LANGUAGE_MAP } from '../data/index.ts';

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

  it('Guided Breakdown highlights Tells, explains distractor elimination, records assisted: true (preventing false promotion to Mastered), and queues 2 follow-up trials after D = 2 spacing delay', async () => {
    // Seed 3 prior fast, unaided correct attempts for Polish ('lang:pl') so a 4th unaided fast correct would normally promote it to 'mastered'
    for (let i = 1; i <= 3; i++) {
      await store.recordAttempt({
        section: 'languages',
        skillId: 'lang:pl',
        chosenSkillId: 'lang:pl',
        sampleId: `pl-seed-${i}`,
        correct: true,
        responseTimeMs: 1500,
        assisted: false,
        mastery: 'learning',
        trialIndex: i,
      });
    }

    engine.startLanguageSession({
      groupId: 'central-slavic-hungarian',
      skipPrime: true,
      drillMode: 'samples',
    });

    // Advance until 'lang:pl' is presented
    let trial = engine.getCurrentTrial()!;
    while (trial.skillId !== 'lang:pl') {
      await engine.submitAnswer(trial.skillId, 1200);
      trial = engine.nextTrial();
    }

    const breakdownTrialNumber = trial.trialNumber;
    const breakdown = engine.requestGuidedBreakdown();

    expect(breakdown.assisted).toBe(true);
    expect(breakdown.skillId).toBe('lang:pl');
    expect(breakdown.languageName).toBe('Polish');
    expect(breakdown.queuedFollowUps).toBe(2);
    // Must explain why every distractor option is ruled out
    expect(breakdown.distractorEliminations).toHaveLength(trial.options.length - 1);
    for (const elim of breakdown.distractorEliminations) {
      expect(elim.optionId).not.toBe('lang:pl');
      expect(elim.reason.length).toBeGreaterThan(20);
    }

    // Submit the correct option fast (1200ms) after using Guided Breakdown
    const feedback = await engine.submitAnswer('lang:pl', 1200);
    expect(feedback.correct).toBe(true);
    expect(feedback.assisted).toBe(true);
    // Must remain 'learning' rather than promoting to 'mastered'
    expect(feedback.newMastery).toBe('learning');
    expect(store.getState().skills['lang:pl']?.mastery).toBe('learning');
    const latestAttempt = store.getState().skills['lang:pl']!.attempts.at(-1)!;
    expect(latestAttempt.assisted).toBe(true);

    // Next 2 trials (intervening trials 1 and 2) must NOT be 'lang:pl' due to D = 2 spacing delay
    const intervening1 = engine.nextTrial();
    expect(intervening1.skillId).not.toBe('lang:pl');
    await engine.submitAnswer(intervening1.skillId, 1100);

    const intervening2 = engine.nextTrial();
    expect(intervening2.skillId).not.toBe('lang:pl');
    await engine.submitAnswer(intervening2.skillId, 1100);

    // Trial breakdownTrialNumber + 3 (after D = 2 intervening trials): 1st queued follow-up for 'lang:pl' fires!
    const followUp1 = engine.nextTrial();
    expect(followUp1.trialNumber).toBe(breakdownTrialNumber + 3);
    expect(followUp1.skillId).toBe('lang:pl');
    expect(followUp1.isFollowUp).toBe(true);
    // Even if learner answers followUp1 fast and unaided (1000ms), 2nd queued follow-up still remains queued
    await engine.submitAnswer('lang:pl', 1000);
    expect(engine.getQueuedFollowUpCount('lang:pl')).toBe(1);

    // Another 2 intervening trials before 2nd follow-up
    const intervening3 = engine.nextTrial();
    expect(intervening3.skillId).not.toBe('lang:pl');
    await engine.submitAnswer(intervening3.skillId, 1100);

    const intervening4 = engine.nextTrial();
    expect(intervening4.skillId).not.toBe('lang:pl');
    await engine.submitAnswer(intervening4.skillId, 1100);

    // 2nd queued follow-up for 'lang:pl' fires after D = 2 spacing delay!
    const followUp2 = engine.nextTrial();
    expect(followUp2.skillId).toBe('lang:pl');
    expect(followUp2.isFollowUp).toBe(true);
    expect(engine.getQueuedFollowUpCount('lang:pl')).toBe(0);
  });

  it('tracks directed confusion matrix and triggers a Stage 2 side-by-side Contrast Card when Skill A is confused with Skill B twice, followed by boosted priority for both skills', async () => {
    engine.startLanguageSession({
      groupId: 'central-slavic-hungarian', // pl, cs, sk, hu, sl, hr
      skipPrime: true,
      drillMode: 'samples',
    });

    // Trial 1: skillA (e.g., 'lang:pl') confused with skillB ('lang:hu') — 1st confusion
    const t1 = engine.getCurrentTrial()!;
    const skillA = t1.skillId;
    const skillB = 'lang:hu';
    expect(skillA).not.toBe(skillB);

    const fb1 = await engine.submitAnswer(skillB, 2800);
    expect(fb1.correct).toBe(false);
    expect(fb1.triggeredContrastQueued).toBe(false);
    expect(engine.getConfusionCount(skillA, skillB)).toBe(1);

    // 2 intervening trials (Trials 2 and 3) answered fast & accurately
    const t2 = engine.nextTrial();
    await engine.submitAnswer(t2.skillId, 1100);
    const t3 = engine.nextTrial();
    await engine.submitAnswer(t3.skillId, 1100);

    // Trial 4: skillA returns after D = 2 spacing delay; confuse it with skillB a 2nd time!
    const t4 = engine.nextTrial();
    expect(t4.skillId).toBe(skillA);
    const fb4 = await engine.submitAnswer(skillB, 2900);
    expect(fb4.correct).toBe(false);
    expect(fb4.triggeredContrastQueued).toBe(true);
    expect(engine.getConfusionCount(skillA, skillB)).toBe(2);

    // Trial 5: automatically inserts the Stage 2 Triggered Contrast Card comparing skillA and skillB side by side
    const contrastTrial = engine.nextTrial();
    expect(contrastTrial.kind).toBe('triggered-contrast');
    expect(contrastTrial.triggeredContrast).toBeDefined();
    expect(contrastTrial.triggeredContrast!.expectedSkillId).toBe(skillA);
    expect(contrastTrial.triggeredContrast!.confusedWithSkillId).toBe(skillB);
    expect(contrastTrial.triggeredContrast!.confusionCount).toBe(2);
    expect(contrastTrial.triggeredContrast!.leftSide.skillId).toBe(skillA);
    expect(contrastTrial.triggeredContrast!.rightSide.skillId).toBe(skillB);
    expect(contrastTrial.options).toHaveLength(2);

    // Match each side on the Contrast Card
    const contrastFeedback = await engine.submitAnswer(contrastTrial.skillId, 2200);
    expect(contrastFeedback.correct).toBe(true);

    // Subsequent trials must prioritize BOTH skillB and skillA ahead of unconfused skills in the group
    const nextAfterContrast1 = engine.nextTrial();
    const nextAfterContrast2 = (() => {
      void engine.submitAnswer(nextAfterContrast1.skillId, 1200);
      return engine.nextTrial();
    })();

    expect([nextAfterContrast1.skillId, nextAfterContrast2.skillId]).toEqual(
      expect.arrayContaining([skillA, skillB])
    );
  });

  it('identifies top confusion pairs and weakest Learning skills and launches Smart Practice (Weakest Spots) targeting them', async () => {
    await store.recordAttempt({
      section: 'languages',
      skillId: 'lang:sk',
      chosenSkillId: 'lang:cs',
      sampleId: 'sk-sent-1',
      correct: false,
      responseTimeMs: 4100,
      assisted: false,
      mastery: 'learning',
      trialIndex: 1,
    });
    await store.recordAttempt({
      section: 'languages',
      skillId: 'lang:sk',
      chosenSkillId: 'lang:cs',
      sampleId: 'sk-sign-1',
      correct: false,
      responseTimeMs: 3900,
      assisted: false,
      mastery: 'learning',
      trialIndex: 2,
    });

    const state = store.getState();
    const topPairs = getTopConfusionPairs(state);
    expect(topPairs).toHaveLength(1);
    expect(topPairs[0]).toMatchObject({
      expectedId: 'lang:sk',
      chosenId: 'lang:cs',
      expectedLabel: 'Slovak',
      chosenLabel: 'Czech',
      count: 2,
    });

    const weakest = getWeakestLearningSkills(state);
    expect(weakest.length).toBeGreaterThanOrEqual(1);
    expect(weakest[0].skillId).toBe('lang:sk');
    expect(weakest[0].mastery).toBe('learning');

    // Launching Smart Practice (Weakest Spots) immediately starts a trial targeting the weak/confused skills
    const smartTrial = engine.startSmartPracticeSession('samples');
    expect(smartTrial).not.toBeNull();
    expect(smartTrial.skillId).toBe('lang:sk');
    expect(smartTrial.groupName).toContain('Smart Practice');
  });

  it('interleaves Stage 3 Language -> Country Bridge trials when a language reaches recognized or mastered status and validates multi-country map selections', async () => {
    // Seed 3 prior unaided correct attempts for German ('lang:de') so the 4th unaided attempt reaches 'recognized' (or 'mastered')
    for (let i = 1; i <= 3; i++) {
      await store.recordAttempt({
        section: 'languages',
        skillId: 'lang:de',
        chosenSkillId: 'lang:de',
        sampleId: `de-seed-${i}`,
        correct: true,
        responseTimeMs: 4000, // slower than 3500ms so 4th correct reaches 'recognized'
        assisted: false,
        mastery: 'learning',
        trialIndex: i,
      });
    }

    engine.startLanguageSession({
      groupId: 'germanic',
      skipPrime: true,
      drillMode: 'mixed',
    });

    // Advance until 'lang:de' is presented in Stage 1
    let trial = engine.getCurrentTrial()!;
    while (trial.skillId !== 'lang:de') {
      await engine.submitAnswer(trial.skillId, 1800);
      trial = engine.nextTrial();
    }
    expect(trial.kind).not.toBe('country-bridge');

    // Submit 4th unaided correct answer -> reaches 'recognized' and queues Stage 3 Country Bridge trial
    const stage1Feedback = await engine.submitAnswer('lang:de', 2200);
    expect(stage1Feedback.correct).toBe(true);
    expect(stage1Feedback.newMastery).toBe('recognized');
    expect(stage1Feedback.bridgeQueued).toBe(true);

    // Next trial interleaved by PracticeEngine must be the Stage 3 Language -> Country Bridge trial for German
    const bridgeTrial = engine.nextTrial();
    expect(bridgeTrial.kind).toBe('country-bridge');
    expect(bridgeTrial.skillId).toBe('lang:de');
    expect(bridgeTrial.bridgePrompt).toBeDefined();
    expect(bridgeTrial.bridgePrompt!.languageName).toBe('German');
    // Expected Candidate Countries for German: de, at, ch, li, lu, be
    expect(
      [...bridgeTrial.bridgePrompt!.expectedCountryIds].sort()
    ).toEqual(['at', 'be', 'ch', 'de', 'li', 'lu']);

    // Submit an imperfect multi-country selection:
    // - Correct (emerald): de, at, ch
    // - Missed (amber): be, li, lu
    // - Incorrect (rose): nl (covered non-candidate) + cn (coverageTier === 'none')
    const imperfectFeedback = await engine.submitCountryBridgeAnswer(
      ['de', 'at', 'ch', 'nl', 'cn'],
      3200
    );
    expect(imperfectFeedback.correct).toBe(false);
    expect(imperfectFeedback.mapEvaluation).toBeDefined();
    expect(imperfectFeedback.mapEvaluation!.perfect).toBe(false);
    expect(imperfectFeedback.mapEvaluation!.correctCountryIds.sort()).toEqual([
      'at',
      'ch',
      'de',
    ]);
    expect(imperfectFeedback.mapEvaluation!.missedCountryIds.sort()).toEqual([
      'be',
      'li',
      'lu',
    ]);
    expect(imperfectFeedback.mapEvaluation!.incorrectCountryIds.sort()).toEqual([
      'cn',
      'nl',
    ]);
    expect(imperfectFeedback.mapEvaluation!.incorrectUncoveredCountryIds).toEqual([
      'cn',
    ]);

    // Verify exact multi-country selection on a Stage 3 Bridge trial (e.g., Simplified Chinese 'zh-hans' -> sg, my, cx, with Mainland China uncovered footnote)
    const zhHansEval = evaluateCountryBridgeSelection(LANGUAGE_MAP['zh-hans'], [
      'sg',
      'my',
      'cx',
    ]);
    expect(zhHansEval.perfect).toBe(true);
    expect(zhHansEval.correctCountryIds.sort()).toEqual(['cx', 'my', 'sg']);
    expect(zhHansEval.missedCountryIds).toEqual([]);
    expect(zhHansEval.incorrectCountryIds).toEqual([]);
    expect(LANGUAGE_MAP['zh-hans'].uncoveredCountryNotes.join(' ')).toContain(
      'Mainland China'
    );
  });
});
