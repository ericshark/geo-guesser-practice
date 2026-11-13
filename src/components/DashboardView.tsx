import { ChevronRight, Flame, Play, Sparkles, Target, Trophy } from 'lucide-react';
import {
  LANGUAGE_GROUPS,
  type CoverageFocusId,
  type DrivingSideFocusId,
  type LanguageGroupSelectionId,
  type SectionId,
} from '../data/index.ts';
import {
  getTopConfusionPairs,
  getWeakestLearningSkills,
} from '../engine/practiceEngine.ts';
import type { ProgressData, SectionMasteryBreakdown } from '../storage/index.ts';
import { MasteryBadge, MasteryBar, MasteryRing } from './MasteryBadge.tsx';
import { SECTION_META, SECTION_ORDER } from './sectionMeta.ts';

interface DashboardViewProps {
  progress: ProgressData;
  sectionBreakdowns: Record<SectionId, SectionMasteryBreakdown>;
  onOpenLanguagesSection: (initialGroup?: LanguageGroupSelectionId) => void;
  onOpenDrivingSideSection: (initialFocus?: DrivingSideFocusId) => void;
  onOpenCoverageSection: (initialFocus?: CoverageFocusId) => void;
  onOpenDomainsCurrenciesSection: (skillId?: string) => void;
  onOpenDataModal: () => void;
}

/** Turns raw option ids that leak into confusion labels (e.g. "side:right") into words. */
function readableLabel(label: string): string {
  const match = /^(side|tier|map):(\w+)$/.exec(label);
  if (!match) return label;
  const [, kind, value] = match;
  if (kind === 'side') return `driving ${value}`;
  return `${value} coverage`;
}

function greeting(totalTrials: number): string {
  if (totalTrials === 0) return 'Welcome, explorer!';
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning, explorer!';
  if (hour < 18) return 'Good afternoon, explorer!';
  return 'Good evening, explorer!';
}

