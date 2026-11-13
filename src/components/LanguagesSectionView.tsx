import { useCallback, useEffect, useId, useState } from 'react';
import { ArrowLeft, BookOpen, Lightbulb, Play, Shuffle, Sparkles } from 'lucide-react';
import { SectionPickerHeader } from './game/SectionPickerHeader.tsx';
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
import { AnswerTile, getAnswerTileState } from './game/AnswerTile.tsx';
import { FeedbackBanner, formatSpeed } from './game/FeedbackBanner.tsx';
import { RoundHeader } from './game/RoundHeader.tsx';
import { RoundResults } from './game/RoundResults.tsx';
import { useRound } from './game/useRound.ts';
import { HighlightedSampleText, LanguageContrastGrid, TELL_BADGE_CLASSES } from './LanguageContrastGrid.tsx';
import { MASTERY_CONFIG, MasteryBadge } from './MasteryBadge.tsx';
import { SECTION_META } from './sectionMeta.ts';
import { WorldMapView } from './WorldMapView.tsx';

interface LanguagesSectionViewProps {
  engine: PracticeEngine;
  progress: ProgressData;
  initialGroup?: LanguageGroupSelectionId | null;
  onBackToDashboard: () => void;
}

const DRILL_MODES: Array<{ id: LanguageDrillMode; label: string; hint: string }> = [
  { id: 'mixed', label: 'Mixed', hint: 'A bit of everything' },
  { id: 'samples', label: 'Sentences & signs', hint: 'Read real text' },
  { id: 'tells', label: 'Tells only', hint: 'Single letters & patterns' },
  { id: 'bridge', label: 'Language → map', hint: 'Find the countries' },
];

const META = SECTION_META.languages;

