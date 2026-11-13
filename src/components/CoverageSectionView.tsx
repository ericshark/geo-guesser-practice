import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { Lightbulb, Map as MapIcon, Play, TriangleAlert } from 'lucide-react';
import {
  COVERAGE_FOCUS_MAP,
  COVERAGE_FOCUS_OPTIONS,
  getCountriesForCoverageFocus,
  PLAYABLE_COUNTRY_MAP,
  type CoverageFocusId,
  type CoverageTier,
  type MapRegionPresetId,
} from '../data/index.ts';
import type {
  CoverageDrillMode,
  CoverageTrialFeedback,
  GuidedBreakdown,
  PracticeEngine,
  PracticeTrial,
} from '../engine/practiceEngine.ts';
import type { MasteryState, ProgressData } from '../storage/index.ts';
import { AnswerTile, type AnswerTileState } from './game/AnswerTile.tsx';
import { FeedbackBanner, formatSpeed } from './game/FeedbackBanner.tsx';
import { RoundHeader } from './game/RoundHeader.tsx';
import { RoundResults } from './game/RoundResults.tsx';
import { SectionPickerHeader } from './game/SectionPickerHeader.tsx';
import { useRound } from './game/useRound.ts';
import { MasteryBadge, MasteryBar } from './MasteryBadge.tsx';
import { SECTION_META } from './sectionMeta.ts';
import { WorldMapView } from './WorldMapView.tsx';

interface CoverageSectionViewProps {
  engine: PracticeEngine;
  progress: ProgressData;
  initialFocus?: CoverageFocusId | null;
  onBackToDashboard: () => void;
}

const META = SECTION_META.coverage;

const TIER_STYLE: Record<CoverageTier, { label: string; color: string }> = {
  official: { label: 'Official coverage', color: 'var(--good)' },
  limited: { label: 'Limited coverage', color: 'var(--warn)' },
  none: { label: 'No coverage', color: 'var(--bad)' },
};

const DRILL_MODES: Array<{ id: CoverageDrillMode; label: string; hint: string }> = [
  { id: 'mixed', label: 'Mixed', hint: 'A bit of everything' },
  { id: 'tier-speed', label: 'Official, limited, or none?', hint: 'Fast three-way calls' },
  { id: 'regional-map', label: 'Map it', hint: 'Tap countries on the map' },
  { id: 'neighbor-cluster', label: 'Odd one out', hint: 'Spot the uncovered neighbor' },
];

function TierChip({ tier, children }: { tier: CoverageTier; children?: ReactNode }) {
  const style = TIER_STYLE[tier];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.75rem] font-extrabold"
      style={{ color: `color-mix(in srgb, ${style.color} 70%, var(--text-primary))`, backgroundColor: `color-mix(in srgb, ${style.color} 15%, transparent)` }}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: style.color }} />
      {children ?? style.label}
    </span>
  );
}

