import React from 'react';
import {
  LANGUAGE_GROUPS,
  LANGUAGE_MAP,
  type LanguageGroupSelectionId,
  type SectionId,
} from '../data/index.ts';
import type { ProgressData, SectionMasteryBreakdown } from '../storage/index.ts';
import { MasteryRing } from './MasteryBadge.tsx';

interface DashboardViewProps {
  progress: ProgressData;
  sectionBreakdowns: Record<SectionId, SectionMasteryBreakdown>;
  onOpenLanguagesSection: (initialGroup?: LanguageGroupSelectionId) => void;
  onOpenDataModal: () => void;
}

const SECTION_CARDS: Array<{
  id: SectionId;
  title: string;
  subtitle: string;
  clueExamples: string[];
  availableInV1Slice: boolean;
}> = [
  {
    id: 'languages',
    title: 'Languages',
    subtitle:
      'Recognize Sentences, Sign Text, and explicit Tells across 10 visually confusable Language Groups.',
    clueExamples: ['ß → German', 'ő / ű → Hungarian', 'ř / ů → Czech', 'ㅇ / ㅎ → Korean'],
    availableInV1Slice: true,
  },
  {
    id: 'driving-side',
    title: 'Driving Side',
    subtitle:
      'Build instant spatial recall of left- vs right-driving Playable Countries and road-edge geometry clues.',
    clueExamples: ['Kenya (Left)', 'Rwanda (Right)', 'Thailand (Left)', 'Laos (Right)'],
    availableInV1Slice: false,
  },
  {
    id: 'coverage',
    title: 'Coverage',
    subtitle:
      'Internalize Official, Limited, and None Street View Coverage Tiers and rule out trap countries.',
    clueExamples: ['China (None)', 'Tunisia (Limited)', 'Senegal (Limited)', 'Belarus (None)'],
    availableInV1Slice: false,
  },
  {
    id: 'domains-currencies',
    title: 'Domains & Currencies',
    subtitle:
      'Map country-code domains (.hr, .ch, .za, .rs) and currency signs (zł, Kč, Ft, ฿, ₪) to Candidate Countries.',
    clueExamples: ['.hr → Croatia', 'zł → Poland', 'Kč → Czechia', '.za → South Africa'],
    availableInV1Slice: false,
  },
];

