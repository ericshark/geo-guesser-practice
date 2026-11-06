import { useCallback, useEffect, useRef, useState } from 'react';
import {
  resolveSkillDisplayInfo,
  type DomainsCurrenciesDrillMode,
  type DomainsCurrenciesFeedback,
  type GuidedBreakdown,
  type PracticeEngine,
  type PracticeTrial,
} from '../engine/practiceEngine.ts';
import { MasteryBadge } from './MasteryBadge.tsx';

const DRILL_MODES: { id: DomainsCurrenciesDrillMode; label: string }[] = [
  { id: 'mixed', label: 'Mixed practice' },
  { id: 'domains', label: 'Country-code domains' },
  { id: 'currencies', label: 'Currency signs' },
];

export function DomainsCurrenciesSectionView({
  engine,
  initialSkillId,
  onBackToDashboard,
}: {
  engine: PracticeEngine;
  initialSkillId?: string;
  onBackToDashboard: () => void;
}) {
  const [trial, setTrial] = useState<PracticeTrial | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<DomainsCurrenciesFeedback | null>(null);
  const [breakdown, setBreakdown] = useState<GuidedBreakdown | null>(null);
  const [saving, setSaving] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const submitting = useRef(false);
  const isDomain = trial?.kind === 'domain';

  const showTrial = (next: PracticeTrial) => {
    setTrial(next);
    setSelection([]);
    setFeedback(null);
    setBreakdown(null);
    setElapsedMs(0);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (!trial || feedback) return;
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - trial.startedAtMs);
    }, 100);
    return () => window.clearInterval(interval);
  }, [trial, feedback]);

  useEffect(() => {
    if (trial) heading.current?.focus({ preventScroll: true });
  }, [trial]);

  const toggleCountry = useCallback((id: string) => {
    setSelection((selected) => {
      if (selected.includes(id)) return selected.filter((item) => item !== id);
      return isDomain ? [id] : [...selected, id];
    });
  }, [isDomain]);

  const submit = useCallback(async () => {
    if (feedback || submitting.current || selection.length === 0) return;
    submitting.current = true;
    setSaving(true);
    try {
      setFeedback(await engine.submitDomainsCurrenciesAnswer(selection));
    } finally {
      submitting.current = false;
      setSaving(false);
      setBreakdown(null);
    }
  }, [engine, feedback, selection]);

  const openBreakdown = useCallback(() => {
    if (!feedback && !submitting.current) setBreakdown(engine.requestGuidedBreakdown());
  }, [engine, feedback]);

  const dismissBreakdown = useCallback(() => {
    engine.dismissGuidedBreakdown();
    setBreakdown(null);
    heading.current?.focus({ preventScroll: true });
  }, [engine]);

  useEffect(() => {
    if (!trial) return;
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target !== document.body && !target.closest('[data-sign-drill]')) return;
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat || submitting.current) return;
      const focusedButton = target instanceof HTMLButtonElement;
      const option = trial.options.find(({ shortcutKey }) => String(shortcutKey) === event.key);
      if (event.key === 'Escape') {
        event.preventDefault();
        if (breakdown) dismissBreakdown();
        else onBackToDashboard();
      } else if (!feedback && (event.key === '?' || (event.key === ' ' && !focusedButton))) {
        event.preventDefault();
        openBreakdown();
      } else if (!feedback && option) {
        event.preventDefault();
        toggleCountry(option.id);
      } else if (event.key === 'Enter' && !focusedButton) {
        event.preventDefault();
        if (feedback) showTrial(engine.nextTrial());
        else void submit();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [trial, feedback, breakdown, engine, dismissBreakdown, openBreakdown, onBackToDashboard, submit, toggleCountry]);

  const prompt = trial?.domainsCurrenciesPrompt;
  if (!trial || !prompt) {
    return (
      <section className="apple-card mx-auto max-w-3xl space-y-5 p-6 sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight">Domains &amp; Currencies</h1>
        <p className="text-[var(--text-secondary)]">
          Read country-code domains on signs and pick out the currency marks on price tags.
          For shared currencies, select every matching country among the choices.
        </p>
        {initialSkillId && (
          <p className="font-medium">Practice focus · {resolveSkillDisplayInfo(initialSkillId).label}</p>
        )}
        <div className="flex flex-wrap gap-3">
          {DRILL_MODES.map(({ id, label }) => (
            <button
              type="button"
              key={id}
              className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 font-semibold hover:border-[var(--brand-accent)]"
              onClick={() => showTrial(engine.startDomainsCurrenciesSession(id, initialSkillId))}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const markerStart = trial.sample.text.indexOf(prompt.marker);
  const reveal = (feedback || breakdown) && markerStart >= 0;
  const responseTimeMs = feedback?.responseTimeMs ?? elapsedMs;
  const expected = feedback?.expectedCountryIds ?? [];
  const matches = new Set(prompt.countries.map(({ id }) => id));

  return (
    <section data-sign-drill className="apple-card mx-auto max-w-3xl space-y-5 p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--text-secondary)]">
        <p>{isDomain ? 'Country-code domains' : 'Currency signs'} · Trial {trial.trialNumber}{trial.isFollowUp ? ' · Guided follow-up' : ''}</p>
        <button type="button" onClick={onBackToDashboard} className="rounded-lg border border-[var(--border-subtle)] px-3 py-1">
          Exit drill
        </button>
      </div>
      <div>
        <p className="mb-1 text-xs text-[var(--text-secondary)]">Fluency target · {(trial.fluencyThresholdMs / 1000).toFixed(1)}s</p>
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-zinc-500/15">
          <div
            className="h-full rounded-full bg-[var(--brand-accent)] transition-[width] duration-100"
            style={{ width: `${Math.min(100, responseTimeMs / trial.fluencyThresholdMs * 100)}%` }}
          />
        </div>
      </div>
      <h1 ref={heading} tabIndex={-1} className="text-xl font-bold sm:text-2xl">
        {isDomain ? 'Which country does this domain point to?' : 'Which listed countries match this currency clue?'}
      </h1>
      <p dir="auto" className="break-words rounded-xl bg-[var(--surface-canvas)] p-5 text-center font-mono text-2xl sm:text-3xl">
        {reveal ? (
          <>
            {trial.sample.text.slice(0, markerStart)}
            <mark className="rounded bg-indigo-500/20 text-inherit underline decoration-indigo-500">
              {prompt.marker}
            </mark>
            {trial.sample.text.slice(markerStart + prompt.marker.length)}
          </>
        ) : trial.sample.text}
      </p>
      {!feedback && !breakdown && (
        <button type="button" onClick={openBreakdown} className="text-sm font-semibold text-[var(--brand-accent)]">
          Show me what to look for
        </button>
      )}
      {breakdown && (
        <aside role="complementary" aria-label="Guided Breakdown" className="space-y-2 rounded-xl border border-indigo-500/35 bg-indigo-500/8 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-bold">Guided Breakdown</h2>
            <button type="button" onClick={dismissBreakdown} className="text-sm font-semibold">Close breakdown</button>
          </div>
          <p>{breakdown.gestaltNote}</p>
          <p>
            <strong>Matching choices</strong> · {trial.options.filter(({ id }) => matches.has(id)).map(({ label }) => label).join(', ')}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {breakdown.distractorEliminations.map(({ optionId, reason }) => <li key={optionId}>{reason}</li>)}
          </ul>
          <p className="text-sm text-[var(--text-secondary)]">
            Assisted trial · {breakdown.queuedFollowUps} follow-ups queued
          </p>
        </aside>
      )}
      {!isDomain && !feedback && <p className="text-sm text-[var(--text-secondary)]">Select every match among the choices.</p>}
      <div role="group" aria-label="Country choices" className="grid gap-2 sm:grid-cols-2">
        {trial.options.map(({ id, label, shortcutKey }) => {
          const selected = selection.includes(id);
          const correctChoice = expected.includes(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              disabled={Boolean(feedback) || saving}
              onClick={() => toggleCountry(id)}
              className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left font-medium ${
                correctChoice ? 'border-emerald-500 bg-emerald-500/10' :
                feedback && selected ? 'border-rose-500 bg-rose-500/10' :
                selected ? 'border-[var(--brand-accent)] bg-sky-500/10' :
                'border-[var(--border-subtle)] hover:border-[var(--brand-accent)]'
              }`}
            >
              <span>{label}{correctChoice ? (selected ? ' ✓' : ' · Missed') : feedback && selected ? ' ✕' : ''}</span>
              <kbd className="text-xs text-[var(--text-secondary)]">{shortcutKey}</kbd>
            </button>
          );
        })}
      </div>
      {feedback ? (
        <>
          <div role="status" className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{feedback.correct ? (feedback.assisted ? 'Assisted match' : 'Correct') : 'Review the matches'}</strong>
              <span className="text-sm text-[var(--text-secondary)]">{(feedback.responseTimeMs / 1000).toFixed(2)}s</span>
              <MasteryBadge state={feedback.newMastery} />
            </div>
            <p>
              <strong>{isDomain ? 'Country' : 'Candidate Countries'}</strong> · {prompt.countries.map(({ name }) => name).join(', ')}
            </p>
            {isDomain && <p className="text-sm capitalize">Coverage Tier · {prompt.countries[0].coverageTier}</p>}
            {feedback.saveFailed && <p className="text-sm">The attempt is in memory. Saving progress failed.</p>}
          </div>
          <button type="button" onClick={() => showTrial(engine.nextTrial())} className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-semibold text-white">
            Next trial
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={selection.length === 0 || saving}
          onClick={() => void submit()}
          className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Checking…' : 'Check answer'}
        </button>
      )}
    </section>
  );
}
