import { useCallback, useEffect, useId, useState } from 'react';
import {
  LANGUAGE_GROUPS,
  LANGUAGE_MAP,
  LANGUAGES,
  PLAYABLE_COUNTRY_MAP,
  type LanguageGroupSelectionId,
  type MapRegionPresetId,
} from '../data/index.ts';
import type {
  ContrastCardPrime,
  GuidedBreakdown,
  LanguageDrillMode,
  LanguageTrialFeedback,
  PracticeEngine,
  PracticeTrial,
} from '../engine/practiceEngine.ts';
import type { ProgressData } from '../storage/index.ts';
import { HighlightedSampleText, LanguageContrastGrid, TELL_BADGE_CLASSES } from './LanguageContrastGrid.tsx';
import { MasteryBadge } from './MasteryBadge.tsx';
import { WorldMapView } from './WorldMapView.tsx';

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
  const breakdownHeadingId = useId();
  const [selectedGroup, setSelectedGroup] =
    useState<LanguageGroupSelectionId | null>(initialGroup ?? null);
  const [drillMode, setDrillMode] = useState<LanguageDrillMode>('mixed');
  const [stage0Prime, setStage0Prime] = useState<ContrastCardPrime | null>(
    () => engine.getStage0Prime()
  );
  const [activeTrial, setActiveTrial] = useState<PracticeTrial | null>(() =>
    engine.getCurrentTrial()
  );
  const [activeBreakdown, setActiveBreakdown] =
    useState<GuidedBreakdown | null>(() => engine.getActiveGuidedBreakdown());
  const [feedback, setFeedback] = useState<LanguageTrialFeedback | null>(() =>
    engine.getLastFeedback()
  );
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [selectedMapCountryIds, setSelectedMapCountryIds] = useState<string[]>(
    []
  );
  const [mapRegionPreset, setMapRegionPreset] =
    useState<MapRegionPresetId>('world');

  // Sync map preset & clear map selection when a new trial starts
  useEffect(() => {
    setSelectedMapCountryIds([]);
    if (activeTrial?.kind === 'country-bridge' && activeTrial.bridgePrompt) {
      setMapRegionPreset(activeTrial.bridgePrompt.suggestedRegionPreset);
    } else {
      setMapRegionPreset('world');
    }
  }, [activeTrial?.trialNumber, activeTrial?.kind]);

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
        skipPrime:
          skipPrime || groupId === 'all-mixed' || groupId === 'smart-weakest',
      });
      setStage0Prime(engine.getStage0Prime());
      setActiveTrial(engine.getCurrentTrial());
      setActiveBreakdown(null);
      setFeedback(null);
      setElapsedMs(0);
      setSelectedMapCountryIds([]);
    },
    [engine]
  );

  useEffect(() => {
    if (initialGroup) {
      launchGroupSession(
        initialGroup,
        drillMode,
        initialGroup === 'all-mixed' || initialGroup === 'smart-weakest'
      );
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
    setActiveBreakdown(null);
    setFeedback(null);
    setElapsedMs(0);
    setSelectedMapCountryIds([]);
  }, [engine]);

  const handleSkipPrime = useCallback(() => {
    const trial = engine.skipStage0Prime();
    setStage0Prime(null);
    setActiveTrial(trial);
    setActiveBreakdown(null);
    setFeedback(null);
    setElapsedMs(0);
    setSelectedMapCountryIds([]);
  }, [engine]);

  const handleRequestGuidedBreakdown = useCallback(() => {
    if (!activeTrial || feedback) return;
    const breakdown = engine.requestGuidedBreakdown();
    setActiveBreakdown(breakdown);
  }, [activeTrial, engine, feedback]);

  const handleDismissGuidedBreakdown = useCallback(() => {
    engine.dismissGuidedBreakdown();
    setActiveBreakdown(null);
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

  const handleToggleMapCountry = useCallback(
    (countryId: string) => {
      if (feedback) return;
      setSelectedMapCountryIds((prev) =>
        prev.includes(countryId)
          ? prev.filter((id) => id !== countryId)
          : [...prev, countryId]
      );
    },
    [feedback]
  );

  const handleSubmitCountryBridge = useCallback(
    async (overrideIds?: string[]) => {
      if (!activeTrial || activeTrial.kind !== 'country-bridge' || feedback) {
        return;
      }
      const idsToSubmit = overrideIds ?? selectedMapCountryIds;
      if (overrideIds) {
        setSelectedMapCountryIds(overrideIds);
      }
      const rt = Math.max(120, elapsedMs || Date.now() - activeTrial.startedAtMs);
      const result = await engine.submitCountryBridgeAnswer(idsToSubmit, rt);
      setFeedback(result);
    },
    [activeTrial, elapsedMs, engine, feedback, selectedMapCountryIds]
  );

  const handleNextTrial = useCallback(() => {
    const next = engine.nextTrial();
    setActiveTrial(next);
    setActiveBreakdown(null);
    setFeedback(null);
    setElapsedMs(0);
    setSelectedMapCountryIds([]);
  }, [engine]);

  const handleExitToGroupPicker = useCallback(() => {
    setSelectedGroup(null);
    setStage0Prime(null);
    setActiveTrial(null);
    setActiveBreakdown(null);
    setFeedback(null);
    setSelectedMapCountryIds([]);
  }, []);

  // Full keyboard navigation: 1..6 for choices, Space or ? for Guided Breakdown, Enter to start/submit/advance, Escape to close overlay or exit
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
        if (activeBreakdown && !feedback) {
          e.preventDefault();
          handleDismissGuidedBreakdown();
          return;
        }
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
        if (
          e.key === '?' ||
          (e.key === ' ' && target?.tagName !== 'BUTTON')
        ) {
          e.preventDefault();
          handleRequestGuidedBreakdown();
          return;
        }

        if (e.key === 'Enter' && activeBreakdown) {
          e.preventDefault();
          if (activeTrial.kind === 'country-bridge') {
            void handleSubmitCountryBridge(
              activeBreakdown.candidateCountries.map((c) => c.id)
            );
          } else {
            void handleSelectOption(activeTrial.skillId);
          }
          return;
        }

        if (
          e.key === 'Enter' &&
          activeTrial.kind === 'country-bridge' &&
          target?.tagName !== 'BUTTON'
        ) {
          e.preventDefault();
          void handleSubmitCountryBridge();
          return;
        }

        if (activeTrial.kind !== 'country-bridge') {
          const num = Number.parseInt(e.key, 10);
          if (num >= 1 && num <= activeTrial.options.length) {
            e.preventDefault();
            const chosen = activeTrial.options[num - 1];
            if (chosen) {
              void handleSelectOption(chosen.id);
            }
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
    activeBreakdown,
    activeTrial,
    feedback,
    handleDismissGuidedBreakdown,
    handleExitToGroupPicker,
    handleNextTrial,
    handleRequestGuidedBreakdown,
    handleSelectOption,
    handleStartFromPrime,
    handleSubmitCountryBridge,
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
              <strong>Contrast Cards</strong>, Stage 1{' '}
              <strong>ARTS Interleaved Speed Drills</strong>, Stage 2{' '}
              <strong>Triggered Contrast Cards</strong>, and Stage 3{' '}
              <strong>Language → Candidate Countries Bridge</strong>.
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
                Mixed: Samples + Tell Recognition + Country Bridge
              </option>
              <option value="samples">Sentences & Sign Text Only</option>
              <option value="tells">Tell Recognition Micro-Drills Only</option>
              <option value="bridge">
                Stage 3 Language → Country Bridge Map Drills
              </option>
            </select>
          </div>
        </div>

        {/* Smart Practice & All-Groups Mixed Banners */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="apple-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center border-l-4 border-l-amber-500">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[1.0625rem] font-semibold">
                  Smart Practice (Weakest Spots)
                </h2>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[0.75rem] font-semibold text-amber-700 dark:text-amber-300">
                  Adaptive Priority
                </span>
              </div>
              <p className="mt-1 text-[0.8125rem] text-[var(--text-secondary)]">
                Targets your active Learning skills, recent Guided Breakdowns,
                and top confusion pairs across groups.
              </p>
            </div>
            <button
              type="button"
              onClick={() => launchGroupSession('smart-weakest', drillMode, true)}
              className="shrink-0 rounded-xl bg-[var(--brand-accent)] px-4 py-2 text-[0.875rem] font-semibold text-white hover:opacity-95"
            >
              Start Smart Practice →
            </button>
          </div>

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
              className="shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-2 text-[0.875rem] font-semibold hover:border-[var(--brand-accent)]"
            >
              Start All-Groups Drill →
            </button>
          </div>
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

        <LanguageContrastGrid languages={stage0Prime.languages} />
      </div>
    );
  }

  // 3. STAGE 1 ARTS SPEED DRILL, STAGE 2 TRIGGERED CONTRAST CARD, & STAGE 3 COUNTRY BRIDGE
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

  const shouldHighlightPromptTells = Boolean(
    feedback || activeBreakdown || activeTrial.kind === 'country-bridge'
  );
  const promptHighlightMatches = feedback
    ? feedback.matchedTells
    : activeBreakdown
      ? activeBreakdown.matchedTells
      : activeTrial.bridgePrompt
        ? activeTrial.bridgePrompt.matchedTells
        : [];

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
                {activeTrial.kind === 'triggered-contrast'
                  ? `Stage 2 Triggered Contrast Card · Trial #${activeTrial.trialNumber}`
                  : activeTrial.kind === 'country-bridge'
                    ? `Stage 3 Language → Country Bridge · Trial #${activeTrial.trialNumber}`
                    : activeTrial.isFollowUp
                      ? `Guided Breakdown Follow-Up Drill · Trial #${activeTrial.trialNumber}`
                      : `Stage 1 ARTS Interleaved Speed Drill · Trial #${activeTrial.trialNumber}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[0.8125rem]">
            {selectedGroup !== 'all-mixed' &&
              selectedGroup !== 'smart-weakest' && (
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
              Fluent:{' '}
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
      <div className="apple-card p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-1 text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              {activeTrial.kind === 'triggered-contrast'
                ? '⇄ Stage 2 Triggered Contrast Card'
                : activeTrial.kind === 'country-bridge'
                  ? '🌐 Stage 3 Language → Country Bridge'
                  : activeTrial.kind === 'tell-recognition'
                    ? '◆ Tell Recognition Micro-Question'
                    : activeTrial.sample.kind === 'sign'
                      ? '▣ Street / Shop Sign Text'
                      : '¶ Authentic Sentence Sample'}
            </span>
            {activeTrial.isFollowUp && (
              <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[0.75rem] font-semibold text-indigo-700 dark:text-indigo-300">
                Reinforcement Follow-Up
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {!feedback && activeTrial.kind !== 'triggered-contrast' && (
              <button
                type="button"
                aria-expanded={Boolean(activeBreakdown)}
                onClick={handleRequestGuidedBreakdown}
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[0.8125rem] font-semibold text-amber-800 dark:text-amber-200 transition hover:bg-amber-500/20"
              >
                Show me what to look for (? / Space)
              </button>
            )}
            {feedback ? (
              <MasteryBadge state={feedback.newMastery} />
            ) : (
              <MasteryBadge state={currentMastery} />
            )}
          </div>
        </div>

        {/* STAGE 2 TRIGGERED SIDE-BY-SIDE CONTRAST CARD BODY */}
        {activeTrial.kind === 'triggered-contrast' &&
        activeTrial.triggeredContrast ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-[0.875rem]">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Confusion Pair Triggered ({activeTrial.triggeredContrast.confusionCount}
                × recent confusion):{' '}
                {activeTrial.triggeredContrast.leftSide.name} vs{' '}
                {activeTrial.triggeredContrast.rightSide.name}
              </p>
              <p className="mt-1 text-[0.8125rem] text-[var(--text-secondary)]">
                Compare both Samples side by side with their distinguishing{' '}
                <strong>Tells</strong> highlighted below, then select the
                matching language assignment to boost priority for both skills.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                {
                  slotLabel: 'Left Sample',
                  side: activeTrial.triggeredContrast.leftSide,
                },
                {
                  slotLabel: 'Right Sample',
                  side: activeTrial.triggeredContrast.rightSide,
                },
              ].map(({ slotLabel, side }) => (
                <div
                  key={side.skillId}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-[var(--brand-accent)]/15 px-2.5 py-0.5 text-[0.75rem] font-semibold text-[var(--brand-accent)]">
                      {slotLabel}
                    </span>
                    <span className="text-[0.75rem] text-[var(--text-secondary)]">
                      Script: {side.script}
                    </span>
                  </div>

                  <p
                    lang={side.languageId}
                    className="text-[1.1875rem] font-medium leading-relaxed"
                  >
                    <HighlightedSampleText
                      sample={side.sample}
                      matches={side.matchedTells}
                    />
                  </p>
                  <p className="text-[0.8125rem] text-[var(--text-secondary)] italic">
                    “{side.sample.translation}”
                  </p>

                  <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-2.5 text-[0.75rem]">
                    <p className="font-semibold text-[var(--text-secondary)]">
                      Distinguishing Tells ({side.name}):
                    </p>
                    {side.tells.slice(0, 2).map((tell, idx) => (
                      <div key={tell.id} className="flex items-start gap-2">
                        <span
                          className={`shrink-0 rounded-xs border px-1.5 py-0.5 font-mono font-semibold ${
                            TELL_BADGE_CLASSES[idx % TELL_BADGE_CLASSES.length]
                          }`}
                        >
                          {tell.pattern}
                        </span>
                        <span>
                          <strong>{tell.label}:</strong> {tell.explanation}
                        </span>
                      </div>
                    ))}
                    <p className="pt-1 text-[var(--text-secondary)]">
                      <strong>Contrast rule:</strong> {side.contrastNote}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTrial.kind === 'country-bridge' && activeTrial.bridgePrompt ? (
          <div className="space-y-4" data-testid="country-bridge-prompt">
            <div className="rounded-xl border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/8 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--brand-accent)]">
                    Stage 3 Language → Candidate Countries Bridge
                  </span>
                  <h2 className="mt-0.5 text-[1.25rem] font-bold">
                    {activeTrial.bridgePrompt.languageName}{' '}
                    <span className="font-normal text-[var(--text-secondary)]">
                      ({activeTrial.bridgePrompt.nativeName} ·{' '}
                      {activeTrial.bridgePrompt.script})
                    </span>
                  </h2>
                </div>
              </div>
              <p className="mt-1.5 text-[0.875rem] text-[var(--text-secondary)]">
                Click or select all Street View-covered{' '}
                <strong>Candidate Countries</strong> where{' '}
                <strong>{activeTrial.bridgePrompt.languageName}</strong> appears
                on road signs. Exclude countries with{' '}
                <code>coverageTier === &apos;none&apos;</code>.
              </p>
              <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-3">
                <p
                  lang={activeTrial.languageId}
                  className="text-[1.125rem] font-medium leading-relaxed"
                >
                  <HighlightedSampleText
                    sample={activeTrial.sample}
                    matches={promptHighlightMatches}
                  />
                </p>
                <p className="mt-1 text-[0.75rem] text-[var(--text-secondary)] italic">
                  “{activeTrial.sample.translation}”
                </p>
              </div>
            </div>

            <WorldMapView
              selectedCountryIds={selectedMapCountryIds}
              onToggleCountry={handleToggleMapCountry}
              evaluation={feedback?.mapEvaluation ?? null}
              activeRegionPreset={mapRegionPreset}
              onRegionPresetChange={setMapRegionPreset}
              readOnly={Boolean(feedback)}
              ariaLabel={`Select Street View Candidate Countries for ${activeTrial.bridgePrompt.languageName}`}
            />

            {/* Selected Countries Action Bar */}
            {!feedback && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-3.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
                  <span className="font-semibold text-[var(--text-secondary)]">
                    Selected ({selectedMapCountryIds.length}):
                  </span>
                  {selectedMapCountryIds.length === 0 ? (
                    <span className="text-[var(--text-secondary)]">
                      None yet — click countries or territory pills on the map above
                    </span>
                  ) : (
                    selectedMapCountryIds.map((id) => {
                      const country = PLAYABLE_COUNTRY_MAP[id];
                      return (
                        <button
                          key={`selected-chip-${id}`}
                          type="button"
                          onClick={() => handleToggleMapCountry(id)}
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-accent)]/15 px-2.5 py-0.5 text-[0.75rem] font-semibold text-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/25"
                        >
                          <span>{country?.name ?? id.toUpperCase()}</span>
                          <span aria-hidden="true">×</span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedMapCountryIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedMapCountryIds([])}
                      className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-zinc-500/10"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid="submit-country-bridge-btn"
                    onClick={() => void handleSubmitCountryBridge()}
                    className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 text-[0.875rem] font-semibold text-white hover:opacity-95"
                  >
                    Submit Map Selection (Enter) →
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeTrial.kind === 'tell-recognition' && activeTrial.tellPrompt ? (
          <div className="space-y-3">
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
            className={`rounded-xl border p-6 ${
              activeTrial.sample.kind === 'sign'
                ? 'border-2 border-[var(--border-subtle)] bg-[var(--surface-canvas)] tracking-wide'
                : 'border-[var(--border-subtle)] bg-[var(--surface-canvas)]'
            }`}
          >
            <p
              lang={shouldHighlightPromptTells ? activeTrial.languageId : undefined}
              className="text-[1.375rem] font-medium leading-relaxed sm:text-[1.625rem]"
            >
              {shouldHighlightPromptTells ? (
                <HighlightedSampleText
                  sample={activeTrial.sample}
                  matches={promptHighlightMatches}
                />
              ) : (
                activeTrial.sample.text
              )}
            </p>
          </div>
        )}

        {/* ON-DEMAND GUIDED BREAKDOWN OVERLAY ON CURRENT PROMPT */}
        {activeBreakdown && !feedback && (
          <section
            aria-labelledby={breakdownHeadingId}
            className="rounded-2xl border-2 border-amber-500/40 bg-[var(--surface-elevated)] p-5 space-y-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-3.5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[0.75rem] font-semibold text-amber-800 dark:text-amber-200">
                    Guided Breakdown · Assisted Exposure
                  </span>
                  <span className="text-[0.75rem] text-[var(--text-secondary)]">
                    Queued {activeBreakdown.queuedFollowUps} follow-up drills
                    after spacing delay D = 2
                  </span>
                </div>
                <h2
                  id={breakdownHeadingId}
                  className="mt-1.5 text-[1.125rem] font-bold"
                >
                  What to look for: {activeBreakdown.languageName} (
                  {activeBreakdown.nativeName})
                </h2>
                <p className="text-[0.8125rem] text-[var(--text-secondary)] italic">
                  Translation: “{activeBreakdown.translation}”
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDismissGuidedBreakdown}
                  className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[0.75rem] font-medium hover:bg-zinc-500/10"
                >
                  Hide Overlay (Esc)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeTrial.kind === 'country-bridge') {
                      void handleSubmitCountryBridge(
                        activeBreakdown.candidateCountries.map((c) => c.id)
                      );
                    } else {
                      void handleSelectOption(activeBreakdown.skillId);
                    }
                  }}
                  className="rounded-lg bg-[var(--brand-accent)] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-white hover:opacity-95"
                >
                  {activeTrial.kind === 'country-bridge'
                    ? `Got it — Select Candidate Countries (Enter) →`
                    : `Got it — Select ${activeBreakdown.languageName} (Enter) →`}
                </button>
              </div>
            </div>

            {/* 1. Highlighted Tells or Structural/Gestalt Clues */}
            <div className="space-y-2.5">
              <h3 className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                1. Diagnostic Tells & Clues on This Prompt
              </h3>
              {activeBreakdown.matchedTells.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {activeBreakdown.matchedTells.map((match) => (
                    <div
                      key={match.tellId}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-3 text-[0.8125rem]"
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
                        <span className="font-semibold">{match.label}</span>
                      </div>
                      <p className="mt-1 text-[var(--text-secondary)]">
                        {match.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-3.5 text-[0.8125rem]">
                  <p className="font-semibold">
                    Structural / Gestalt Clue (No single-character Tell in this
                    short Sample):
                  </p>
                  {activeBreakdown.structuralClue && (
                    <p className="mt-1 text-[var(--text-secondary)]">
                      {activeBreakdown.structuralClue}
                    </p>
                  )}
                  <p className="mt-1 text-[var(--text-secondary)]">
                    {activeBreakdown.gestaltNote}
                  </p>
                </div>
              )}
              <p className="text-[0.8125rem] text-[var(--text-secondary)]">
                <strong>Group contrast rule:</strong>{' '}
                {activeBreakdown.contrastNote}
              </p>
            </div>

            {/* 2. Distractor Elimination */}
            {activeBreakdown.distractorEliminations.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  2. Why Each Distractor Option Is Ruled Out
                </h3>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="list">
                  {activeBreakdown.distractorEliminations.map((elim) => (
                    <li
                      key={elim.optionId}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-3 text-[0.75rem]"
                    >
                      <p className="font-semibold">
                        ✗ {elim.languageName}{' '}
                        <span className="font-normal text-[var(--text-secondary)]">
                          ({elim.nativeName})
                        </span>
                      </p>
                      <p className="mt-1 text-[var(--text-secondary)]">
                        {elim.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 3. Candidate Countries */}
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3 text-[0.75rem]">
              <span className="font-semibold text-[var(--text-secondary)]">
                Covered Candidate Countries:
              </span>
              {activeBreakdown.candidateCountries.map((country) => (
                <span
                  key={country.id}
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2 py-0.5 font-medium"
                >
                  {country.name} ({country.coverageTier}, {country.drivingSide})
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Choice Buttons (1..6 or 1..2 for Stage 1 & Stage 2 trials) */}
        {activeTrial.kind !== 'country-bridge' && (
          <div
            className={`grid grid-cols-1 gap-3 ${
              activeTrial.kind === 'triggered-contrast'
                ? 'sm:grid-cols-2'
                : 'sm:grid-cols-2 md:grid-cols-3'
            }`}
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
        )}
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
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[1.125rem] font-bold">
                    {feedback.mapEvaluation
                      ? feedback.correct
                        ? `All Candidate Countries Correct — ${feedback.languageName} (${feedback.nativeName})`
                        : `Map Selection Incomplete — ${feedback.languageName} (${feedback.nativeName})`
                      : `${
                          feedback.correct ? 'Correct — ' : 'Incorrect — Answer is '
                        }${feedback.languageName} (${feedback.nativeName})`}
                  </h2>
                  {feedback.assisted && (
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[0.75rem] font-semibold text-amber-800 dark:text-amber-200">
                      Assisted · Follow-up Queued
                    </span>
                  )}
                  {feedback.triggeredContrastQueued && (
                    <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[0.75rem] font-semibold text-indigo-700 dark:text-indigo-300">
                      Stage 2 Contrast Card Queued Next
                    </span>
                  )}
                  {feedback.bridgeQueued && (
                    <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[0.75rem] font-semibold text-sky-700 dark:text-sky-300">
                      Stage 3 Country Bridge Queued Next
                    </span>
                  )}
                </div>
                <p className="text-[0.8125rem] text-[var(--text-secondary)]">
                  Response time: {(feedback.responseTimeMs / 1000).toFixed(2)}s{' '}
                  {feedback.assisted
                    ? '· Recorded as assisted exposure (honest Mastery State)'
                    : feedback.isFluentSpeed
                      ? `· Fluent (<${feedback.fluencyTargetMs / 1000}s automatic recognition)`
                      : `· Above ${feedback.fluencyTargetMs / 1000}s fluency threshold (scheduled sooner via ARTS)`}
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

          {/* Stage 3 Map Selection Evaluation Breakdown (Emerald / Amber / Rose + Uncovered Footnotes) */}
          {feedback.mapEvaluation && (
            <div
              className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-4"
              data-testid="map-evaluation-breakdown"
            >
              <h3 className="text-[0.875rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Stage 3 Map Selection Breakdown
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {/* Correct Selections (Emerald) */}
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5">
                  <p className="text-[0.8125rem] font-bold text-emerald-800 dark:text-emerald-200">
                    ✓ Correct Selections ({feedback.mapEvaluation.correctCountries.length})
                  </p>
                  {feedback.mapEvaluation.correctCountries.length === 0 ? (
                    <p className="mt-1.5 text-[0.75rem] text-[var(--text-secondary)]">
                      None selected
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-[0.8125rem]">
                      {feedback.mapEvaluation.correctCountries.map((country) => (
                        <li
                          key={`eval-correct-${country.id}`}
                          className="flex items-center justify-between gap-2 font-medium text-emerald-900 dark:text-emerald-100"
                        >
                          <span>✓ {country.name}</span>
                          <span className="text-[0.6875rem] uppercase opacity-80">
                            {country.coverageTier}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Missed Candidate Countries (Amber) */}
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5">
                  <p className="text-[0.8125rem] font-bold text-amber-800 dark:text-amber-200">
                    ! Missed Candidate Countries ({feedback.mapEvaluation.missedCountries.length})
                  </p>
                  {feedback.mapEvaluation.missedCountries.length === 0 ? (
                    <p className="mt-1.5 text-[0.75rem] text-[var(--text-secondary)]">
                      None missed!
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-[0.8125rem]">
                      {feedback.mapEvaluation.missedCountries.map((country) => (
                        <li
                          key={`eval-missed-${country.id}`}
                          className="flex items-center justify-between gap-2 font-medium text-amber-900 dark:text-amber-100"
                        >
                          <span>! {country.name}</span>
                          <span className="text-[0.6875rem] uppercase opacity-80">
                            {country.coverageTier}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Incorrect Clicks Including Uncovered Countries (Rose) */}
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5">
                  <p className="text-[0.8125rem] font-bold text-rose-800 dark:text-rose-200">
                    ✗ Incorrect Clicks ({feedback.mapEvaluation.incorrectCountries.length})
                  </p>
                  {feedback.mapEvaluation.incorrectCountries.length === 0 ? (
                    <p className="mt-1.5 text-[0.75rem] text-[var(--text-secondary)]">
                      No false clicks
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-[0.8125rem]">
                      {feedback.mapEvaluation.incorrectCountries.map((country) => (
                        <li
                          key={`eval-incorrect-${country.id}`}
                          className="flex flex-col text-rose-900 dark:text-rose-100"
                        >
                          <span className="font-medium">✗ {country.name}</span>
                          <span className="text-[0.6875rem] opacity-85">
                            {country.coverageTier === 'none'
                              ? 'Uncovered in Street View (coverageTier: none)'
                              : `Not a Candidate Country for ${feedback.languageName}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {feedback.uncoveredCountryNotes.length > 0 && (
                <div
                  className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-[0.8125rem]"
                  data-testid="uncovered-country-footnotes"
                >
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Informational Footnote — Notable Non-Covered Countries:
                  </p>
                  <p className="mt-0.5 text-[var(--text-secondary)]">
                    {feedback.uncoveredCountryNotes.join(' ')}
                  </p>
                </div>
              )}
            </div>
          )}

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