export function CoverageSectionView({
  engine,
  progress,
  initialFocus,
  onBackToDashboard,
}: CoverageSectionViewProps) {
  const drillModeLabelId = useId();
  const breakdownHeadingId = useId();
  const round = useRound();

  const [selectedFocus, setSelectedFocus] = useState<CoverageFocusId | null>(
    initialFocus ?? null
  );
  const [drillMode, setDrillMode] = useState<CoverageDrillMode>('mixed');
  const [activeTrial, setActiveTrial] = useState<PracticeTrial | null>(() =>
    engine.getActiveSection() === 'coverage' ? engine.getCurrentTrial() : null
  );
  const [activeBreakdown, setActiveBreakdown] =
    useState<GuidedBreakdown | null>(() =>
      engine.getActiveSection() === 'coverage'
        ? engine.getActiveGuidedBreakdown()
        : null
    );
  const [feedback, setFeedback] = useState<CoverageTrialFeedback | null>(() =>
    engine.getActiveSection() === 'coverage'
      ? engine.getLastCoverageFeedback()
      : null
  );
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [selectedMapCountryIds, setSelectedMapCountryIds] = useState<string[]>(
    []
  );
  const [mapRegionPreset, setMapRegionPreset] =
    useState<MapRegionPresetId>('world');
  const [explorerInspectedCountryId, setExplorerInspectedCountryId] = useState<
    string | null
  >('ng');

  // Sync map region preset & clear selection when a new trial starts
  useEffect(() => {
    setSelectedMapCountryIds([]);
    if (activeTrial?.coveragePrompt) {
      setMapRegionPreset(activeTrial.coveragePrompt.suggestedRegionPreset);
    } else {
      setMapRegionPreset('world');
    }
  }, [activeTrial?.trialNumber, activeTrial?.kind]);

  const launchCoverageSession = useCallback(
    (focusId: CoverageFocusId, mode: CoverageDrillMode) => {
      round.reset();
      setSelectedFocus(focusId);
      const trial = engine.startCoverageSession({
        focusId,
        drillMode: mode,
      });
      setActiveTrial(trial);
      setActiveBreakdown(null);
      setFeedback(null);
      setElapsedMs(0);
      setSelectedMapCountryIds([]);
    },
    [engine, round.reset]
  );

  useEffect(() => {
    if (initialFocus) {
      launchCoverageSession(initialFocus, drillMode);
    }
  }, [initialFocus]); // Run when initialFocus prop changes

  // Response-time timer during an active unanswered trial
  useEffect(() => {
    if (!activeTrial || feedback || round.showResults) {
      return;
    }
    const start = performance.now();
    const interval = window.setInterval(() => {
      setElapsedMs(Math.round(performance.now() - start));
    }, 50);
    return () => window.clearInterval(interval);
  }, [activeTrial, feedback, round.showResults]);

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
    (result: CoverageTrialFeedback) => {
      round.record({
        correct: result.correct,
        fluent: result.correct && result.isFluentSpeed && !result.assisted,
        responseTimeMs: result.responseTimeMs,
        label: result.countryName,
        sublabel: result.coverageTier,
      });
    },
    [round.record]
  );

  const handleSelectOption = useCallback(
    async (optionId: string) => {
      if (!activeTrial || feedback) return;
      const rt = Math.max(
        120,
        elapsedMs || Date.now() - activeTrial.startedAtMs
      );
      const result = await engine.submitCoverageAnswer(optionId, rt);
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

  const handleSubmitCoverageMap = useCallback(
    async (overrideIds?: string[]) => {
      if (!activeTrial || activeTrial.kind !== 'coverage-map' || feedback) {
        return;
      }
      const idsToSubmit = overrideIds ?? selectedMapCountryIds;
      if (overrideIds) {
        setSelectedMapCountryIds(overrideIds);
      }
      const rt = Math.max(
        120,
        elapsedMs || Date.now() - activeTrial.startedAtMs
      );
      const result = await engine.submitCoverageMapAnswer(idsToSubmit, rt);
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

  const handleExitToFocusPicker = useCallback(() => {
    round.reset();
    setSelectedFocus(null);
    setActiveTrial(null);
    setActiveBreakdown(null);
    setFeedback(null);
    setSelectedMapCountryIds([]);
  }, [round.reset]);

  // Full keyboard navigation: 1..6 for choices, Space or ? for Guided Breakdown, Enter to submit/advance, Escape to close overlay or exit
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
        if (selectedFocus) {
          e.preventDefault();
          handleExitToFocusPicker();
        } else {
          e.preventDefault();
          onBackToDashboard();
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
          if (activeTrial.kind === 'coverage-map') {
            void handleSubmitCoverageMap(
              activeBreakdown.candidateCountries.map((c) => c.id)
            );
          } else {
            const targetCountry = activeTrial.coveragePrompt?.targetCountry;
            const correctOption =
              activeTrial.kind === 'coverage-tier'
                ? targetCountry
                  ? `tier:${targetCountry.coverageTier}`
                  : undefined
                : targetCountry
                  ? `cov:${targetCountry.id}`
                  : undefined;
            if (correctOption) {
              void handleSelectOption(correctOption);
            }
          }
          return;
        }

        if (
          e.key === 'Enter' &&
          activeTrial.kind === 'coverage-map' &&
          target?.tagName !== 'BUTTON'
        ) {
          e.preventDefault();
          void handleSubmitCoverageMap();
          return;
        }

        if (activeTrial.kind !== 'coverage-map') {
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

      // A focused Continue button already handles Enter via click.
      if (feedback && e.key === 'Enter' && target?.tagName !== 'BUTTON') {
        e.preventDefault();
        handleContinue();
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
    handleExitToFocusPicker,
    handleRequestGuidedBreakdown,
    handleSelectOption,
    handleSubmitCoverageMap,
    onBackToDashboard,
    selectedFocus,
  ]);

  // ---------------------------------------------------------------------------
  // Focus Picker when no focus session is active
  // ---------------------------------------------------------------------------
  if (!selectedFocus || !activeTrial || !activeTrial.coveragePrompt) {
    const inspectedCountry = explorerInspectedCountryId
      ? PLAYABLE_COUNTRY_MAP[explorerInspectedCountryId]
      : null;

    return (
      <div className="space-y-8">
        <SectionPickerHeader
          sectionId="coverage"
          title="Coverage"
          description="Learn which countries have Street View — so you never guess one you can't actually land in."
          onBack={onBackToDashboard}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => launchCoverageSession('world', drillMode)}
            className="card flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5"
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: META.color }}>
              <Play aria-hidden="true" className="h-6 w-6" fill="currentColor" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[1.125rem] font-black">Quick play: whole world</span>
              <span className="block text-[0.875rem] text-[var(--text-secondary)]">Every Playable Country, mixed.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => launchCoverageSession('trap-countries', drillMode)}
            className="card flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5"
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--bad)] text-white">
              <TriangleAlert aria-hidden="true" className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[1.125rem] font-black">Trap countries</span>
              <span className="block text-[0.875rem] text-[var(--text-secondary)]">China, Egypt, Belarus, Bolivia…</span>
            </span>
          </button>
        </div>

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
                data-state={drillMode === mode.id ? 'selected' : 'idle'}
                className="answer-tile !min-h-0 !flex-col !items-start !gap-0 !py-2.5"
              >
                <span className="text-[0.9375rem] font-extrabold">{mode.label}</span>
                <span className="text-[0.75rem] font-semibold text-[var(--text-secondary)]">{mode.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Regional Focus Cards */}
        <section aria-labelledby="coverage-focus-heading" className="space-y-4">
          <h2 id="coverage-focus-heading" className="text-[1.375rem] font-black">
            Pick a region
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {COVERAGE_FOCUS_OPTIONS.map((focus) => {
              const focusCountries = getCountriesForCoverageFocus(focus.id);
              const tierCounts: Record<CoverageTier, number> = { official: 0, limited: 0, none: 0 };
              const counts: Record<MasteryState, number> = {
                unseen: 0,
                learning: 0,
                recognized: 0,
                mastered: 0,
              };
              for (const c of focusCountries) {
                tierCounts[c.coverageTier] += 1;
                const state = progress.skills[`cov:${c.id}`]?.mastery ?? 'unseen';
                counts[state] += 1;
              }

              const trapExamples = focusCountries
                .filter((c) => c.isTrapCountry || c.coverageTier !== 'official')
                .slice(0, 5);

              return (
                <article key={focus.id} className="card flex flex-col gap-3 p-5">
                  <div>
                    <h3 className="text-[1.125rem] font-black">{focus.name}</h3>
                    <p className="mt-0.5 text-[0.875rem] text-[var(--text-secondary)]">{focus.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(['official', 'limited', 'none'] as const).map((tier) => (
                      <TierChip key={tier} tier={tier}>
                        {tierCounts[tier]} {tier}
                      </TierChip>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {trapExamples.map((country) => (
                      <span key={country.id} className="chip">
                        {country.name}
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: TIER_STYLE[country.coverageTier].color }}
                        />
                        <span className="visually-hidden">({country.coverageTier})</span>
                      </span>
                    ))}
                  </div>

                  <MasteryBar {...counts} total={focusCountries.length} />

                  <button
                    type="button"
                    onClick={() => launchCoverageSession(focus.id, drillMode)}
                    className="btn mt-auto w-full text-white"
                    style={{ backgroundColor: META.color, borderColor: `color-mix(in srgb, ${META.color} 75%, black)` }}
                  >
                    <Play aria-hidden="true" className="h-4 w-4" fill="currentColor" />
                    Play {focus.name}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {/* Interactive World Coverage Reference Map */}
        <section aria-labelledby="coverage-reference-map-heading" className="card space-y-4 p-5 sm:p-6">
          <div>
            <h2 id="coverage-reference-map-heading" className="flex items-center gap-2 text-[1.25rem] font-black">
              <MapIcon aria-hidden="true" className="h-5 w-5" style={{ color: META.color }} />
              Coverage world map
            </h2>
            <p className="mt-1 text-[0.875rem] text-[var(--text-secondary)]">
              Tap any country to see its Coverage Tier:{' '}
              <TierChip tier="official">Official</TierChip> <TierChip tier="limited">Limited</TierChip>{' '}
              <TierChip tier="none">None</TierChip>
            </p>
          </div>

          {inspectedCountry && (
            <div className="rounded-2xl bg-[var(--surface-elevated)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[1.0625rem] font-black">{inspectedCountry.name}</h3>
                  <TierChip tier={inspectedCountry.coverageTier} />
                  {inspectedCountry.isTrapCountry && <span className="chip">Common trap</span>}
                  <span className="text-[0.75rem] font-semibold text-[var(--text-secondary)]">
                    {inspectedCountry.region} · drives {inspectedCountry.drivingSide}
                  </span>
                </div>
                <MasteryBadge
                  state={progress.skills[`cov:${inspectedCountry.id}`]?.mastery ?? 'unseen'}
                  size="xs"
                />
              </div>
              <p className="mt-2 text-[0.875rem]">{inspectedCountry.coverageNote}</p>
            </div>
          )}

          <WorldMapView
            selectedCountryIds={explorerInspectedCountryId ? [explorerInspectedCountryId] : []}
            onToggleCountry={(countryId) => setExplorerInspectedCountryId(countryId)}
            activeRegionPreset={mapRegionPreset}
            onRegionPresetChange={setMapRegionPreset}
            showAllCoverageTiers={true}
          />
        </section>
      </div>
    );
  }

  const focusSpec = COVERAGE_FOCUS_MAP[selectedFocus];

  if (round.showResults) {
    return (
      <RoundResults
        sectionLabel={focusSpec?.name ?? 'Coverage'}
        summary={round.summary}
        onPlayAgain={handlePlayAgain}
        onBack={handleExitToFocusPicker}
        backLabel="All regions"
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Active Coverage round (Tier Speed, Neighbor Cluster, or Regional Map)
  // ---------------------------------------------------------------------------
  const prompt = activeTrial.coveragePrompt;
  const targetCountry = prompt.targetCountry;
  const expectedCountryIds = prompt.expectedCountryIds ?? [targetCountry.id];
  const currentSkillMastery =
    progress.skills[activeTrial.skillId]?.mastery ?? 'unseen';
  const kindLabel =
    activeTrial.kind === 'coverage-tier'
      ? 'Official, limited, or none?'
      : activeTrial.kind === 'coverage-cluster'
        ? 'Neighboring Cluster Coverage Trap · odd one out'
        : 'Map it';
  const correctOptionId =
    activeTrial.kind === 'coverage-tier'
      ? `tier:${targetCountry.coverageTier}`
      : `cov:${targetCountry.id}`;

  const optionState = (optId: string, languageId?: string): AnswerTileState => {
    if (!feedback) return 'idle';
    const isExpected =
      optId === correctOptionId ||
      languageId === (activeTrial.kind === 'coverage-tier' ? targetCountry.coverageTier : targetCountry.id);
    if (isExpected) return 'correct';
    if (feedback.chosenOptionId === optId || feedback.chosenOptionId === languageId) return 'wrong';
    return 'dim';
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <RoundHeader
        title={focusSpec?.name ?? 'Coverage'}
        subtitle={activeTrial.isFollowUp ? `${kindLabel} · follow-up` : kindLabel}
        answered={round.answered}
        roundLength={round.roundLength}
        streak={round.streak}
        elapsedMs={feedback ? feedback.responseTimeMs : elapsedMs}
        fluencyMs={activeTrial.fluencyThresholdMs}
        onExit={handleExitToFocusPicker}
        showingFeedback={Boolean(feedback)}
      />

      <section
        aria-labelledby="coverage-prompt-heading"
        className="card space-y-5 p-5 sm:p-7"
        key={activeTrial.trialNumber}
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 id="coverage-prompt-heading" className="text-[1.375rem] font-black sm:text-[1.5rem]">
              {prompt.promptTitle}
            </h2>
            <MasteryBadge state={feedback ? feedback.newMastery : currentSkillMastery} size="xs" />
          </div>
          <p className="text-[0.9375rem] text-[var(--text-secondary)]">{prompt.promptDescription}</p>
        </div>

        {activeTrial.kind === 'coverage-tier' && (
          <div className="rounded-2xl bg-[var(--surface-elevated)] p-6 text-center">
            <p className="text-[2rem] font-black leading-tight sm:text-[2.5rem]">{targetCountry.name}</p>
            <p className="mt-1 text-[0.8125rem] font-semibold text-[var(--text-secondary)]">
              {targetCountry.subregion} · drives {targetCountry.drivingSide}
            </p>
          </div>
        )}

        {activeTrial.kind === 'coverage-map' && (
          <p className="rounded-2xl bg-[var(--brand-soft)] px-4 py-2.5 text-[0.9375rem] font-bold">
            Find {expectedCountryIds.length} {expectedCountryIds.length === 1 ? 'country' : 'countries'} in{' '}
            {prompt.mapRegionLabel ?? targetCountry.region} with{' '}
            {prompt.mapTargetFilter === 'covered'
              ? 'official or limited coverage'
              : prompt.mapTargetFilter === 'uncovered'
                ? 'no Street View at all'
                : 'limited coverage only'}
            .
          </p>
        )}

        {!feedback && !activeBreakdown && (
          <div className="flex justify-center">
            <button
              type="button"
              aria-expanded={false}
              onClick={handleRequestGuidedBreakdown}
              className="btn btn-ghost btn-sm !text-[var(--warn)]"
            >
              <Lightbulb aria-hidden="true" className="h-4 w-4" />
              Show me what to look for
              <kbd className="hidden text-[0.6875rem] opacity-70 sm:inline">?</kbd>
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
                <h3 id={breakdownHeadingId} className="mt-1 text-[1.125rem] font-black">
                  {activeBreakdown.languageName} ({activeBreakdown.nativeName})
                </h3>
                <p className="text-[0.8125rem] text-[var(--text-secondary)]">{activeBreakdown.gestaltNote}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleDismissGuidedBreakdown} className="btn btn-ghost btn-sm">
                  Hide
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeTrial.kind === 'coverage-map') {
                      void handleSubmitCoverageMap(activeBreakdown.candidateCountries.map((c) => c.id));
                    } else {
                      void handleSelectOption(correctOptionId);
                    }
                  }}
                  className="btn btn-primary btn-sm"
                >
                  Got it
                  <kbd className="hidden text-[0.6875rem] opacity-80 sm:inline">Enter</kbd>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-[var(--surface-card)] p-4">
                <p className="text-[0.8125rem] font-extrabold">Coverage note</p>
                <p className="mt-1.5 text-[0.875rem]">
                  {activeBreakdown.coverageNote ?? activeBreakdown.contrastNote}
                </p>
                {activeBreakdown.regionalLimitedNotes && activeBreakdown.regionalLimitedNotes.length > 0 && (
                  <ul className="mt-2.5 space-y-1.5 text-[0.75rem]" role="list">
                    {activeBreakdown.regionalLimitedNotes.map((rn) => (
                      <li key={rn.countryId} className="rounded-lg bg-[var(--warn-soft)] p-2">
                        <strong>{rn.countryName} (Limited):</strong> {rn.coverageNote}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl bg-[var(--surface-card)] p-4">
                <p className="text-[0.8125rem] font-extrabold">Compared with the others</p>
                <ul className="mt-1.5 space-y-1.5 text-[0.75rem]" role="list">
                  {activeBreakdown.distractorEliminations.map((d) => (
                    <li key={d.optionId}>
                      <strong>{d.languageName}:</strong>{' '}
                      <span className="text-[var(--text-secondary)]">{d.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {activeTrial.kind === 'coverage-map' ? (
          <div className="space-y-4">
            <WorldMapView
              selectedCountryIds={selectedMapCountryIds}
              onToggleCountry={handleToggleMapCountry}
              evaluation={feedback?.mapEvaluation ?? null}
              activeRegionPreset={mapRegionPreset}
              onRegionPresetChange={setMapRegionPreset}
              readOnly={Boolean(feedback)}
              highlightedCoverageCountryIds={feedback ? feedback.mapHighlightedCountryIds : undefined}
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
                    selectedMapCountryIds.map((id) => (
                      <span key={id} className="chip !bg-[var(--brand-soft)] !text-[var(--brand-accent)]">
                        {PLAYABLE_COUNTRY_MAP[id]?.name ?? id}
                      </span>
                    ))
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
                    disabled={selectedMapCountryIds.length === 0}
                    onClick={() => void handleSubmitCoverageMap()}
                    className="btn btn-primary"
                  >
                    Check answer
                    <kbd className="hidden text-[0.75rem] opacity-80 sm:inline">Enter</kbd>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 gap-3 ${activeTrial.kind === 'coverage-tier' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
            role="group"
            aria-label="Coverage answer choices"
          >
            {activeTrial.options.map((opt, idx) => (
              <AnswerTile
                key={opt.id}
                label={opt.label}
                sublabel={opt.sublabel}
                shortcutKey={idx + 1}
                disabled={Boolean(feedback)}
                state={optionState(opt.id, opt.languageId)}
                onClick={() => void handleSelectOption(opt.id)}
              />
            ))}
          </div>
        )}
      </section>

      {feedback && (
        <details className="card group p-5 sm:p-6" open={!feedback.correct}>
          <summary className="cursor-pointer list-none text-[1rem] font-extrabold [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <Lightbulb aria-hidden="true" className="h-5 w-5 text-[var(--warn)]" />
              Learn more about {feedback.countryName}
              <span className="text-[0.8125rem] font-semibold text-[var(--text-secondary)] group-open:hidden">
                (tap to see)
              </span>
            </span>
          </summary>

          <div className="mt-4 space-y-4">
            <p className="text-[0.9375rem]">
              <TierChip tier={feedback.coverageTier} /> {feedback.coverageNote}
            </p>

            {feedback.mapEvaluation && (
              <div className="grid grid-cols-1 gap-3 text-[0.8125rem] sm:grid-cols-3">
                {[
                  { title: 'Correct', ids: feedback.mapEvaluation.correctCountryIds, color: 'var(--good)' },
                  { title: 'Missed', ids: feedback.mapEvaluation.missedCountryIds, color: 'var(--warn)' },
                  { title: 'Wrong taps', ids: feedback.mapEvaluation.incorrectCountryIds, color: 'var(--bad)' },
                ].map(({ title, ids, color }) => (
                  <div
                    key={title}
                    className="rounded-xl border-2 p-3"
                    style={{ borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }}
                  >
                    <p className="font-extrabold">
                      {title} ({ids.length})
                    </p>
                    <p className="mt-1 text-[var(--text-secondary)]">
                      {ids
                        .map((id) => {
                          const c = PLAYABLE_COUNTRY_MAP[id];
                          return c ? `${c.name} (${c.coverageTier})` : id;
                        })
                        .join(', ') || 'None'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {feedback.regionalLimitedNotes.length > 0 && (
              <div className="rounded-2xl bg-[var(--warn-soft)] p-4">
                <p className="text-[0.875rem] font-extrabold">Regional Street View Coverage Notes (Limited Coverage)</p>
                <ul className="mt-2 space-y-1.5 text-[0.8125rem]" role="list">
                  {feedback.regionalLimitedNotes.map((rn) => (
                    <li key={rn.countryId}>
                      <strong>{rn.countryName}:</strong> {rn.coverageNote}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {activeTrial.kind !== 'coverage-map' && (
              <div className="space-y-2">
                <p className="text-[0.875rem] font-extrabold">Exact Coverage Tier on the Map</p>
                <WorldMapView
                  selectedCountryIds={[]}
                  onToggleCountry={() => {}}
                  activeRegionPreset={mapRegionPreset}
                  onRegionPresetChange={setMapRegionPreset}
                  readOnly={true}
                  highlightedCoverageCountryIds={feedback.mapHighlightedCountryIds}
                />
              </div>
            )}
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
                ? 'You found them all!'
                : `${feedback.mapEvaluation.correctCountryIds.length} of ${feedback.mapEvaluation.expectedCountryIds.length} found`
              : `${feedback.countryName}: ${TIER_STYLE[feedback.coverageTier].label.toLowerCase()}`
          }
          detail={formatSpeed(feedback.responseTimeMs, feedback.fluencyTargetMs, feedback.assisted, feedback.correct)}
          continueLabel={round.isComplete ? 'See results' : 'Continue'}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}
