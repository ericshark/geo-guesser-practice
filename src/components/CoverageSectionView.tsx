import React, { useCallback, useEffect, useId, useState } from 'react';
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
import { MasteryBadge } from './MasteryBadge.tsx';
import { WorldMapView } from './WorldMapView.tsx';

interface CoverageSectionViewProps {
  engine: PracticeEngine;
  progress: ProgressData;
  initialFocus?: CoverageFocusId | null;
  onBackToDashboard: () => void;
}

const COVERAGE_TIER_BADGE_STYLES: Record<
  CoverageTier,
  { label: string; badgeClass: string; dotClass: string }
> = {
  official: {
    label: 'Official Coverage',
    badgeClass:
      'border-emerald-500/40 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  limited: {
    label: 'Limited Coverage',
    badgeClass:
      'border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200',
    dotClass: 'bg-amber-500',
  },
  none: {
    label: 'None (No Coverage)',
    badgeClass:
      'border-rose-500/40 bg-rose-500/12 text-rose-800 dark:text-rose-200',
    dotClass: 'bg-rose-500',
  },
};

export function CoverageSectionView({
  engine,
  progress,
  initialFocus,
  onBackToDashboard,
}: CoverageSectionViewProps) {
  const drillModeSelectId = useId();
  const breakdownHeadingId = useId();

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
    [engine]
  );

  useEffect(() => {
    if (initialFocus) {
      launchCoverageSession(initialFocus, drillMode);
    }
  }, [initialFocus]); // Run when initialFocus prop changes

  // Unobtrusive fluency response-time bar timer during active unanswered trial
  useEffect(() => {
    if (!activeTrial || feedback) {
      return;
    }
    const start = performance.now();
    const interval = window.setInterval(() => {
      setElapsedMs(Math.round(performance.now() - start));
    }, 50);
    return () => window.clearInterval(interval);
  }, [activeTrial, feedback]);

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
      const rt = Math.max(
        120,
        elapsedMs || Date.now() - activeTrial.startedAtMs
      );
      const result = await engine.submitCoverageAnswer(optionId, rt);
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

  const handleExitToFocusPicker = useCallback(() => {
    setSelectedFocus(null);
    setActiveTrial(null);
    setActiveBreakdown(null);
    setFeedback(null);
    setSelectedMapCountryIds([]);
  }, []);

  // Full keyboard navigation: 1..6 for choices, Space or ? for Guided Breakdown, Enter to submit/advance, Escape to close overlay or exit
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

      if (feedback && e.key === 'Enter') {
        e.preventDefault();
        handleNextTrial();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeBreakdown,
    activeTrial,
    feedback,
    handleDismissGuidedBreakdown,
    handleExitToFocusPicker,
    handleNextTrial,
    handleRequestGuidedBreakdown,
    handleSelectOption,
    handleSubmitCoverageMap,
    onBackToDashboard,
    selectedFocus,
  ]);

  // ---------------------------------------------------------------------------
  // Render Focus Picker when no focus session is active
  // ---------------------------------------------------------------------------
  if (!selectedFocus || !activeTrial || !activeTrial.coveragePrompt) {
    const inspectedCountry = explorerInspectedCountryId
      ? PLAYABLE_COUNTRY_MAP[explorerInspectedCountryId]
      : null;

    return (
      <div className="space-y-8">
        <section
          aria-labelledby="coverage-section-heading"
          className="apple-card p-6 sm:p-8"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[0.75rem] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  ← Dashboard
                </button>
                <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--brand-accent)]">
                  Section 3 · Street View Coverage Tiers
                </span>
              </div>
              <h1
                id="coverage-section-heading"
                tabIndex={-1}
                className="mt-2 text-[1.75rem] font-bold tracking-tight"
              >
                Coverage Practice
              </h1>
              <p className="mt-1 max-w-2xl text-[0.9375rem] text-[var(--text-secondary)]">
                Internalize which <strong>Playable Countries</strong> have{' '}
                <strong>Official</strong>, <strong>Limited</strong>, or{' '}
                <strong>None</strong> Google Street View coverage so you never
                guess an uncovered trap country or miss a regional corridor.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label
                  htmlFor={drillModeSelectId}
                  className="text-[0.8125rem] font-medium text-[var(--text-secondary)]"
                >
                  Drill Mode:
                </label>
                <select
                  id={drillModeSelectId}
                  value={drillMode}
                  onChange={(e) =>
                    setDrillMode(e.target.value as CoverageDrillMode)
                  }
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-[0.8125rem] font-medium"
                >
                  <option value="mixed">
                    Mixed (Speed Tier + Regional Map + Neighbor Clusters)
                  </option>
                  <option value="tier-speed">
                    Speed Classification (Official vs Limited vs None)
                  </option>
                  <option value="regional-map">
                    Regional Map Quiz (Click Covered / Uncovered Countries)
                  </option>
                  <option value="neighbor-cluster">
                    Neighboring Cluster Traps (Spot the Uncovered Neighbor)
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick-launch buttons */}
          <div className="mt-6 flex flex-wrap gap-3 border-t border-[var(--border-subtle)] pt-5">
            <button
              type="button"
              onClick={() => launchCoverageSession('trap-countries', drillMode)}
              className="rounded-xl bg-[var(--brand-accent)] px-4 py-2.5 text-[0.875rem] font-semibold text-white shadow-xs hover:opacity-95"
            >
              Drill Common Trap Countries (China, Egypt, Belarus, Bolivia…)
            </button>
            <button
              type="button"
              onClick={() => launchCoverageSession('world', drillMode)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-2.5 text-[0.875rem] font-semibold hover:opacity-90"
            >
              World Coverage Mixed Drill
            </button>
            <button
              type="button"
              onClick={() => launchCoverageSession('world', 'regional-map')}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-2.5 text-[0.875rem] font-medium hover:opacity-90"
            >
              Interactive Regional Map Quizzes
            </button>
          </div>
        </section>

        {/* Regional Focus Cards */}
        <section aria-labelledby="coverage-focus-heading" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="coverage-focus-heading"
              className="text-[1.25rem] font-semibold"
            >
              Choose a Regional Focus
            </h2>
            <p className="text-[0.8125rem] text-[var(--text-secondary)]">
              7 regional & trap focuses · 145 Playable Countries tracked by ARTS
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {COVERAGE_FOCUS_OPTIONS.map((focus) => {
              const focusCountries = getCountriesForCoverageFocus(focus.id);
              const officialCount = focusCountries.filter(
                (c) => c.coverageTier === 'official'
              ).length;
              const limitedCount = focusCountries.filter(
                (c) => c.coverageTier === 'limited'
              ).length;
              const noneCount = focusCountries.filter(
                (c) => c.coverageTier === 'none'
              ).length;

              const counts: Record<MasteryState, number> = {
                unseen: 0,
                learning: 0,
                recognized: 0,
                mastered: 0,
              };
              for (const c of focusCountries) {
                const state =
                  progress.skills[`cov:${c.id}`]?.mastery ?? 'unseen';
                counts[state] += 1;
              }

              const trapExamples = focusCountries
                .filter(
                  (c) => c.isTrapCountry || c.coverageTier !== 'official'
                )
                .slice(0, 6);

              return (
                <article
                  key={focus.id}
                  className="apple-card flex flex-col justify-between p-6"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--brand-accent)]">
                          {focus.id === 'trap-countries'
                            ? 'High-Yield Trap Set'
                            : `${focusCountries.length} Playable Countries`}
                        </span>
                        <h3 className="mt-0.5 text-[1.125rem] font-semibold">
                          {focus.name}
                        </h3>
                      </div>
                      <span className="rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-[0.75rem] font-medium text-[var(--text-secondary)]">
                        {counts.mastered}/{focusCountries.length} Mastered
                      </span>
                    </div>

                    <p className="mt-2 text-[0.8125rem] text-[var(--text-secondary)]">
                      {focus.description}
                    </p>

                    {/* Coverage Tier distribution strip */}
                    <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[0.75rem]">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-800 dark:text-emerald-200">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {officialCount} Official
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/12 px-2.5 py-1 font-medium text-amber-800 dark:text-amber-200">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        {limitedCount} Limited
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-1 font-medium text-rose-800 dark:text-rose-200">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        {noneCount} None
                      </span>
                    </div>

                    {/* Key trap / limited examples */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {trapExamples.map((country) => (
                        <span
                          key={country.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2.5 py-1 text-[0.75rem]"
                        >
                          <span className="font-medium">{country.name}</span>
                          <span
                            className={`rounded-sm px-1.5 py-0.2 text-[0.6875rem] font-semibold uppercase ${
                              country.coverageTier === 'official'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : country.coverageTier === 'limited'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {country.coverageTier}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-4">
                    <div className="flex items-center gap-2 text-[0.75rem] text-[var(--text-secondary)]">
                      <span>○ {counts.unseen}</span>
                      <span>◐ {counts.learning}</span>
                      <span>◕ {counts.recognized}</span>
                      <span>● {counts.mastered}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          launchCoverageSession(focus.id, 'regional-map')
                        }
                        className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-zinc-500/10"
                      >
                        Map Quiz
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          launchCoverageSession(focus.id, drillMode)
                        }
                        className="rounded-lg bg-[var(--brand-accent)] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-white hover:opacity-95"
                      >
                        Practice Focus →
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Interactive World Coverage Reference Map */}
        <section
          aria-labelledby="coverage-reference-map-heading"
          className="apple-card space-y-4 p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="coverage-reference-map-heading"
                className="text-[1.125rem] font-semibold"
              >
                Interactive Street View Coverage Tier Map
              </h2>
              <p className="mt-1 text-[0.8125rem] text-[var(--text-secondary)]">
                Click any <strong>Playable Country</strong> on the map to inspect
                its exact <strong>Coverage Tier</strong> (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Official
                </span>
                ,{' '}
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  Limited
                </span>
                , or{' '}
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  None
                </span>
                ) and regional Street View coverage note.
              </p>
            </div>
          </div>

          {inspectedCountry && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-[1rem] font-bold">
                    {inspectedCountry.name}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.75rem] font-semibold ${
                      COVERAGE_TIER_BADGE_STYLES[inspectedCountry.coverageTier]
                        .badgeClass
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        COVERAGE_TIER_BADGE_STYLES[
                          inspectedCountry.coverageTier
                        ].dotClass
                      }`}
                    />
                    {
                      COVERAGE_TIER_BADGE_STYLES[inspectedCountry.coverageTier]
                        .label
                    }
                  </span>
                  {inspectedCountry.isTrapCountry && (
                    <span className="rounded-full bg-rose-500/12 px-2.5 py-0.5 text-[0.75rem] font-semibold text-rose-700 dark:text-rose-300">
                      Common Trap Country
                    </span>
                  )}
                  <span className="text-[0.75rem] text-[var(--text-secondary)]">
                    {inspectedCountry.region} · Drives on the{' '}
                    <strong className="capitalize">
                      {inspectedCountry.drivingSide}
                    </strong>
                  </span>
                </div>
                <MasteryBadge
                  state={
                    progress.skills[`cov:${inspectedCountry.id}`]?.mastery ??
                    'unseen'
                  }
                  size="sm"
                />
              </div>
              <p className="mt-2 text-[0.875rem] text-[var(--text-primary)]">
                {inspectedCountry.coverageNote}
              </p>
            </div>
          )}

          <WorldMapView
            selectedCountryIds={
              explorerInspectedCountryId ? [explorerInspectedCountryId] : []
            }
            onToggleCountry={(countryId) =>
              setExplorerInspectedCountryId(countryId)
            }
            activeRegionPreset={mapRegionPreset}
            onRegionPresetChange={setMapRegionPreset}
            showAllCoverageTiers={true}
          />
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Active Coverage Drill View (Tier Speed, Neighbor Cluster, or Regional Map)
  // ---------------------------------------------------------------------------
  const prompt = activeTrial.coveragePrompt;
  const focusSpec = COVERAGE_FOCUS_MAP[selectedFocus];
  const targetCountry = prompt.targetCountry;
  const expectedCountryIds = prompt.expectedCountryIds ?? [targetCountry.id];
  const currentSkillMastery =
    progress.skills[activeTrial.skillId]?.mastery ?? 'unseen';

  // Fluency bar progress (target 3500ms)
  const fluencyRatio = Math.min(100, Math.round((elapsedMs / 3500) * 100));
  const isWithinFluencyThreshold = elapsedMs <= 3500;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Drill Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExitToFocusPicker}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-zinc-500/10"
          >
            ← Coverage Focuses
          </button>
          <div>
            <h1 className="text-[1rem] font-semibold">
              {focusSpec?.name ?? 'Coverage Drill'}
            </h1>
            <p className="text-[0.75rem] text-[var(--text-secondary)]">
              Trial #{activeTrial.trialNumber} ·{' '}
              {activeTrial.kind === 'coverage-tier'
                ? 'Speed Coverage Tier Classification'
                : activeTrial.kind === 'coverage-cluster'
                  ? 'Neighboring Cluster Coverage Trap'
                  : 'Interactive Regional Coverage Map Quiz'}
              {activeTrial.isFollowUp && (
                <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.6875rem] font-semibold text-amber-700 dark:text-amber-300">
                  Spaced Follow-Up (D=2)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <MasteryBadge state={currentSkillMastery} size="sm" />
          {!feedback && (
            <button
              type="button"
              aria-expanded={Boolean(activeBreakdown)}
              onClick={handleRequestGuidedBreakdown}
              className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3.5 py-1.5 text-[0.8125rem] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20"
            >
              Show me what to look for (?)
            </button>
          )}
        </div>
      </div>

      {/* Main Prompt Card */}
      <section
        aria-labelledby="coverage-prompt-heading"
        className="apple-card p-6 sm:p-8"
      >
        {/* Non-punishing Fluency Indicator Bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-[0.75rem] text-[var(--text-secondary)]">
            <span>
              {activeTrial.kind === 'coverage-tier'
                ? 'Classify Official vs Limited vs None coverage (<3.5s fluency target)'
                : activeTrial.kind === 'coverage-cluster'
                  ? 'Identify the coverage outlier in this neighboring cluster'
                  : 'Click all matching countries on the interactive map'}
            </span>
            <span className="font-mono">
              {feedback
                ? `${(feedback.responseTimeMs / 1000).toFixed(2)}s`
                : `${(elapsedMs / 1000).toFixed(1)}s`}
            </span>
          </div>
          <div
            aria-hidden="true"
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-500/15"
          >
            <div
              className={`h-full transition-all duration-75 ${
                isWithinFluencyThreshold ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${fluencyRatio}%` }}
            />
          </div>
        </div>

        {/* Question Header */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-md bg-zinc-500/10 px-2.5 py-0.5 text-[0.75rem] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              {activeTrial.kind === 'coverage-tier'
                ? `${targetCountry.region} · Speed Coverage Classification`
                : activeTrial.kind === 'coverage-cluster'
                  ? `${prompt.clusterName ?? targetCountry.region} · Neighboring Cluster Quiz`
                  : `${prompt.mapRegionLabel ?? targetCountry.region} · Regional Map Quiz`}
            </span>

            {activeTrial.kind === 'coverage-tier' && (
              <span className="text-[0.75rem] text-[var(--text-secondary)]">
                Region: <strong>{targetCountry.region}</strong> (
                {targetCountry.subregion}) · Driving side:{' '}
                <strong className="capitalize">
                  {targetCountry.drivingSide}
                </strong>
              </span>
            )}
          </div>

          <h2
            id="coverage-prompt-heading"
            className="mt-3 text-[1.25rem] font-bold tracking-tight sm:text-[1.5rem]"
          >
            {prompt.promptTitle}
          </h2>
          <p className="mt-1.5 text-[0.875rem] text-[var(--text-secondary)]">
            {prompt.promptDescription}
          </p>

          {activeTrial.kind === 'coverage-tier' && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-2.5">
                <span className="font-mono text-[0.75rem] uppercase text-[var(--text-secondary)]">
                  {targetCountry.id.toUpperCase()}
                </span>
                <span className="text-[1.25rem] font-bold">
                  {targetCountry.name}
                </span>
                {targetCountry.isTrapCountry && (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[0.75rem] font-semibold text-amber-800 dark:text-amber-200">
                    High-Yield Coverage Check
                  </span>
                )}
              </div>
            </div>
          )}

          {activeTrial.kind === 'coverage-map' && (
            <p className="mt-2 text-[0.875rem] text-[var(--text-secondary)]">
              Target in {prompt.mapRegionLabel ?? targetCountry.region}:{' '}
              <strong>
                {expectedCountryIds.length}{' '}
                {expectedCountryIds.length === 1 ? 'country' : 'countries'}
              </strong>{' '}
              (
              {prompt.mapTargetFilter === 'covered'
                ? 'Official + Limited coverage'
                : prompt.mapTargetFilter === 'uncovered'
                  ? 'None — no official Google Street View'
                  : 'Limited — regional corridors or trekker-only coverage'}
              ).
            </p>
          )}
        </div>

        {/* Guided Breakdown Overlay (On-Demand Scaffolding) */}
        {activeBreakdown && !feedback && (
          <section
            aria-labelledby={breakdownHeadingId}
            className="mt-5 rounded-2xl border-2 border-indigo-500/50 bg-indigo-500/8 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="text-[0.75rem] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                  Guided Breakdown · Assisted Scaffolding
                </span>
                <h3
                  id={breakdownHeadingId}
                  className="mt-0.5 text-[1.125rem] font-bold"
                >
                  {activeBreakdown.languageName} (
                  {activeBreakdown.nativeName})
                </h3>
                <p className="text-[0.8125rem] text-[var(--text-secondary)]">
                  {activeBreakdown.gestaltNote}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismissGuidedBreakdown}
                className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[0.75rem] font-medium"
              >
                Close (Esc)
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Coverage Note & Regional Details
                </p>
                <p className="mt-2 text-[0.875rem]">
                  {activeBreakdown.coverageNote ?? activeBreakdown.contrastNote}
                </p>
                {activeBreakdown.regionalLimitedNotes &&
                  activeBreakdown.regionalLimitedNotes.length > 0 && (
                    <ul
                      className="mt-2.5 space-y-1.5 text-[0.75rem]"
                      role="list"
                    >
                      {activeBreakdown.regionalLimitedNotes.map((rn) => (
                        <li
                          key={rn.countryId}
                          className="rounded-lg bg-amber-500/10 p-2"
                        >
                          <strong>{rn.countryName} (Limited):</strong>{' '}
                          {rn.coverageNote}
                        </li>
                      ))}
                    </ul>
                  )}
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Neighbor & Option Comparison
                </p>
                <ul className="mt-2.5 space-y-1.5 text-[0.75rem]" role="list">
                  {activeBreakdown.distractorEliminations.map((d) => (
                    <li
                      key={d.optionId}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2.5 py-1.5"
                    >
                      <strong>{d.languageName}:</strong>{' '}
                      <span className="text-[var(--text-secondary)]">
                        {d.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-indigo-500/20 pt-3">
              <p className="text-[0.75rem] text-[var(--text-secondary)]">
                Using Guided Breakdown marks this trial as{' '}
                <strong>assisted</strong> and schedules 2 unassisted follow-up
                trials after D=2 spacing.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (activeTrial.kind === 'coverage-map') {
                    void handleSubmitCoverageMap(
                      activeBreakdown.candidateCountries.map((c) => c.id)
                    );
                  } else {
                    const correctId =
                      activeTrial.kind === 'coverage-tier'
                        ? `tier:${targetCountry.coverageTier}`
                        : `cov:${targetCountry.id}`;
                    void handleSelectOption(correctId);
                  }
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-[0.8125rem] font-semibold text-white hover:bg-indigo-500"
              >
                Confirm Guided Answer (Enter) →
              </button>
            </div>
          </section>
        )}

        {/* Answer Area: Speed Tier / Neighbor Cluster Buttons OR Interactive Regional Map */}
        {activeTrial.kind === 'coverage-map' ? (
          <div className="mt-6 space-y-4">
            <WorldMapView
              selectedCountryIds={selectedMapCountryIds}
              onToggleCountry={handleToggleMapCountry}
              evaluation={feedback?.mapEvaluation ?? null}
              activeRegionPreset={mapRegionPreset}
              onRegionPresetChange={setMapRegionPreset}
              readOnly={Boolean(feedback)}
              highlightedCoverageCountryIds={
                feedback ? feedback.mapHighlightedCountryIds : undefined
              }
            />

            {!feedback && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
                  <span className="font-medium text-[var(--text-secondary)]">
                    Selected ({selectedMapCountryIds.length}):
                  </span>
                  {selectedMapCountryIds.length === 0 ? (
                    <span className="text-[var(--text-secondary)]">
                      Click countries on the map or territory pills above
                    </span>
                  ) : (
                    selectedMapCountryIds.map((id) => (
                      <span
                        key={id}
                        className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[0.75rem] font-semibold text-sky-700 dark:text-sky-300"
                      >
                        {PLAYABLE_COUNTRY_MAP[id]?.name ?? id}
                      </span>
                    ))
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedMapCountryIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedMapCountryIds([])}
                      className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[0.75rem] font-medium"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={selectedMapCountryIds.length === 0}
                    onClick={() => void handleSubmitCoverageMap()}
                    className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 text-[0.875rem] font-semibold text-white disabled:opacity-40"
                  >
                    Check Selected Countries (Enter)
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div
              className={`grid grid-cols-1 gap-3 ${
                activeTrial.kind === 'coverage-tier'
                  ? 'sm:grid-cols-3'
                  : 'sm:grid-cols-2'
              }`}
              role="group"
              aria-label="Coverage answer choices"
            >
              {activeTrial.options.map((opt, idx) => {
                const isChosen =
                  feedback?.chosenOptionId === opt.id ||
                  feedback?.chosenOptionId === opt.languageId;
                const isExpected =
                  activeTrial.kind === 'coverage-tier'
                    ? opt.id === `tier:${targetCountry.coverageTier}` ||
                      opt.languageId === targetCountry.coverageTier
                    : opt.id === `cov:${targetCountry.id}` ||
                      opt.languageId === targetCountry.id;

                let buttonStyle =
                  'border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--brand-accent)]';
                if (feedback) {
                  if (isExpected) {
                    buttonStyle =
                      'border-emerald-500 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100';
                  } else if (isChosen && !feedback.correct) {
                    buttonStyle =
                      'border-rose-500 bg-rose-500/12 text-rose-900 dark:text-rose-100';
                  } else {
                    buttonStyle =
                      'border-[var(--border-subtle)] bg-[var(--surface-canvas)] opacity-60';
                  }
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={Boolean(feedback)}
                    onClick={() => void handleSelectOption(opt.id)}
                    className={`flex items-center justify-between rounded-xl border-2 px-4 py-3.5 text-left transition ${buttonStyle}`}
                  >
                    <div>
                      <p className="text-[0.9375rem] font-semibold">
                        {opt.label}
                      </p>
                      {opt.sublabel && (
                        <p className="text-[0.75rem] text-[var(--text-secondary)]">
                          {opt.sublabel}
                        </p>
                      )}
                    </div>
                    <kbd className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2 py-0.5 font-mono text-[0.75rem] text-[var(--text-secondary)]">
                      {idx + 1}
                    </kbd>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Immediate Post-Answer Coverage Feedback & Map Reveal */}
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={`mt-6 rounded-2xl border-2 p-5 ${
              feedback.correct
                ? 'border-emerald-500/50 bg-emerald-500/8'
                : 'border-amber-500/50 bg-amber-500/8'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold uppercase ${
                      feedback.correct
                        ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                        : 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                    }`}
                  >
                    {feedback.correct
                      ? feedback.assisted
                        ? 'Assisted Match'
                        : 'Correct'
                      : 'Coverage Distinction Review'}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.75rem] font-semibold ${
                      COVERAGE_TIER_BADGE_STYLES[feedback.coverageTier]
                        .badgeClass
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        COVERAGE_TIER_BADGE_STYLES[feedback.coverageTier]
                          .dotClass
                      }`}
                    />
                    {feedback.countryName}:{' '}
                    {COVERAGE_TIER_BADGE_STYLES[feedback.coverageTier].label}
                  </span>

                  <span className="text-[0.8125rem] text-[var(--text-secondary)]">
                    {(feedback.responseTimeMs / 1000).toFixed(2)}s · Mastery:{' '}
                  </span>
                  <MasteryBadge state={feedback.newMastery} size="xs" />
                </div>

                {/* Exact Country Coverage Note */}
                <p className="mt-2.5 text-[0.9375rem] font-medium text-[var(--text-primary)]">
                  <strong>{feedback.countryName}</strong> (
                  <span className="uppercase">{feedback.coverageTier}</span>
                  ): {feedback.coverageNote}
                </p>

                {/* Map Evaluation Summary for Regional Map Drills */}
                {feedback.mapEvaluation && (
                  <div className="mt-3 space-y-1 text-[0.8125rem]">
                    <p>
                      <strong>Regional Map Check:</strong>{' '}
                      {feedback.mapEvaluation.correctCountryIds.length} of{' '}
                      {feedback.mapEvaluation.expectedCountryIds.length}{' '}
                      target countries identified.
                    </p>
                    {feedback.mapEvaluation.missedCountryIds.length > 0 && (
                      <p className="text-amber-700 dark:text-amber-300">
                        <strong>Missed on map:</strong>{' '}
                        {feedback.mapEvaluation.missedCountryIds
                          .map((id) => PLAYABLE_COUNTRY_MAP[id]?.name ?? id)
                          .join(', ')}
                      </p>
                    )}
                    {feedback.mapEvaluation.incorrectCountryIds.length > 0 && (
                      <p className="text-rose-700 dark:text-rose-300">
                        <strong>False alarms:</strong>{' '}
                        {feedback.mapEvaluation.incorrectCountryIds
                          .map((id) => {
                            const c = PLAYABLE_COUNTRY_MAP[id];
                            return c ? `${c.name} (${c.coverageTier})` : id;
                          })
                          .join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleNextTrial}
                className="shrink-0 rounded-xl bg-[var(--brand-accent)] px-5 py-2.5 text-[0.875rem] font-semibold text-white shadow-xs hover:opacity-95"
              >
                Next Trial (Enter) →
              </button>
            </div>

            {/* Specific Regional Coverage Notes for Limited Countries */}
            {feedback.regionalLimitedNotes.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4">
                <p className="text-[0.75rem] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                  Regional Street View Coverage Notes (Limited Coverage)
                </p>
                <ul className="mt-2 space-y-1.5 text-[0.8125rem]" role="list">
                  {feedback.regionalLimitedNotes.map((rn) => (
                    <li key={rn.countryId}>
                      <strong>{rn.countryName} (Limited):</strong>{' '}
                      <span className="text-[var(--text-primary)]">
                        {rn.coverageNote}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Interactive Map Reveal showing Exact Coverage Tier for Speed & Cluster Drills */}
            {activeTrial.kind !== 'coverage-map' && (
              <div className="mt-4 space-y-2 border-t border-[var(--border-subtle)] pt-4">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Exact Coverage Tier on the Map (
                  {activeTrial.kind === 'coverage-cluster'
                    ? 'Neighboring Cluster Comparison'
                    : `${feedback.countryName} — ${feedback.coverageTier.toUpperCase()}`}
                  )
                </p>
                <WorldMapView
                  selectedCountryIds={[]}
                  onToggleCountry={() => {}}
                  activeRegionPreset={mapRegionPreset}
                  onRegionPresetChange={setMapRegionPreset}
                  readOnly={true}
                  highlightedCoverageCountryIds={
                    feedback.mapHighlightedCountryIds
                  }
                />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
