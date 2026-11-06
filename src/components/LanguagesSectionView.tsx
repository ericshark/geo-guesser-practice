import React, { useCallback, useEffect, useId, useState } from 'react';
import {
  findTellMatchesInSample,
  LANGUAGE_GROUPS,
  LANGUAGE_MAP,
  LANGUAGES,
  type LanguageGroupSelectionId,
  type LanguageSample,
  type TellSpanMatch,
} from '../data/index.ts';
import type {
  ContrastCardPrime,
  LanguageDrillMode,
  LanguageTrialFeedback,
  PracticeEngine,
  PracticeTrial,
} from '../engine/practiceEngine.ts';
import type { ProgressData } from '../storage/index.ts';
import { buildHighlightedTextSegments } from '../utils/highlightSpans.ts';
import { MasteryBadge } from './MasteryBadge.tsx';

const TELL_HIGHLIGHT_CLASSES = [
  'bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 border-b-2 border-indigo-500 px-1 rounded-xs font-semibold',
  'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-b-2 border-amber-500 px-1 rounded-xs font-semibold',
  'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-b-2 border-rose-500 px-1 rounded-xs font-semibold',
  'bg-teal-500/20 text-teal-800 dark:text-teal-200 border-b-2 border-teal-500 px-1 rounded-xs font-semibold',
];

const TELL_BADGE_CLASSES = [
  'border-indigo-500/40 bg-indigo-500/12 text-indigo-800 dark:text-indigo-200',
  'border-amber-500/40 bg-amber-500/12 text-amber-800 dark:text-amber-200',
  'border-rose-500/40 bg-rose-500/12 text-rose-800 dark:text-rose-200',
  'border-teal-500/40 bg-teal-500/12 text-teal-800 dark:text-teal-200',
];

interface LanguagesSectionViewProps {
  engine: PracticeEngine;
  progress: ProgressData;
  initialGroup?: LanguageGroupSelectionId | null;
  onBackToDashboard: () => void;
}