export function DashboardView({
  progress,
  sectionBreakdowns,
  onOpenLanguagesSection,
  onOpenDrivingSideSection,
  onOpenCoverageSection,
  onOpenDomainsCurrenciesSection,
}: DashboardViewProps) {
  const overallTotals = Object.values(sectionBreakdowns).reduce(
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
      : null;

  const confusionPairs = getTopConfusionPairs(progress, 4);
  const weakestSkills = getWeakestLearningSkills(progress, 4);

  const openSection: Record<SectionId, () => void> = {
    languages: () => onOpenLanguagesSection(),
    'driving-side': () => onOpenDrivingSideSection(),
    coverage: () => onOpenCoverageSection(),
    'domains-currencies': () => onOpenDomainsCurrenciesSection(),
  };

  const heroStats = [
    { icon: Flame, label: 'Day streak', value: progress.streakDays, color: 'var(--xp)' },
    { icon: Trophy, label: 'Questions answered', value: progress.totalTrials, color: 'var(--brand-accent)' },
    { icon: Target, label: 'Recent accuracy', value: recentAccuracy === null ? '—' : `${recentAccuracy}%`, color: 'var(--good)' },
  ];

  return (
    <div className="space-y-8">
      {/* Hero: one obvious thing to do */}
      <section
        aria-labelledby="dashboard-heading"
        className="card relative overflow-hidden p-6 sm:p-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-20 blur-2xl"
          style={{ background: 'radial-gradient(circle, var(--brand-accent), transparent 70%)' }}
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl space-y-4">
            <p className="text-[0.8125rem] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
              Dashboard
            </p>
            <h1
              id="dashboard-heading"
              tabIndex={-1}
              className="text-[2rem] font-black leading-tight sm:text-[2.5rem]"
            >
              {greeting(progress.totalTrials)}
            </h1>
            <p className="text-[1.0625rem] text-[var(--text-secondary)]">
              Quick 10-question rounds that train you to spot GeoGuessr clues in
              a flash. We pick the questions you need most.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => onOpenLanguagesSection('smart-weakest')}
                className="btn btn-primary btn-lg"
              >
                <Play aria-hidden="true" className="h-5 w-5" fill="currentColor" />
                {progress.totalTrials === 0 ? 'Play your first round' : 'Play a round'}
              </button>
              <button
                type="button"
                onClick={() => onOpenLanguagesSection('all-mixed')}
                className="btn btn-secondary btn-lg"
              >
                <Sparkles aria-hidden="true" className="h-5 w-5" />
                Mix it up
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6 lg:flex-col lg:items-end">
            <div className="flex items-center gap-4">
              <MasteryRing {...overallTotals} size={112} />
              <div>
                <p className="text-[1.5rem] font-black tabular-nums">
                  {overallTotals.mastered + overallTotals.recognized}
                  <span className="text-[1rem] text-[var(--text-secondary)]">
                    {' '}/ {overallTotals.total}
                  </span>
                </p>
                <p className="text-[0.8125rem] font-bold text-[var(--text-secondary)]">
                  skills you know
                </p>
              </div>
            </div>
          </div>
        </div>

        <dl className="relative mt-8 grid grid-cols-3 gap-3 border-t border-[var(--border-subtle)] pt-6">
          {heroStats.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex flex-col items-center gap-1 text-center sm:flex-row sm:gap-3 sm:text-left">
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <dd className="text-[1.375rem] font-black leading-none tabular-nums">{value}</dd>
                <dt className="mt-1 text-[0.75rem] font-bold text-[var(--text-secondary)]">{label}</dt>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {/* Section tiles */}
      <section aria-labelledby="sections-heading" className="space-y-4">
        <h2 id="sections-heading" className="text-[1.375rem] font-black">
          Pick a skill to train
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SECTION_ORDER.map((id) => {
            const meta = SECTION_META[id];
            const b = sectionBreakdowns[id];
            const Icon = meta.icon;
            return (
              <article
                key={id}
                className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5"
              >
                <div
                  className="flex items-center gap-3 px-5 pb-4 pt-5"
                  style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${meta.color} 22%, transparent), transparent 75%)`,
                  }}
                >
                  <span
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                    style={{ backgroundColor: meta.color }}
                  >
                    <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[1.1875rem] font-black">{meta.title}</h3>
                    <p className="text-[0.875rem] text-[var(--text-secondary)]">{meta.tagline}</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 px-5 pb-5">
                  <MasteryBar {...b} />
                  <div className="flex items-center justify-between text-[0.8125rem] font-bold text-[var(--text-secondary)]">
                    <span>
                      {b.mastered + b.recognized} / {b.total} known
                    </span>
                    <span className="chip font-mono">{meta.exampleClue}</span>
                  </div>
                  <button
                    type="button"
                    onClick={openSection[id]}
                    className="btn mt-auto w-full text-white"
                    style={{
                      backgroundColor: meta.color,
                      borderColor: `color-mix(in srgb, ${meta.color} 75%, black)`,
                    }}
                  >
                    <Play aria-hidden="true" className="h-4 w-4" fill="currentColor" />
                    Play {meta.title}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Needs work */}
      <section aria-labelledby="weak-heading" className="space-y-4">
        <h2 id="weak-heading" className="text-[1.375rem] font-black">
          Needs work
        </h2>
        {weakestSkills.length === 0 && confusionPairs.length === 0 ? (
          <div className="card border-dashed p-6 text-center">
            <p className="text-[1rem] font-extrabold">No weak spots yet 🎯</p>
            <p className="mt-1 text-[0.875rem] text-[var(--text-secondary)]">
              Play a few rounds and the skills you miss or answer slowly will
              show up here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h3 className="text-[1rem] font-extrabold">Weakest skills</h3>
              {weakestSkills.length === 0 ? (
                <p className="mt-2 text-[0.875rem] text-[var(--text-secondary)]">Nothing flagged yet.</p>
              ) : (
                <ul className="mt-3 space-y-2" role="list">
                  {weakestSkills.map((skill) => (
                    <li key={skill.skillId}>
                      <button
                        type="button"
                        onClick={() => {
                          if (skill.section === 'coverage') onOpenCoverageSection('world');
                          else if (skill.section === 'driving-side') onOpenDrivingSideSection('world');
                          else if (skill.section === 'domains-currencies') onOpenDomainsCurrenciesSection(skill.skillId);
                          else onOpenLanguagesSection(skill.groupId ?? 'smart-weakest');
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-[var(--surface-elevated)]"
                      >
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold">{skill.label}</span>
                            <MasteryBadge state={skill.mastery} size="xs" />
                          </span>
                          <span className="block text-[0.75rem] font-semibold text-[var(--text-secondary)]">
                            {skill.accuracyPercent}% right · {(skill.averageRtMs / 1000).toFixed(1)}s avg
                          </span>
                        </span>
                        <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" />
                        <span className="visually-hidden">Practice</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-5">
              <h3 className="text-[1rem] font-extrabold">Mix-ups</h3>
              {confusionPairs.length === 0 ? (
                <p className="mt-2 text-[0.875rem] text-[var(--text-secondary)]">
                  No mix-ups yet. Lookalike languages you confuse will appear here.
                </p>
              ) : (
                <ul className="mt-3 space-y-2" role="list">
                  {confusionPairs.map((pair) => (
                    <li key={`${pair.expectedId}->${pair.chosenId}`}>
                      <button
                        type="button"
                        onClick={() => onOpenLanguagesSection(pair.groupId ?? 'smart-weakest')}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-[var(--surface-elevated)]"
                      >
                        <span className="text-[0.9375rem]">
                          <strong>{pair.expectedLabel}</strong>{' '}
                          <span className="text-[var(--text-secondary)]">mistaken for</span>{' '}
                          <strong>{readableLabel(pair.chosenLabel)}</strong>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="chip !bg-[var(--warn-soft)] !text-[var(--text-primary)]">{pair.count}×</span>
                          <ChevronRight aria-hidden="true" className="h-5 w-5 text-[var(--text-secondary)]" />
                          <span className="visually-hidden">Drill</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Language Groups quick launch */}
      <section aria-labelledby="quick-groups-heading" className="space-y-4">
        <h2 id="quick-groups-heading" className="text-[1.375rem] font-black">
          Jump into a Language Group
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {LANGUAGE_GROUPS.map((group) => {
            const mastered = group.languageIds.filter(
              (id) => progress.skills[`lang:${id}`]?.mastery === 'mastered'
            ).length;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onOpenLanguagesSection(group.id)}
                className="btn btn-secondary btn-sm !font-bold"
              >
                {group.name}
                <span className="chip !px-2 !py-0">
                  {mastered}/{group.languageIds.length}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