export function LanguagesSectionView({
  engine,
  progress,
  initialGroup,
  onBackToDashboard,
}: LanguagesSectionViewProps) {
  const drillModeLabelId = useId();
  const breakdownHeadingId = useId();
  const round = useRound();
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
      round.reset();
      setStage0Prime(engine.getStage0Prime());
      setActiveTrial(engine.getCurrentTrial());
      setActiveBreakdown(null);
      setFeedback(null);
      setElapsedMs(0);
      setSelectedMapCountryIds([]);
    },
    [engine, round.reset]
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

  // Response-time timer during an active unanswered trial
  useEffect(() => {
    if (!activeTrial || feedback || stage0Prime || round.showResults) {
      return;
    }
    const start = performance.now();
    const interval = window.setInterval(() => {
      setElapsedMs(Math.round(performance.now() - start));
    }, 50);
    return () => window.clearInterval(interval);
  }, [activeTrial, feedback, stage0Prime, round.showResults]);

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

  const recordFeedback = useCallback(
    (result: LanguageTrialFeedback) => {
      round.record({
        correct: result.correct,
        fluent: result.correct && result.isFluentSpeed && !result.assisted,
        responseTimeMs: result.responseTimeMs,
        label: result.languageName,
        sublabel: result.nativeName,
      });
    },
    [round.record]
  );

  const handleSelectOption = useCallback(
    async (optionId: string) => {
      if (!activeTrial || feedback) return;
      const rt = Math.max(120, elapsedMs || Date.now() - activeTrial.startedAtMs);
      const result = await engine.submitAnswer(optionId, rt);
      setFeedback(result);
      recordFeedback(result);
    },
    [activeTrial, elapsedMs, engine, feedback, recordFeedback]
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
      recordFeedback(result);
    },
    [activeTrial, elapsedMs, engine, feedback, recordFeedback, selectedMapCountryIds]
  );

  const handleNextTrial = useCallback(() => {
    const next = engine.nextTrial();
    setActiveTrial(next);
    setActiveBreakdown(null);
    setFeedback(null);
    setElapsedMs(0);
    setSelectedMapCountryIds([]);
  }, [engine]);

  // After answering: either the next question or, at the end of a round, results.
  const handleContinue = useCallback(() => {
    if (round.isComplete) {
      round.finish();
      return;
    }
    handleNextTrial();
  }, [handleNextTrial, round.finish, round.isComplete]);

  const handlePlayAgain = useCallback(() => {
    round.reset();
    handleNextTrial();
  }, [handleNextTrial, round.reset]);

  const handleExitToGroupPicker = useCallback(() => {
    round.reset();
    setSelectedGroup(null);
    setStage0Prime(null);
    setActiveTrial(null);
    setActiveBreakdown(null);
    setFeedback(null);
    setSelectedMapCountryIds([]);
  }, [round.reset]);

  // Full keyboard navigation: 1..6 for choices, Space or ? for Guided Breakdown, Enter to start/submit/advance, Escape to close overlay or exit
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.closest('dialog') ||
          target.closest('details'))
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
        // A focused Continue button already handles Enter via click.
        if (e.key === 'Enter' && target?.tagName !== 'BUTTON') {
          e.preventDefault();
          handleContinue();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeBreakdown,
    activeTrial,
    feedback,
    handleContinue,
    handleDismissGuidedBreakdown,
    handleExitToGroupPicker,
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
      <div className="space-y-8">
        <SectionPickerHeader
          sectionId="languages"
          title="Choose a Language Group"
          description="Lookalike languages are practiced together, so you learn exactly what tells them apart."
          onBack={onBackToDashboard}
        />

        {/* Question style */}
        <div className="space-y-2">
          <p id={drillModeLabelId} className="text-[0.875rem] font-extrabold text-[var(--text-secondary)]">
            Question style
          </p>
          <div role="radiogroup" aria-labelledby={drillModeLabelId} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DRILL_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={drillMode === mode.id}
                onClick={() => setDrillMode(mode.id)}
                className="answer-tile !min-h-0 !flex-col !items-start !gap-0 !py-2.5"
                data-state={drillMode === mode.id ? 'selected' : 'idle'}
              >
                <span className="text-[0.9375rem] font-extrabold">{mode.label}</span>
                <span className="text-[0.75rem] font-semibold text-[var(--text-secondary)]">{mode.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick play */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => launchGroupSession('smart-weakest', drillMode, true)}
            className="card group flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5"
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-accent)] text-white">
              <Sparkles aria-hidden="true" className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[1.125rem] font-black">Smart Practice</span>
              <span className="block text-[0.875rem] text-[var(--text-secondary)]">
                Your weak spots and mix-ups, across all groups.
              </span>
            </span>
            <Play aria-hidden="true" className="h-6 w-6 shrink-0 text-[var(--brand-accent)]" fill="currentColor" />
          </button>
          <button
            type="button"
            onClick={() => launchGroupSession('all-mixed', drillMode, true)}
            className="card group flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5"
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--sec-coverage)] text-white">
              <Shuffle aria-hidden="true" className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[1.125rem] font-black">All groups mixed</span>
              <span className="block text-[0.875rem] text-[var(--text-secondary)]">
                All {LANGUAGES.length} languages, shuffled.
              </span>
            </span>
            <Play aria-hidden="true" className="h-6 w-6 shrink-0 text-[var(--sec-coverage)]" fill="currentColor" />
          </button>
        </div>

        {/* Language Groups */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {LANGUAGE_GROUPS.map((group) => {
            const primed = progress.completedPrimes.includes(group.id);
            return (
              <article key={group.id} className="card flex flex-col gap-4 p-5">
                <div>
                  <h2 className="text-[1.125rem] font-black">{group.name}</h2>
                  <p className="mt-0.5 text-[0.875rem] text-[var(--text-secondary)]">
                    {group.description}
                  </p>
                </div>

                <ul className="flex flex-wrap gap-2" role="list">
                  {group.languageIds.map((langId) => {
                    const lang = LANGUAGE_MAP[langId];
                    const mastery = progress.skills[`lang:${langId}`]?.mastery ?? 'unseen';
                    return (
                      <li
                        key={langId}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--surface-elevated)] px-2.5 py-1 text-[0.8125rem] font-bold"
                        title={`${lang.name} (${lang.nativeName}) · ${MASTERY_CONFIG[mastery].label}`}
                      >
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: MASTERY_CONFIG[mastery].color }}
                        />
                        {lang.name}
                        <span className="visually-hidden">: {MASTERY_CONFIG[mastery].label}</span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => launchGroupSession(group.id, drillMode, primed)}
                    className="btn btn-primary flex-1"
                  >
                    <Play aria-hidden="true" className="h-4 w-4" fill="currentColor" />
                    Play
                  </button>
                  <button
                    type="button"
                    onClick={() => launchGroupSession(group.id, drillMode, false)}
                    className="btn btn-secondary"
                    title="Compare these languages side by side before playing"
                  >
                    <BookOpen aria-hidden="true" className="h-4 w-4" />
                    {primed ? 'Review study card' : 'Study card first'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. STUDY CARD (Contrast Card prime before a Language Group)
  if (stage0Prime) {
    return (
      <div className="space-y-6">
        <div className="card p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <button type="button" onClick={handleExitToGroupPicker} className="btn btn-ghost btn-sm -ml-2">
                <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Language Groups
              </button>
              <p className="mt-2 text-[0.8125rem] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
                Study card · Contrast Card
              </p>
              <h1 className="text-[1.625rem] font-black">
                {stage0Prime.groupName}: spot the difference
              </h1>
              <p className="mt-1 text-[0.9375rem] text-[var(--text-secondary)]">
                {stage0Prime.primeSummary}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <button type="button" onClick={handleSkipPrime} className="btn btn-secondary">
                Skip
              </button>
              <button
                type="button"
                onClick={() => void handleStartFromPrime()}
                className="btn btn-primary btn-lg"
              >
                <Play aria-hidden="true" className="h-5 w-5" fill="currentColor" />
                I&apos;m ready
                <kbd className="hidden text-[0.75rem] opacity-80 sm:inline">Enter</kbd>
              </button>
            </div>
          </div>
        </div>

        <LanguageContrastGrid languages={stage0Prime.languages} />
      </div>
    );
  }

  if (!activeTrial) {
    return null;
  }

  // Friendly round title (the engine's groupName carries internal stage labels).
  const roundTitle =
    selectedGroup === 'smart-weakest'
      ? 'Smart Practice'
      : selectedGroup === 'all-mixed'
        ? 'All groups mixed'
        : (LANGUAGE_GROUPS.find((g) => g.id === selectedGroup)?.name ?? 'Languages');

  // 3. ROUND RESULTS
  if (round.showResults) {
    return (
      <RoundResults
        sectionLabel={roundTitle}
        summary={round.summary}
        onPlayAgain={handlePlayAgain}
        onBack={handleExitToGroupPicker}
        backLabel="Language Groups"
      />
    );
  }

  // 4. PLAY SCREEN
  const displayRt = feedback ? feedback.responseTimeMs : elapsedMs;
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

  const kindLabel =
    activeTrial.kind === 'triggered-contrast'
      ? 'Mix-up check · Contrast Card'
      : activeTrial.kind === 'country-bridge'
        ? 'Language → map'
        : activeTrial.kind === 'tell-recognition'
          ? 'Spot the Tell'
          : activeTrial.sample.kind === 'sign'
            ? 'Street sign'
            : 'Sentence';

  const questionText =
    activeTrial.kind === 'triggered-contrast'
      ? 'Which language is which?'
      : activeTrial.kind === 'country-bridge'
        ? `Where would you see ${activeTrial.bridgePrompt?.languageName ?? 'this'} on signs?`
        : activeTrial.kind === 'tell-recognition'
          ? 'Which language uses this?'
          : 'Which language is this?';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <RoundHeader
        title={roundTitle}
        subtitle={activeTrial.isFollowUp ? `${kindLabel} · follow-up` : kindLabel}
        answered={round.answered}
        roundLength={round.roundLength}
        streak={round.streak}
        elapsedMs={displayRt}
        fluencyMs={activeTrial.fluencyThresholdMs}
        onExit={handleExitToGroupPicker}
        showingFeedback={Boolean(feedback)}
        actions={
          selectedGroup !== 'all-mixed' && selectedGroup !== 'smart-weakest' ? (
            <button
              type="button"
              onClick={() => launchGroupSession(selectedGroup, drillMode, false)}
              className="btn btn-ghost btn-sm"
              title="View Contrast Card (restarts the round)"
            >
              <BookOpen aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">Study card</span>
            </button>
          ) : null
        }
      />

      {/* Prompt Card */}
      <div className="card space-y-5 p-5 sm:p-7" key={activeTrial.trialNumber}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[1.25rem] font-black">{questionText}</h2>
          <MasteryBadge state={feedback ? feedback.newMastery : currentMastery} size="xs" />
        </div>

        {activeTrial.kind === 'triggered-contrast' &&
        activeTrial.triggeredContrast ? (
          <div className="space-y-4">
            <p className="rounded-2xl bg-[var(--warn-soft)] p-3.5 text-[0.875rem] font-semibold">
              You&apos;ve mixed up <strong>{activeTrial.triggeredContrast.leftSide.name}</strong> and{' '}
              <strong>{activeTrial.triggeredContrast.rightSide.name}</strong>{' '}
              {activeTrial.triggeredContrast.confusionCount}× recently. Compare
              the highlighted Tells, then match each side.
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                { slotLabel: 'Left Sample', side: activeTrial.triggeredContrast.leftSide },
                { slotLabel: 'Right Sample', side: activeTrial.triggeredContrast.rightSide },
              ].map(({ slotLabel, side }) => (
                <div
                  key={side.skillId}
                  className="space-y-3 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="chip !bg-[var(--brand-soft)] !text-[var(--brand-accent)]">
                      {slotLabel}
                    </span>
                    <span className="text-[0.75rem] font-semibold text-[var(--text-secondary)]">
                      {side.script}
                    </span>
                  </div>

                  <p lang={side.languageId} className="text-[1.25rem] font-bold leading-relaxed">
                    <HighlightedSampleText sample={side.sample} matches={side.matchedTells} />
                  </p>
                  <p className="text-[0.8125rem] italic text-[var(--text-secondary)]">
                    “{side.sample.translation}”
                  </p>

                  <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-2.5 text-[0.8125rem]">
                    {side.tells.slice(0, 2).map((tell, idx) => (
                      <div key={tell.id} className="flex items-start gap-2">
                        <span
                          className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono font-semibold ${
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
                      <strong>Rule of thumb:</strong> {side.contrastNote}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTrial.kind === 'country-bridge' && activeTrial.bridgePrompt ? (
          <div className="space-y-4" data-testid="country-bridge-prompt">
            <div className="rounded-2xl bg-[var(--brand-soft)] p-4">
              <p className="text-[1.125rem] font-black">
                {activeTrial.bridgePrompt.languageName}{' '}
                <span className="font-semibold text-[var(--text-secondary)]">
                  ({activeTrial.bridgePrompt.nativeName} · {activeTrial.bridgePrompt.script})
                </span>
              </p>
              <p className="mt-1 text-[0.875rem] text-[var(--text-secondary)]">
                Tap every country with Street View coverage where this language
                appears on road signs. Skip countries with no coverage.
              </p>
              <div className="mt-3 rounded-xl bg-[var(--surface-card)] p-3">
                <p lang={activeTrial.languageId} className="text-[1.125rem] font-bold leading-relaxed">
                  <HighlightedSampleText sample={activeTrial.sample} matches={promptHighlightMatches} />
                </p>
                <p className="mt-1 text-[0.75rem] italic text-[var(--text-secondary)]">
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

            {!feedback && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface-elevated)] p-3.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
                  <span className="font-extrabold text-[var(--text-secondary)]">
                    Selected ({selectedMapCountryIds.length}):
                  </span>
                  {selectedMapCountryIds.length === 0 ? (
                    <span className="text-[var(--text-secondary)]">Nothing yet — tap the map</span>
                  ) : (
                    selectedMapCountryIds.map((id) => {
                      const country = PLAYABLE_COUNTRY_MAP[id];
                      return (
                        <button
                          key={`selected-chip-${id}`}
                          type="button"
                          onClick={() => handleToggleMapCountry(id)}
                          className="chip !bg-[var(--brand-soft)] !text-[var(--brand-accent)] hover:opacity-80"
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
                    <button type="button" onClick={() => setSelectedMapCountryIds([])} className="btn btn-ghost btn-sm">
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid="submit-country-bridge-btn"
                    onClick={() => void handleSubmitCountryBridge()}
                    className="btn btn-primary"
                  >
                    Check answer
                    <kbd className="hidden text-[0.75rem] opacity-80 sm:inline">Enter</kbd>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeTrial.kind === 'tell-recognition' && activeTrial.tellPrompt ? (
          <div className="rounded-2xl bg-[var(--surface-elevated)] p-8 text-center">
            <p className="font-mono text-[2.25rem] font-black tracking-wide sm:text-[2.75rem]">
              {activeTrial.tellPrompt.pattern}
            </p>
            <p className="mt-2 text-[0.875rem] font-semibold text-[var(--text-secondary)]">
              {activeTrial.tellPrompt.script} script
            </p>
          </div>
        ) : (
          <div
            className={`rounded-2xl p-6 text-center sm:p-8 ${
              activeTrial.sample.kind === 'sign'
                ? 'border-4 border-[var(--border-strong)] bg-[var(--surface-elevated)] tracking-wide'
                : 'bg-[var(--surface-elevated)]'
            }`}
          >
            <p
              lang={shouldHighlightPromptTells ? activeTrial.languageId : undefined}
              className="text-[1.625rem] font-bold leading-relaxed sm:text-[2rem]"
            >
              {shouldHighlightPromptTells ? (
                <HighlightedSampleText sample={activeTrial.sample} matches={promptHighlightMatches} />
              ) : (
                activeTrial.sample.text
              )}
            </p>
          </div>
        )}

        {/* Hint (Guided Breakdown) */}
        {!feedback && !activeBreakdown && activeTrial.kind !== 'triggered-contrast' && (
          <div className="flex justify-center">
            <button
              type="button"
              aria-expanded={false}
              onClick={handleRequestGuidedBreakdown}
              className="btn btn-ghost btn-sm !text-[var(--warn)]"
            >
              <Lightbulb aria-hidden="true" className="h-4 w-4" />
              Show me what to look for
              <kbd className="hidden text-[0.6875rem] opacity-70 sm:inline">Space</kbd>
            </button>
          </div>
        )}

        {activeBreakdown && !feedback && (
          <section
            aria-labelledby={breakdownHeadingId}
            className="anim-rise space-y-4 rounded-2xl border-2 border-[var(--warn)] bg-[var(--warn-soft)] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-[0.75rem] font-extrabold uppercase tracking-wider">
                  <Lightbulb aria-hidden="true" className="h-4 w-4" /> Guided Breakdown · counts as a hint
                </p>
                <h2 id={breakdownHeadingId} className="mt-1 text-[1.125rem] font-black">
                  It&apos;s {activeBreakdown.languageName} ({activeBreakdown.nativeName})
                </h2>
                <p className="text-[0.8125rem] italic text-[var(--text-secondary)]">
                  “{activeBreakdown.translation}”
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={handleDismissGuidedBreakdown} className="btn btn-ghost btn-sm">
                  Hide
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
                  className="btn btn-primary btn-sm"
                >
                  Got it
                  <kbd className="hidden text-[0.6875rem] opacity-80 sm:inline">Enter</kbd>
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-[0.8125rem] font-extrabold">What gives it away</h3>
              {activeBreakdown.matchedTells.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {activeBreakdown.matchedTells.map((match) => (
                    <div key={match.tellId} className="rounded-xl bg-[var(--surface-card)] p-3 text-[0.8125rem]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 font-mono text-[0.75rem] font-semibold ${
                            TELL_BADGE_CLASSES[match.colorIndex % TELL_BADGE_CLASSES.length]
                          }`}
                        >
                          {match.spans.map((s) => s.text).join(', ')}
                        </span>
                        <span className="font-bold">{match.label}</span>
                      </div>
                      <p className="mt-1 text-[var(--text-secondary)]">{match.explanation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-[var(--surface-card)] p-3.5 text-[0.8125rem]">
                  <p className="font-bold">No single-letter Tell here — look at the overall pattern:</p>
                  {activeBreakdown.structuralClue && (
                    <p className="mt-1 text-[var(--text-secondary)]">{activeBreakdown.structuralClue}</p>
                  )}
                  <p className="mt-1 text-[var(--text-secondary)]">{activeBreakdown.gestaltNote}</p>
                </div>
              )}
              <p className="text-[0.8125rem] text-[var(--text-secondary)]">
                <strong>Rule of thumb:</strong> {activeBreakdown.contrastNote}
              </p>
            </div>

            {activeBreakdown.distractorEliminations.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[0.8125rem] font-extrabold">Why it isn&apos;t the others</h3>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="list">
                  {activeBreakdown.distractorEliminations.map((elim) => (
                    <li key={elim.optionId} className="rounded-xl bg-[var(--surface-card)] p-3 text-[0.8125rem]">
                      <p className="font-bold">
                        ✗ {elim.languageName}{' '}
                        <span className="font-normal text-[var(--text-secondary)]">({elim.nativeName})</span>
                      </p>
                      <p className="mt-1 text-[var(--text-secondary)]">{elim.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 text-[0.75rem]">
              <span className="font-extrabold text-[var(--text-secondary)]">Seen in:</span>
              {activeBreakdown.candidateCountries.map((country) => (
                <span key={country.id} className="chip !bg-[var(--surface-card)]">
                  {country.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Answer choices */}
        {activeTrial.kind !== 'country-bridge' && (
          <div
            className={`grid grid-cols-1 gap-3 ${
              activeTrial.kind === 'triggered-contrast' ? 'sm:grid-cols-2' : 'sm:grid-cols-2'
            }`}
            role="group"
            aria-label="Language choices"
          >
            {activeTrial.options.map((option) => (
              <AnswerTile
                key={option.id}
                label={option.label}
                sublabel={option.sublabel}
                shortcutKey={option.shortcutKey}
                disabled={Boolean(feedback)}
                state={getAnswerTileState(
                  option.id,
                  feedback ? { correctId: feedback.skillId, chosenId: feedback.chosenOptionId } : null
                )}
                onClick={() => void handleSelectOption(option.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Explanation after answering */}
      {feedback && (
        <details className="card group p-5 sm:p-6" open={!feedback.correct}>
          <summary className="cursor-pointer list-none text-[1rem] font-extrabold [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <Lightbulb aria-hidden="true" className="h-5 w-5 text-[var(--warn)]" />
              Why is it {feedback.languageName}?
              <span className="text-[0.8125rem] font-semibold text-[var(--text-secondary)] group-open:hidden">
                (tap to see)
              </span>
            </span>
          </summary>

          <div className="mt-4 space-y-5">
            {feedback.mapEvaluation && (
              <div className="space-y-3" data-testid="map-evaluation-breakdown">
                <h3 className="text-[0.875rem] font-extrabold">Your map answer</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <EvaluationColumn
                    tone="good"
                    title={`✓ Correct Selections (${feedback.mapEvaluation.correctCountries.length})`}
                    empty="None selected"
                    items={feedback.mapEvaluation.correctCountries.map((c) => ({ id: c.id, name: c.name, note: c.coverageTier }))}
                  />
                  <EvaluationColumn
                    tone="warn"
                    title={`! Missed Candidate Countries (${feedback.mapEvaluation.missedCountries.length})`}
                    empty="None missed!"
                    items={feedback.mapEvaluation.missedCountries.map((c) => ({ id: c.id, name: c.name, note: c.coverageTier }))}
                  />
                  <EvaluationColumn
                    tone="bad"
                    title={`✗ Incorrect Clicks (${feedback.mapEvaluation.incorrectCountries.length})`}
                    empty="No wrong taps"
                    items={feedback.mapEvaluation.incorrectCountries.map((c) => ({
                      id: c.id,
                      name: c.name,
                      note:
                        c.coverageTier === 'none'
                          ? 'Uncovered in Street View'
                          : `Not a Candidate Country for ${feedback.languageName}`,
                    }))}
                  />
                </div>

                {feedback.uncoveredCountryNotes.length > 0 && (
                  <p
                    className="rounded-xl bg-[var(--warn-soft)] p-3 text-[0.8125rem]"
                    data-testid="uncovered-country-footnotes"
                  >
                    <strong>Good to know:</strong> {feedback.uncoveredCountryNotes.join(' ')}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-2xl bg-[var(--surface-elevated)] p-4">
              <p lang={feedback.languageId} className="text-[1.25rem] font-bold leading-relaxed">
                <HighlightedSampleText sample={feedback.sample} matches={feedback.matchedTells} />
              </p>
              <p className="mt-1.5 text-[0.875rem] italic text-[var(--text-secondary)]">
                “{feedback.translation}”
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-[0.875rem] font-extrabold">What to look for</h3>
              {feedback.matchedTells.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {feedback.matchedTells.map((match) => (
                    <div key={match.tellId} className="rounded-xl border-2 border-[var(--border-subtle)] p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 font-mono text-[0.75rem] font-semibold ${
                            TELL_BADGE_CLASSES[match.colorIndex % TELL_BADGE_CLASSES.length]
                          }`}
                        >
                          {match.spans.map((s) => s.text).join(', ')}
                        </span>
                        <span className="text-[0.875rem] font-bold">{match.label}</span>
                      </div>
                      <p className="mt-1.5 text-[0.8125rem] text-[var(--text-secondary)]">{match.explanation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border-2 border-[var(--border-subtle)] p-4 text-[0.875rem]">
                  <p className="font-bold">No single-letter Tell here — use the overall pattern:</p>
                  {feedback.structuralClue && (
                    <p className="mt-1 text-[var(--text-secondary)]">{feedback.structuralClue}</p>
                  )}
                  <p className="mt-1 text-[var(--text-secondary)]">{feedback.gestaltNote}</p>
                </div>
              )}

              {feedback.structuralClue && feedback.matchedTells.length > 0 && (
                <p className="text-[0.8125rem] text-[var(--text-secondary)]">
                  <strong>Also:</strong> {feedback.structuralClue}
                </p>
              )}

              <p className="text-[0.8125rem] text-[var(--text-secondary)]">
                <strong>Rule of thumb:</strong> {feedback.contrastNote}
              </p>
            </div>

            {feedback.chosenLanguageContrast && (
              <div className="rounded-xl bg-[var(--bad-soft)] p-4 text-[0.8125rem]">
                <p className="font-extrabold">Why not {feedback.chosenLanguageContrast.languageName}?</p>
                <p className="mt-1 text-[var(--text-secondary)]">
                  {feedback.chosenLanguageContrast.contrastNote} Key{' '}
                  {feedback.chosenLanguageContrast.languageName} tells:{' '}
                  {feedback.chosenLanguageContrast.keyTells
                    .map((t) => `${t.pattern} (${t.label})`)
                    .join(' · ')}
                </p>
              </div>
            )}

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <h3 className="text-[0.875rem] font-extrabold">
                Where you&apos;ll see it ({feedback.candidateCountries.length} Candidate Countries)
              </h3>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {feedback.candidateCountries.map((country) => (
                  <span
                    key={country.id}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--surface-elevated)] px-2.5 py-1 text-[0.8125rem] font-bold"
                    title={`Drives ${country.drivingSide} · ${country.tld} · ${country.currencies.map((c) => c.symbol).join('/')}`}
                  >
                    {country.name}
                    <span
                      className="text-[0.6875rem] font-extrabold capitalize"
                      style={{ color: country.coverageTier === 'official' ? 'var(--good)' : 'var(--warn)' }}
                    >
                      {country.coverageTier}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </details>
      )}

      {feedback && (
        <FeedbackBanner
          correct={feedback.correct}
          seed={activeTrial.trialNumber}
          answer={
            feedback.mapEvaluation
              ? feedback.correct
                ? `All countries found for ${feedback.languageName}`
                : `Some countries missed for ${feedback.languageName}`
              : `It's ${feedback.languageName} (${feedback.nativeName})`
          }
          detail={formatSpeed(feedback.responseTimeMs, feedback.fluencyTargetMs, feedback.assisted, feedback.correct)}
          badges={
            <>
              {feedback.triggeredContrastQueued && (
                <span className="chip">Mix-up check coming up</span>
              )}
              {feedback.bridgeQueued && <span className="chip">Map question coming up</span>}
            </>
          }
          continueLabel={round.isComplete ? 'See results' : 'Continue'}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}

function EvaluationColumn({
  tone,
  title,
  empty,
  items,
}: {
  tone: 'good' | 'warn' | 'bad';
  title: string;
  empty: string;
  items: Array<{ id: string; name: string; note: string }>;
}) {
  const color = tone === 'good' ? 'var(--good)' : tone === 'warn' ? 'var(--warn)' : 'var(--bad)';
  return (
    <div
      className="rounded-xl border-2 p-3.5"
      style={{ borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }}
    >
      <p className="text-[0.8125rem] font-extrabold">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1.5 text-[0.75rem] text-[var(--text-secondary)]">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-[0.8125rem]">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col">
              <span className="font-bold">{item.name}</span>
              <span className="text-[0.6875rem] capitalize text-[var(--text-secondary)]">{item.note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