export function DashboardView({
  progress,
  sectionBreakdowns,
  onOpenLanguagesSection,
  onOpenDataModal,
}: DashboardViewProps) {
  const allBreakdowns = Object.values(sectionBreakdowns);
  const overallTotals = allBreakdowns.reduce(
    (acc, b) => {
      acc.unseen += b.unseen;
      acc.learning += b.learning;
      acc.recognized += b.recognized;
      acc.mastered += b.mastered;
      acc.total += b.total;
      return acc;
    },
    { unseen: 0, learning: 0, recognized: 0, mastered: 0, total: 0 }
  );

  const recentCorrect = progress.recentTrials.filter((t) => t.correct).length;
  const recentAccuracy =
    progress.recentTrials.length > 0
      ? Math.round((recentCorrect / progress.recentTrials.length) * 100)
      : 0;

  const totalMinutes = Math.max(
    0,
    Math.round(progress.totalTimeMs / 60_000)
  );

  // Extract top confusion pairs from confusionMatrix
  const confusionPairs: Array<{
    expectedId: string;
    chosenId: string;
    expectedLabel: string;
    chosenLabel: string;
    count: number;
  }> = [];

  for (const [expectedId, targets] of Object.entries(progress.confusionMatrix)) {
    for (const [chosenId, count] of Object.entries(targets)) {
      if (count > 0) {
        const expLang = LANGUAGE_MAP[expectedId.replace(/^lang:/, '')];
        const choLang = LANGUAGE_MAP[chosenId.replace(/^lang:/, '')];
        confusionPairs.push({
          expectedId,
          chosenId,
          expectedLabel: expLang?.name ?? expectedId,
          chosenLabel: choLang?.name ?? chosenId,
          count,
        });
      }
    }
  }
  confusionPairs.sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-8">
      {/* Top Hero & Global Telemetry */}
      <section aria-labelledby="dashboard-heading" className="apple-card p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-2">
            <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--brand-accent)]">
              Perceptual Learning & ARTS Scheduler
            </p>
            <h1
              id="dashboard-heading"
              tabIndex={-1}
              className="text-[1.75rem] font-bold tracking-tight sm:text-[2.125rem]"
            >
              Dashboard
            </h1>
            <p className="text-[0.9375rem] text-[var(--text-secondary)]">
              Train automatic, sub-3.5-second clue recognition across unseen{' '}
              <strong>Samples</strong>, explicit <strong>Tells</strong>, and
              covered <strong>Playable Countries</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenLanguagesSection()}
              className="rounded-xl bg-[var(--brand-accent)] px-5 py-2.5 text-[0.9375rem] font-semibold text-white shadow-xs transition hover:opacity-95"
            >
              Practice Languages
            </button>
            <button
              type="button"
              onClick={onOpenDataModal}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-2.5 text-[0.875rem] font-medium transition hover:opacity-90"
            >
              Backup & Reset
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="mt-6 grid grid-cols-2 gap-3.5 border-t border-[var(--border-subtle)] pt-6 sm:grid-cols-4">
          <div className="rounded-xl bg-[var(--surface-canvas)] p-4 border border-[var(--border-subtle)]">
            <p className="text-[0.75rem] font-medium text-[var(--text-secondary)]">
              Total Trials Practiced
            </p>
            <p className="mt-1 text-[1.5rem] font-bold tracking-tight">
              {progress.totalTrials}
            </p>
            <p className="mt-0.5 text-[0.75rem] text-[var(--text-secondary)]">
              {progress.recentTrials.length > 0
                ? `${recentAccuracy}% recent accuracy`
                : 'Ready for first session'}
            </p>
          </div>

          <div className="rounded-xl bg-[var(--surface-canvas)] p-4 border border-[var(--border-subtle)]">
            <p className="text-[0.75rem] font-medium text-[var(--text-secondary)]">
              Active Streak & Time
            </p>
            <p className="mt-1 text-[1.5rem] font-bold tracking-tight">
              {progress.streakDays} {progress.streakDays === 1 ? 'day' : 'days'}
            </p>
            <p className="mt-0.5 text-[0.75rem] text-[var(--text-secondary)]">
              {totalMinutes > 0
                ? `${totalMinutes} min active drill time`
                : `${Math.round(progress.totalTimeMs / 1000)}s active drill time`}
            </p>
          </div>

          <div className="rounded-xl bg-[var(--surface-canvas)] p-4 border border-[var(--border-subtle)]">
            <p className="text-[0.75rem] font-medium text-[var(--text-secondary)]">
              Mastered & Recognized
            </p>
            <p className="mt-1 text-[1.5rem] font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {overallTotals.mastered + overallTotals.recognized}{' '}
              <span className="text-[0.875rem] font-normal text-[var(--text-secondary)]">
                / {overallTotals.total}
              </span>
            </p>
            <p className="mt-0.5 text-[0.75rem] text-[var(--text-secondary)]">
              {overallTotals.mastered} Mastered · {overallTotals.recognized}{' '}
              Recognized
            </p>
          </div>

          <div className="rounded-xl bg-[var(--surface-canvas)] p-4 border border-[var(--border-subtle)]">
            <p className="text-[0.75rem] font-medium text-[var(--text-secondary)]">
              Learning & Unseen
            </p>
            <p className="mt-1 text-[1.5rem] font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {overallTotals.learning}{' '}
              <span className="text-[0.875rem] font-normal text-[var(--text-secondary)]">
                Learning
              </span>
            </p>
            <p className="mt-0.5 text-[0.75rem] text-[var(--text-secondary)]">
              {overallTotals.unseen} Unseen skills remaining
            </p>
          </div>
        </div>
      </section>

      {/* Sections Grid */}
      <section aria-labelledby="sections-heading" className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 id="sections-heading" className="text-[1.25rem] font-semibold">
            Practice Sections
          </h2>
          <p className="text-[0.8125rem] text-[var(--text-secondary)]">
            4 Mastery States: Unseen ○ · Learning ◐ · Recognized ◕ · Mastered ●
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {SECTION_CARDS.map((card) => {
            const b = sectionBreakdowns[card.id];
            return (
              <div
                key={card.id}
                className="apple-card flex flex-col justify-between p-6 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-[1.125rem] font-semibold">
                          {card.title}
                        </h3>
                        <span className="rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-[0.75rem] font-medium text-[var(--text-secondary)]">
                          {b.total} skills
                        </span>
                      </div>
                      <p className="mt-1.5 text-[0.875rem] text-[var(--text-secondary)]">
                        {card.subtitle}
                      </p>
                    </div>
                    <MasteryRing
                      unseen={b.unseen}
                      learning={b.learning}
                      recognized={b.recognized}
                      mastered={b.mastered}
                      total={b.total}
                    />
                  </div>

                  {/* Mastery State Breakdown Pills */}
                  <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-[var(--surface-canvas)] p-3 border border-[var(--border-subtle)] text-center">
                    <div>
                      <p className="text-[0.6875rem] font-medium text-[var(--text-secondary)]">
                        ○ Unseen
                      </p>
                      <p className="text-[0.9375rem] font-semibold">
                        {b.unseen}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.6875rem] font-medium text-amber-600 dark:text-amber-400">
                        ◐ Learning
                      </p>
                      <p className="text-[0.9375rem] font-semibold text-amber-600 dark:text-amber-400">
                        {b.learning}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.6875rem] font-medium text-sky-600 dark:text-sky-400">
                        ◕ Recognized
                      </p>
                      <p className="text-[0.9375rem] font-semibold text-sky-600 dark:text-sky-400">
                        {b.recognized}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.6875rem] font-medium text-emerald-600 dark:text-emerald-400">
                        ● Mastered
                      </p>
                      <p className="text-[0.9375rem] font-semibold text-emerald-600 dark:text-emerald-400">
                        {b.mastered}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {card.clueExamples.map((clue) => (
                      <span
                        key={clue}
                        className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[0.75rem] font-mono text-[var(--text-secondary)]"
                      >
                        {clue}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
                  <span className="text-[0.8125rem] text-[var(--text-secondary)]">
                    {b.practicedTrials} trials completed
                  </span>
                  {card.availableInV1Slice ? (
                    <button
                      type="button"
                      onClick={() => onOpenLanguagesSection()}
                      className="rounded-lg bg-[var(--brand-accent)] px-4 py-1.5 text-[0.875rem] font-semibold text-white hover:opacity-95"
                    >
                      Open {card.title} →
                    </button>
                  ) : (
                    <span className="rounded-lg border border-[var(--border-subtle)] px-3 py-1 text-[0.75rem] font-medium text-[var(--text-secondary)]">
                      Dataset Indexed ({b.total} items)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick Launch Language Groups + Confusion Pairs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section
          aria-labelledby="quick-groups-heading"
          className="apple-card p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                id="quick-groups-heading"
                className="text-[1.125rem] font-semibold"
              >
                Language Groups Quick Launch
              </h2>
              <p className="text-[0.8125rem] text-[var(--text-secondary)]">
                Jump straight into a confusable Language Group’s Stage 0 Contrast
                Card or Stage 1 Speed Drill.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenLanguagesSection('all-mixed')}
              className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-zinc-500/10"
            >
              All-Groups Mixed
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {LANGUAGE_GROUPS.map((group) => {
              const groupMastered = group.languageIds.filter(
                (id) => progress.skills[`lang:${id}`]?.mastery === 'mastered'
              ).length;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onOpenLanguagesSection(group.id)}
                  className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-4 py-3 text-left transition hover:border-[var(--brand-accent)]"
                >
                  <div>
                    <p className="text-[0.875rem] font-semibold">
                      {group.name}
                    </p>
                    <p className="text-[0.75rem] text-[var(--text-secondary)]">
                      {group.languageIds.length} confusable languages
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--border-subtle)] px-2.5 py-0.5 text-[0.75rem] font-medium">
                    {groupMastered}/{group.languageIds.length} Mastered
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          aria-labelledby="confusion-heading"
          className="apple-card p-6"
        >
          <h2 id="confusion-heading" className="text-[1.125rem] font-semibold">
            Top Confusion Pairs
          </h2>
          <p className="mt-1 text-[0.8125rem] text-[var(--text-secondary)]">
            Directed confusions tracked across trials to boost ARTS scheduling
            priority.
          </p>

          {confusionPairs.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-[var(--border-subtle)] p-5 text-center">
              <p className="text-[0.875rem] font-medium">
                No confusion pairs recorded yet
              </p>
              <p className="mt-1 text-[0.75rem] text-[var(--text-secondary)]">
                Complete a Languages Speed Drill to see which lookalike
                languages you mistake for each other.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2.5" role="list">
              {confusionPairs.slice(0, 6).map((pair) => (
                <li
                  key={`${pair.expectedId}->${pair.chosenId}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3.5 py-2.5 text-[0.8125rem]"
                >
                  <span>
                    <strong>{pair.expectedLabel}</strong>{' '}
                    <span className="text-[var(--text-secondary)]">
                      mistaken for
                    </span>{' '}
                    <strong>{pair.chosenLabel}</strong>
                  </span>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.75rem] font-semibold text-amber-700 dark:text-amber-300">
                    {pair.count}×
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