export function LanguagesSectionView({
  engine,
  progress,
  initialGroup,
  onBackToDashboard,
}: LanguagesSectionViewProps) {
  const drillModeSelectId = useId();
  const [selectedGroup, setSelectedGroup] =
    useState<LanguageGroupSelectionId | null>(initialGroup ?? null);
  const [drillMode, setDrillMode] = useState<LanguageDrillMode>('mixed');
  const [stage0Prime, setStage0Prime] = useState<ContrastCardPrime | null>(
    null
  );
  const [activeTrial, setActiveTrial] = useState<PracticeTrial | null>(null);
  const [feedback, setFeedback] = useState<LanguageTrialFeedback | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  const launchGroupSession = useCallback(
    (
      groupId: LanguageGroupSelectionId,
      mode: LanguageDrillMode,
      skipPrime = false
    ) => {
      setSelectedGroup(groupId);
      engine.startLanguageSession({
        groupId,
        drillMode: mode,
        skipPrime,
      });
      setStage0Prime(engine.getStage0Prime());
      setActiveTrial(engine.getCurrentTrial());
      setFeedback(null);
      setElapsedMs(0);
    },
    [engine]
  );

  useEffect(() => {
    if (initialGroup) {
      launchGroupSession(initialGroup, drillMode);
    }
  }, [initialGroup]); // Intentionally run when initialGroup prop changes

  // Unobtrusive fluency response-time bar timer during active unanswered trial
  useEffect(() => {
    if (!activeTrial || feedback || stage0Prime) {
      return;
    }
    const start = performance.now();
    const interval = window.setInterval(() => {
      setElapsedMs(Math.round(performance.now() - start));
    }, 50);
    return () => window.clearInterval(interval);
  }, [activeTrial, feedback, stage0Prime]);

  const handleStartFromPrime = useCallback(async () => {
    const trial = await engine.completeStage0Prime();
    setStage0Prime(null);
    setActiveTrial(trial);
    setFeedback(null);
    setElapsedMs(0);
  }, [engine]);

  const handleSkipPrime = useCallback(() => {
    const trial = engine.skipStage0Prime();
    setStage0Prime(null);
    setActiveTrial(trial);
    setFeedback(null);
    setElapsedMs(0);
  }, [engine]);

  const handleSelectOption = useCallback(
    async (optionId: string) => {
      if (!activeTrial || feedback) return;
      const rt = Math.max(120, elapsedMs || Date.now() - activeTrial.startedAtMs);
      const result = await engine.submitAnswer(optionId, rt);
      setFeedback(result);
    },
    [activeTrial, elapsedMs, engine, feedback]
  );

  const handleNextTrial = useCallback(() => {
    const next = engine.nextTrial();
    setActiveTrial(next);
    setFeedback(null);
    setElapsedMs(0);
  }, [engine]);

  const handleExitToGroupPicker = useCallback(() => {
    setSelectedGroup(null);
    setStage0Prime(null);
    setActiveTrial(null);
    setFeedback(null);
  }, []);

  // Full keyboard navigation: 1..6 for choices, Enter to start/advance, Escape to exit
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.closest('dialog'))
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (selectedGroup) {
          e.preventDefault();
          handleExitToGroupPicker();
        } else {
          e.preventDefault();
          onBackToDashboard();
        }
        return;
      }

      if (stage0Prime) {
        if (e.key === 'Enter') {
          e.preventDefault();
          void handleStartFromPrime();
        }
        return;
      }

      if (activeTrial && !feedback) {
        const num = Number.parseInt(e.key, 10);
        if (num >= 1 && num <= activeTrial.options.length) {
          e.preventDefault();
          const chosen = activeTrial.options[num - 1];
          if (chosen) {
            void handleSelectOption(chosen.id);
          }
        }
        return;
      }

      if (activeTrial && feedback) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleNextTrial();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTrial,
    feedback,
    handleExitToGroupPicker,
    handleNextTrial,
    handleSelectOption,
    handleStartFromPrime,
    onBackToDashboard,
    selectedGroup,
    stage0Prime,
  ]);

  // 1. GROUP PICKER SCREEN
  if (!selectedGroup) {
    return (
      <div className="space-y-6">
        <div className="apple-card flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBackToDashboard}
                className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[0.8125rem] font-medium hover:bg-zinc-500/10"
              >
                ← Dashboard
              </button>
              <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--brand-accent)]">
                Section · Languages
              </span>
            </div>
            <h1 className="mt-2 text-[1.625rem] font-bold tracking-tight">
              Choose a Confusable Language Group
            </h1>
            <p className="mt-1 text-[0.875rem] text-[var(--text-secondary)]">
              Practice lookalike scripts and languages together using Stage 0{' '}
              <strong>Contrast Cards</strong> and Stage 1{' '}
              <strong>ARTS Interleaved Speed Drills</strong>.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <label
              htmlFor={drillModeSelectId}
              className="text-[0.75rem] font-medium text-[var(--text-secondary)]"
            >
              Drill Question Mix
            </label>
            <select
              id={drillModeSelectId}
              value={drillMode}
              onChange={(e) =>
                setDrillMode(e.target.value as LanguageDrillMode)
              }
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-1.5 text-[0.875rem] font-medium"
            >
              <option value="mixed">
                Mixed: Samples + Tell Recognition
              </option>
              <option value="samples">Sentences & Sign Text Only</option>
              <option value="tells">Tell Recognition Micro-Drills Only</option>
            </select>
          </div>
        </div>

        {/* All-Groups Mixed Banner */}
        <div className="apple-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center border-l-4 border-l-[var(--brand-accent)]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[1.0625rem] font-semibold">
                All-Groups Mixed ({LANGUAGES.length} Languages)
              </h2>
              <span className="rounded-full bg-[var(--brand-accent)]/15 px-2.5 py-0.5 text-[0.75rem] font-semibold text-[var(--brand-accent)]">
                Global Interleaved
              </span>
            </div>
            <p className="mt-1 text-[0.8125rem] text-[var(--text-secondary)]">
              Schedules across every Language Group using ARTS priority while
              keeping each question’s choices within its visually confusable
              group.
            </p>
          </div>
          <button
            type="button"
            onClick={() => launchGroupSession('all-mixed', drillMode, true)}
            className="shrink-0 rounded-xl bg-[var(--brand-accent)] px-4 py-2 text-[0.875rem] font-semibold text-white hover:opacity-95"
          >
            Start All-Groups Drill →
          </button>
        </div>

        {/* 10 Confusable Language Groups Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {LANGUAGE_GROUPS.map((group) => {
            const primed = progress.completedPrimes.includes(group.id);
            return (
              <div
                key={group.id}
                className="apple-card flex flex-col justify-between p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[1.0625rem] font-semibold">
                        {group.name}
                      </h2>
                      <p className="mt-0.5 text-[0.8125rem] text-[var(--text-secondary)]">
                        {group.description}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium border ${
                        primed
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-[var(--border-subtle)] bg-zinc-500/10 text-[var(--text-secondary)]'
                      }`}
                    >
                      {primed ? '✓ Prime Reviewed' : 'Stage 0 Prime Ready'}
                    </span>
                  </div>

                  {/* Languages list with live Mastery State */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {group.languageIds.map((langId) => {
                      const lang = LANGUAGE_MAP[langId];
                      const mastery =
                        progress.skills[`lang:${langId}`]?.mastery ?? 'unseen';
                      return (
                        <div
                          key={langId}
                          className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2.5 py-1.5 text-[0.8125rem]"
                        >
                          <span className="font-medium">{lang.name}</span>
                          <span className="text-[0.75rem] text-[var(--text-secondary)]">
                            {lang.nativeName}
                          </span>
                          <MasteryBadge state={mastery} size="xs" />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 border-t border-[var(--border-subtle)] pt-4">
                  <button
                    type="button"
                    onClick={() => launchGroupSession(group.id, drillMode, true)}
                    className="rounded-lg border border-[var(--border-subtle)] px-3.5 py-1.5 text-[0.8125rem] font-medium hover:bg-zinc-500/10"
                  >
                    Skip to Speed Drill
                  </button>
                  <button
                    type="button"
                    onClick={() => launchGroupSession(group.id, drillMode, false)}
                    className="rounded-lg bg-[var(--brand-accent)] px-4 py-1.5 text-[0.8125rem] font-semibold text-white hover:opacity-95"
                  >
                    Stage 0 Prime & Drill →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. STAGE 0 QUICK PRIME (CONTRAST CARD)
  if (stage0Prime) {
    return (
      <div className="space-y-6">
        <div className="apple-card p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExitToGroupPicker}
                  className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[0.8125rem] font-medium hover:bg-zinc-500/10"
                >
                  ← Language Groups
                </button>
                <span className="rounded-full bg-[var(--brand-accent)]/15 px-2.5 py-0.5 text-[0.75rem] font-semibold text-[var(--brand-accent)]">
                  Stage 0 Quick Prime · Contrast Card
                </span>
              </div>
              <h1 className="mt-2 text-[1.5rem] font-bold tracking-tight">
                {stage0Prime.groupName} — Side-by-Side Contrast Card
              </h1>
              <p className="mt-1 text-[0.875rem] text-[var(--text-secondary)]">
                {stage0Prime.primeSummary}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleSkipPrime}
                className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-[0.875rem] font-medium hover:bg-zinc-500/10"
              >
                Skip Prime
              </button>
              <button
                type="button"
                onClick={() => void handleStartFromPrime()}
                className="rounded-xl bg-[var(--brand-accent)] px-5 py-2.5 text-[0.875rem] font-semibold text-white hover:opacity-95"
              >
                Start Stage 1 Speed Drill (Enter) →
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {stage0Prime.languages.map((entry) => {
            const langSpec = LANGUAGE_MAP[entry.id];
            const sampleMatches = findTellMatchesInSample(
              entry.exampleSample,
              langSpec
            );
            return (
              <div
                key={entry.id}
                className="apple-card flex flex-col justify-between p-5 space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-[1.125rem] font-bold">
                        {entry.name}{' '}
                        <span className="font-normal text-[var(--text-secondary)]">
                          ({entry.nativeName})
                        </span>
                      </h2>
                      <p className="text-[0.75rem] font-medium text-[var(--text-secondary)]">
                        Script: {entry.script}
                      </p>
                    </div>
                    <MasteryBadge state={entry.mastery} />
                  </div>

                  {/* Key Tells */}
                  <div className="space-y-2">
                    <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Diagnostic Tells
                    </p>
                    {entry.tells.map((tell, idx) => (
                      <div
                        key={tell.id}
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-2.5 text-[0.8125rem]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md border px-2 py-0.5 font-mono text-[0.75rem] font-semibold ${
                              TELL_BADGE_CLASSES[idx % TELL_BADGE_CLASSES.length]
                            }`}
                          >
                            {tell.pattern}
                          </span>
                          <span className="font-semibold">{tell.label}</span>
                        </div>
                        <p className="mt-1 text-[0.75rem] text-[var(--text-secondary)]">
                          {tell.explanation}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Contrast & Gestalt Note */}
                  <div className="rounded-lg bg-[var(--surface-elevated)] p-3 text-[0.8125rem]">
                    <p>
                      <strong>How to distinguish:</strong> {entry.contrastNote}
                    </p>
                    <p className="mt-1 text-[var(--text-secondary)]">
                      <strong>Gestalt cue:</strong> {entry.gestaltNote}
                    </p>
                  </div>

                  {/* Highlighted Example Sample */}
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-3">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Sample ({entry.exampleSample.kind})
                    </p>
                    <p
                      lang={entry.id}
                      className="mt-1 text-[1rem] font-medium leading-relaxed"
                    >
                      <HighlightedSampleText
                        sample={entry.exampleSample}
                        matches={sampleMatches}
                      />
                    </p>
                    <p className="mt-1 text-[0.75rem] text-[var(--text-secondary)] italic">
                      “{entry.exampleSample.translation}”
                    </p>
                  </div>
                </div>

                {/* Covered Candidate Countries */}
                <div className="border-t border-[var(--border-subtle)] pt-3">
                  <p className="text-[0.75rem] font-semibold text-[var(--text-secondary)]">
                    Street View Candidate Countries:
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {entry.candidateCountries.map((country) => (
                      <span
                        key={country.id}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2 py-0.5 text-[0.75rem] font-medium"
                      >
                        <span>{country.name}</span>
                        <span className="text-[0.6875rem] text-[var(--text-secondary)]">
                          ({country.coverageTier}, {country.drivingSide})
                        </span>
                      </span>
                    ))}
                  </div>
                  {entry.uncoveredCountryNotes.length > 0 && (
                    <p className="mt-1.5 text-[0.6875rem] text-[var(--text-secondary)]">
                      Note: {entry.uncoveredCountryNotes.join(' ')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 3. STAGE 1 ARTS INTERLEAVED SPEED DRILL
  if (!activeTrial) {
    return null;
  }

  const sessionStats = engine.getSessionStats();
  const displayRt = feedback ? feedback.responseTimeMs : elapsedMs;
  const fluencyRatio = Math.min(
    1,
    displayRt / activeTrial.fluencyThresholdMs
  );
  const isUnderFluencyThreshold = displayRt <= activeTrial.fluencyThresholdMs;
  const currentMastery =
    progress.skills[activeTrial.skillId]?.mastery ?? 'unseen';

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Drill Header & Calm Fluency Bar */}
      <div className="apple-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExitToGroupPicker}
              className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[0.8125rem] font-medium hover:bg-zinc-500/10"
            >
              ← Groups (Esc)
            </button>
            <div>
              <h1 className="text-[1rem] font-semibold">
                {activeTrial.groupName}
              </h1>
              <p className="text-[0.75rem] text-[var(--text-secondary)]">
                Stage 1 ARTS Interleaved Speed Drill · Trial #
                {activeTrial.trialNumber}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[0.8125rem]">
            {selectedGroup !== 'all-mixed' && (
              <button
                type="button"
                onClick={() =>
                  launchGroupSession(selectedGroup, drillMode, false)
                }
                className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[0.75rem] font-medium hover:bg-zinc-500/10"
              >
                View Contrast Card
              </button>
            )}
            <span className="rounded-lg bg-[var(--surface-canvas)] px-2.5 py-1 border border-[var(--border-subtle)]">
              Accuracy:{' '}
              <strong>
                {sessionStats.trialsCompleted > 0
                  ? `${Math.round(
                      (sessionStats.correctCount /
                        sessionStats.trialsCompleted) *
                        100
                    )}%`
                  : '—'}
              </strong>
            </span>
            <span className="rounded-lg bg-[var(--surface-canvas)] px-2.5 py-1 border border-[var(--border-subtle)]">
              Fluent (&lt;3.5s):{' '}
              <strong>
                {sessionStats.fluentCount}/{sessionStats.trialsCompleted}
              </strong>
            </span>
          </div>
        </div>

        {/* Non-punishing Fluency Indicator Bar */}
        <div className="mt-3.5">
          <div className="flex items-center justify-between text-[0.75rem] text-[var(--text-secondary)]">
            <span>
              Fluency window ({activeTrial.fluencyThresholdMs / 1000}s target
              for automaticity)
            </span>
            <span className="font-mono">
              {(displayRt / 1000).toFixed(1)}s{' '}
              {isUnderFluencyThreshold ? '· Automatic pace' : '· Inspection pace'}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Fluency response time indicator"
            aria-valuemin={0}
            aria-valuemax={activeTrial.fluencyThresholdMs}
            aria-valuenow={Math.min(displayRt, activeTrial.fluencyThresholdMs)}
            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-500/15"
          >
            <div
              className={`h-full transition-all duration-75 ${
                isUnderFluencyThreshold
                  ? 'bg-[var(--brand-accent)]'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.round(fluencyRatio * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Prompt Card */}
      <div className="apple-card p-6 sm:p-8">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-1 text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            {activeTrial.kind === 'tell-recognition'
              ? '◆ Tell Recognition Micro-Question'
              : activeTrial.sample.kind === 'sign'
                ? '▣ Street / Shop Sign Text'
                : '¶ Authentic Sentence Sample'}
          </span>
          {feedback && <MasteryBadge state={feedback.newMastery} />}
          {!feedback && <MasteryBadge state={currentMastery} />}
        </div>

        {activeTrial.kind === 'tell-recognition' && activeTrial.tellPrompt ? (
          <div className="mt-5 space-y-3">
            <p className="text-[0.875rem] font-medium text-[var(--text-secondary)]">
              Which language in this group is identified by this diagnostic{' '}
              <strong>Tell</strong>?
            </p>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-6 text-center">
              <p className="font-mono text-[1.75rem] font-bold tracking-wide sm:text-[2.125rem]">
                {activeTrial.tellPrompt.pattern}
              </p>
              <p className="mt-2 text-[0.875rem] text-[var(--text-secondary)]">
                Script family: {activeTrial.tellPrompt.script}
              </p>
            </div>
          </div>
        ) : (
          <div
            className={`mt-5 rounded-xl border p-6 ${
              activeTrial.sample.kind === 'sign'
                ? 'border-2 border-[var(--border-subtle)] bg-[var(--surface-canvas)] tracking-wide'
                : 'border-[var(--border-subtle)] bg-[var(--surface-canvas)]'
            }`}
          >
            <p
              lang={feedback ? activeTrial.languageId : undefined}
              className="text-[1.375rem] font-medium leading-relaxed sm:text-[1.625rem]"
            >
              {feedback ? (
                <HighlightedSampleText
                  sample={feedback.sample}
                  matches={feedback.matchedTells}
                />
              ) : (
                activeTrial.sample.text
              )}
            </p>
          </div>
        )}

        {/* Choice Buttons (1..6) */}
        <div
          className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3"
          role="group"
          aria-label="Language choices"
        >
          {activeTrial.options.map((option) => {
            const isExpected = feedback && option.id === feedback.skillId;
            const isChosenWrong =
              feedback &&
              !feedback.correct &&
              option.id === feedback.chosenOptionId;

            let buttonStyle =
              'border-[var(--border-subtle)] bg-[var(--surface-canvas)] hover:border-[var(--brand-accent)]';
            if (isExpected) {
              buttonStyle =
                'border-emerald-500 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100';
            } else if (isChosenWrong) {
              buttonStyle =
                'border-rose-500 bg-rose-500/15 text-rose-900 dark:text-rose-100';
            } else if (feedback) {
              buttonStyle =
                'border-[var(--border-subtle)] bg-[var(--surface-canvas)] opacity-60';
            }

            return (
              <button
                key={option.id}
                type="button"
                disabled={Boolean(feedback)}
                onClick={() => void handleSelectOption(option.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition ${buttonStyle}`}
              >
                <div className="min-w-0 pr-2">
                  <p className="text-[0.9375rem] font-semibold">
                    {option.label}
                  </p>
                  <p className="truncate text-[0.75rem] text-[var(--text-secondary)]">
                    {option.sublabel}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {isExpected && (
                    <span
                      aria-hidden="true"
                      className="text-emerald-600 dark:text-emerald-400 font-bold"
                    >
                      ✓
                    </span>
                  )}
                  {isChosenWrong && (
                    <span
                      aria-hidden="true"
                      className="text-rose-600 dark:text-rose-400 font-bold"
                    >
                      ✗
                    </span>
                  )}
                  <kbd className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2 py-0.5 font-mono text-[0.75rem] font-semibold">
                    {option.shortcutKey}
                  </kbd>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Immediate (<100ms) Task-Focused Feedback Panel */}
      {feedback && (
        <section
          aria-label="Trial feedback"
          aria-live="polite"
          className="apple-card p-6 sm:p-8 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-[1.125rem] font-bold ${
                  feedback.correct
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                }`}
                aria-hidden="true"
              >
                {feedback.correct ? '✓' : '✗'}
              </span>
              <div>
                <h2 className="text-[1.125rem] font-bold">
                  {feedback.correct ? 'Correct — ' : `Incorrect — Answer is `}
                  <span>
                    {feedback.languageName} ({feedback.nativeName})
                  </span>
                </h2>
                <p className="text-[0.8125rem] text-[var(--text-secondary)]">
                  Response time: {(feedback.responseTimeMs / 1000).toFixed(2)}s{' '}
                  {feedback.isFluentSpeed
                    ? '· Fluent (<3.5s automatic recognition)'
                    : '· Above 3.5s fluency threshold (scheduled sooner via ARTS)'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNextTrial}
              className="rounded-xl bg-[var(--brand-accent)] px-5 py-2.5 text-[0.875rem] font-semibold text-white hover:opacity-95"
            >
              Next Trial (Enter) →
            </button>
          </div>

          {/* Highlighted Sample + English Translation */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-4">
            <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Sample with Highlighted Tells & Translation
            </p>
            <p
              lang={feedback.languageId}
              className="mt-1.5 text-[1.125rem] font-medium leading-relaxed"
            >
              <HighlightedSampleText
                sample={feedback.sample}
                matches={feedback.matchedTells}
              />
            </p>
            <p className="mt-1.5 text-[0.875rem] text-[var(--text-secondary)] italic">
              “{feedback.translation}”
            </p>
          </div>

          {/* Matched Tells & Structural/Gestalt Clues */}
          <div className="space-y-3">
            <h3 className="text-[0.875rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              What to Look For (Tells & Pattern Clues)
            </h3>

            {feedback.matchedTells.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {feedback.matchedTells.map((match) => (
                  <div
                    key={match.tellId}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-3.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md border px-2 py-0.5 font-mono text-[0.75rem] font-semibold ${
                          TELL_BADGE_CLASSES[
                            match.colorIndex % TELL_BADGE_CLASSES.length
                          ]
                        }`}
                      >
                        {match.spans.map((s) => s.text).join(', ')}
                      </span>
                      <span className="text-[0.875rem] font-semibold">
                        {match.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[0.8125rem] text-[var(--text-secondary)]">
                      {match.explanation}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-4 text-[0.875rem]">
                <p className="font-semibold">
                  No single-character Tell in this Sample — use Gestalt /
                  Structural Clue:
                </p>
                {feedback.structuralClue && (
                  <p className="mt-1 text-[var(--text-secondary)]">
                    {feedback.structuralClue}
                  </p>
                )}
                <p className="mt-1 text-[var(--text-secondary)]">
                  {feedback.gestaltNote}
                </p>
              </div>
            )}

            {feedback.structuralClue && feedback.matchedTells.length > 0 && (
              <p className="text-[0.8125rem] text-[var(--text-secondary)]">
                <strong>Structural note:</strong> {feedback.structuralClue}
              </p>
            )}

            <p className="text-[0.8125rem] text-[var(--text-secondary)]">
              <strong>Group contrast:</strong> {feedback.contrastNote}
            </p>
          </div>

          {/* Chosen Wrong Language Contrast */}
          {feedback.chosenLanguageContrast && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-[0.8125rem]">
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                Why not {feedback.chosenLanguageContrast.languageName}?
              </p>
              <p className="mt-1 text-[var(--text-secondary)]">
                {feedback.chosenLanguageContrast.contrastNote} Key{' '}
                {feedback.chosenLanguageContrast.languageName} tells:{' '}
                {feedback.chosenLanguageContrast.keyTells
                  .map((t) => `${t.pattern} (${t.label})`)
                  .join(' · ')}
              </p>
            </div>
          )}

          {/* Covered Candidate Countries */}
          <div className="border-t border-[var(--border-subtle)] pt-4">
            <h3 className="text-[0.875rem] font-semibold">
              Playable Street View Candidate Countries (
              {feedback.candidateCountries.length})
            </h3>
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
              {feedback.candidateCountries.map((country) => (
                <div
                  key={country.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-3 text-[0.8125rem]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{country.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold capitalize ${
                        country.coverageTier === 'official'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {country.coverageTier}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.75rem] text-[var(--text-secondary)]">
                    Drives <strong>{country.drivingSide}</strong> ·{' '}
                    <code>{country.tld}</code> ·{' '}
                    {country.currencies.map((c) => c.symbol).join('/')}
                  </p>
                </div>
              ))}
            </div>
            {feedback.uncoveredCountryNotes.length > 0 && (
              <p className="mt-2.5 text-[0.75rem] text-[var(--text-secondary)]">
                <strong>Uncovered footnote:</strong>{' '}
                {feedback.uncoveredCountryNotes.join(' ')}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function HighlightedSampleText({
  sample,
  matches,
}: {
  sample: LanguageSample;
  matches: TellSpanMatch[];
}) {
  const segments = buildHighlightedTextSegments(sample.text, matches);
  return (
    <>
      {segments.map((seg, idx) =>
        seg.tellMatch ? (
          <mark
            key={idx}
            title={`${seg.tellMatch.label} (${seg.tellMatch.pattern})`}
            className={
              TELL_HIGHLIGHT_CLASSES[
                seg.tellMatch.colorIndex % TELL_HIGHLIGHT_CLASSES.length
              ]
            }
          >
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
}
