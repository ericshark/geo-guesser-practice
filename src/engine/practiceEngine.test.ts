import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressStore, createInMemoryProgressAdapter } from '../storage/index.ts';
import {
  PracticeEngine,
  calculateMasteryState,
  computeArtsPriority,
  evaluateCountryBridgeSelection,
  evaluateCoverageMapSelection,
  getTopConfusionPairs,
  getWeakestLearningSkills,
} from './practiceEngine.ts';
import {
  COVERAGE_FOCUS_OPTIONS,
  getCountriesForCoverageFocus,
  LANGUAGE_MAP,
  PLAYABLE_COUNTRY_MAP,
} from '../data/index.ts';

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

  it('generates Coverage speed classification, neighboring cluster, and regional map drills across all 7 focuses with exact Coverage Tier and Limited regional notes', async () => {
    // Verify all 7 regional focuses exist and include Common Trap Countries
    expect(COVERAGE_FOCUS_OPTIONS.map((f) => f.id)).toEqual([
      'world',
      'trap-countries',
      'Europe',
      'Asia',
      'Africa',
      'Americas',
      'Oceania',
    ]);

    const trapCountryIds = getCountriesForCoverageFocus('trap-countries').map(
      (c) => c.id
    );
    expect(trapCountryIds).toEqual(
      expect.arrayContaining([
        'cn',
        'eg',
        'ma',
        'dz',
        'by',
        'md',
        've',
        'bo',
        'cu',
        'pk',
      ])
    );

    // 1. Speed classification drill (Official vs Limited vs None)
    const tierTrial = engine.startCoverageSession({
      focusId: 'trap-countries',
      drillMode: 'tier-speed',
    });
    expect(engine.getActiveSection()).toBe('coverage');
    expect(tierTrial.kind).toBe('coverage-tier');
    expect(tierTrial.options.map((o) => o.id)).toEqual([
      'tier:official',
      'tier:limited',
      'tier:none',
    ]);
    expect(tierTrial.coveragePrompt).toBeDefined();

    const target = tierTrial.coveragePrompt!.targetCountry;
    const correctTierChoice = `tier:${target.coverageTier}`;
    const tierFeedback = await engine.submitCoverageAnswer(
      correctTierChoice,
      1900
    );
    expect(tierFeedback.correct).toBe(true);
    expect(tierFeedback.coverageTier).toBe(target.coverageTier);
    expect(tierFeedback.coverageNote).toBe(target.coverageNote);
    expect(tierFeedback.mapHighlightedCountryIds).toContain(target.id);

    // Verify ARTS D=2 spacing prevents repeating the same country on the next 2 trials
    const secondTrial = engine.nextTrial();
    expect(secondTrial.skillId).not.toBe(tierTrial.skillId);
    const thirdTrial = engine.nextTrial();
    expect(thirdTrial.skillId).not.toBe(tierTrial.skillId);

    // 2. Neighboring cluster drill (identify which country in a neighboring cluster lacks coverage or has Limited coverage)
    const clusterTrial = engine.startCoverageSession({
      focusId: 'Africa',
      drillMode: 'neighbor-cluster',
    });
    expect(clusterTrial.kind).toBe('coverage-cluster');
    expect(clusterTrial.coveragePrompt!.clusterCountries!.length).toBeGreaterThanOrEqual(
      3
    );
    const clusterTarget = clusterTrial.coveragePrompt!.targetCountry;
    const clusterFeedback = await engine.submitCoverageAnswer(
      `cov:${clusterTarget.id}`,
      2100
    );
    expect(clusterFeedback.correct).toBe(true);
    expect(clusterFeedback.mapHighlightedCountryIds.length).toBeGreaterThanOrEqual(
      3
    );

    // Verify Limited countries surface specific regional coverage notes (e.g., Nigeria Lagos/Abuja, Russia western bias, Pakistan trekker/Lahore, Bolivia corridor)
    expect(PLAYABLE_COUNTRY_MAP.ng.coverageTier).toBe('limited');
    expect(PLAYABLE_COUNTRY_MAP.ng.coverageNote).toMatch(/Lagos|Abuja/);
    expect(PLAYABLE_COUNTRY_MAP.ru.coverageTier).toBe('limited');
    expect(PLAYABLE_COUNTRY_MAP.ru.coverageNote).toMatch(/European Russia|Trans-Siberian/);
    expect(PLAYABLE_COUNTRY_MAP.pk.coverageTier).toBe('limited');
    expect(PLAYABLE_COUNTRY_MAP.pk.coverageNote).toMatch(/Lahore|trekker/i);
    expect(PLAYABLE_COUNTRY_MAP.bo.coverageTier).toBe('limited');
    expect(PLAYABLE_COUNTRY_MAP.bo.coverageNote).toMatch(/La Paz|Santa Cruz/);

    // 3. Regional map drill & evaluateCoverageMapSelection
    const mapTrial = engine.startCoverageSession({
      focusId: 'Americas',
      drillMode: 'regional-map',
    });
    expect(mapTrial.kind).toBe('coverage-map');
    const expectedIds = mapTrial.coveragePrompt!.expectedCountryIds!;
    expect(expectedIds.length).toBeGreaterThan(0);

    // Submit exact expected countries on the regional map
    const exactMapFeedback = await engine.submitCoverageMapAnswer(
      expectedIds,
      2800
    );
    expect(exactMapFeedback.correct).toBe(true);
    expect(exactMapFeedback.mapEvaluation).toBeDefined();
    expect(exactMapFeedback.mapEvaluation!.perfect).toBe(true);
    expect(exactMapFeedback.mapEvaluation!.missedCountryIds).toEqual([]);
    expect(exactMapFeedback.mapEvaluation!.incorrectCountryIds).toEqual([]);

    // Direct check on evaluateCoverageMapSelection with partial + false-alarm clicks
    const americasPool = getCountriesForCoverageFocus('Americas');
    const americasUncoveredIds = americasPool
      .filter((c) => c.coverageTier === 'none')
      .map((c) => c.id);
    const uncoveredEval = evaluateCoverageMapSelection(
      americasUncoveredIds,
      ['ve', 'cu', 'br'], // 'br' is Official -> false alarm; 'py' & 'ht' missed
      americasPool
    );
    expect(uncoveredEval.perfect).toBe(false);
    expect(uncoveredEval.correctCountryIds.sort()).toEqual(['cu', 've']);
    expect(uncoveredEval.missedCountryIds).toEqual(
      expect.arrayContaining(['py', 'gy', 'hn'])
    );
    expect(uncoveredEval.incorrectCountryIds).toEqual(['br']);
  });

  it('tracks Coverage Mastery State progression (Unseen -> Learning -> Recognized -> Mastered) and supports Guided Breakdown with D=2 spaced follow-ups', async () => {
    const initialBreakdown = store.getSectionMasteryBreakdown('coverage');
    expect(initialBreakdown.unseen).toBe(145);
    expect(initialBreakdown.mastered).toBe(0);

    engine.startCoverageSession({
      focusId: 'Europe',
      drillMode: 'tier-speed',
    });

    // Request Guided Breakdown on first Coverage trial
    const firstTrial = engine.getCurrentTrial()!;
    const targetSkillId = firstTrial.skillId;
    const targetCountry = firstTrial.coveragePrompt!.targetCountry;
    const breakdown = engine.requestGuidedBreakdown();
    expect(breakdown.assisted).toBe(true);
    expect(breakdown.queuedFollowUps).toBe(2);
    expect(breakdown.coverageTier).toBe(targetCountry.coverageTier);
    expect(breakdown.coverageNote).toBe(targetCountry.coverageNote);
    expect(breakdown.distractorEliminations.length).toBe(2);

    // Submitting after Guided Breakdown records assisted: true -> Mastery State transitions to 'learning'
    const assistedFeedback = await engine.submitCoverageAnswer(
      `tier:${targetCountry.coverageTier}`,
      1800
    );
    expect(assistedFeedback.assisted).toBe(true);
    expect(assistedFeedback.newMastery).toBe('learning');

    const afterLearning = store.getSectionMasteryBreakdown('coverage');
    expect(afterLearning.learning).toBe(1);
    expect(afterLearning.unseen).toBe(144);

    // Weakest learning skills on Dashboard should include this Coverage skill
    const weakest = getWeakestLearningSkills(store.getState(), 10);
    expect(weakest.some((w) => w.skillId === targetSkillId && w.section === 'coverage')).toBe(
      true
    );

    // Advance 2 intervening trials (D=2) and verify the unassisted follow-up is delivered
    const i1 = engine.nextTrial();
    expect(i1.skillId).not.toBe(targetSkillId);
    await engine.submitCoverageAnswer(
      `tier:${i1.coveragePrompt!.targetCountry.coverageTier}`,
      1500
    );

    const i2 = engine.nextTrial();
    expect(i2.skillId).not.toBe(targetSkillId);
    await engine.submitCoverageAnswer(
      `tier:${i2.coveragePrompt!.targetCountry.coverageTier}`,
      1500
    );

    const followUp1 = engine.nextTrial();
    expect(followUp1.skillId).toBe(targetSkillId);
    expect(followUp1.isFollowUp).toBe(true);

    // Now record 4 consecutive unaided accurate but non-fluent attempts (4200ms > 3500ms) for 'cov:ng' -> reaches 'recognized'
    const ngAttempts: Array<{
      timestamp: number;
      correct: boolean;
      responseTimeMs: number;
      assisted: boolean;
      chosenSkillId: string;
      sampleId: string;
    }> = [];
    for (let i = 0; i < 4; i += 1) {
      ngAttempts.push({
        timestamp: currentTime + i * 1000,
        correct: true,
        responseTimeMs: 4200,
        assisted: false,
        chosenSkillId: 'cov:ng',
        sampleId: `cov-test-${i}`,
      });
      await store.recordAttempt({
        section: 'coverage',
        skillId: 'cov:ng',
        chosenSkillId: 'cov:ng',
        sampleId: `cov-test-${i}`,
        correct: true,
        responseTimeMs: 4200,
        assisted: false,
        mastery: calculateMasteryState(ngAttempts, 3500),
        trialIndex: 20 + i,
      });
    }
    expect(store.getState().skills['cov:ng'].mastery).toBe('recognized');

    // Now record 3 consecutive fast unaided correct attempts (<3.5s) -> reaches 'mastered'
    for (let i = 4; i < 7; i += 1) {
      ngAttempts.push({
        timestamp: currentTime + i * 1000,
        correct: true,
        responseTimeMs: 1950,
        assisted: false,
        chosenSkillId: 'cov:ng',
        sampleId: `cov-test-${i}`,
      });
      await store.recordAttempt({
        section: 'coverage',
        skillId: 'cov:ng',
        chosenSkillId: 'cov:ng',
        sampleId: `cov-test-${i}`,
        correct: true,
        responseTimeMs: 1950,
        assisted: false,
        mastery: calculateMasteryState(ngAttempts, 3500),
        trialIndex: 20 + i,
      });
    }
    expect(store.getState().skills['cov:ng'].mastery).toBe('mastered');
    expect(store.getSectionMasteryBreakdown('coverage').mastered).toBe(1);
  });
});
