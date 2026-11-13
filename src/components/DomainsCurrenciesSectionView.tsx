import { useCallback, useEffect, useRef, useState } from 'react';
import { AtSign, Banknote, Lightbulb, Play } from 'lucide-react';
import {
  resolveSkillDisplayInfo,
  type DomainsCurrenciesDrillMode,
  type DomainsCurrenciesFeedback,
  type GuidedBreakdown,
  type PracticeEngine,
  type PracticeTrial,
} from '../engine/practiceEngine.ts';
import { AnswerTile, type AnswerTileState } from './game/AnswerTile.tsx';
import { FeedbackBanner, formatSpeed } from './game/FeedbackBanner.tsx';
import { RoundHeader } from './game/RoundHeader.tsx';
import { RoundResults } from './game/RoundResults.tsx';
import { SectionPickerHeader } from './game/SectionPickerHeader.tsx';
import { useRound } from './game/useRound.ts';
import { MasteryBadge } from './MasteryBadge.tsx';
import { SECTION_META } from './sectionMeta.ts';

const META = SECTION_META['domains-currencies'];

const DRILL_MODES: Array<{
  id: DomainsCurrenciesDrillMode;
  label: string;
  hint: string;
  icon: typeof Play;
  color: string;
}> = [
  { id: 'mixed', label: 'Mixed', hint: 'Domains and currencies together', icon: Play, color: META.color },
  { id: 'domains', label: 'Domains', hint: '.hr, .ch, .za … which country?', icon: AtSign, color: 'var(--sec-languages)' },
  { id: 'currencies', label: 'Currencies', hint: 'zł, Kč, ฿ … who uses it?', icon: Banknote, color: 'var(--good)' },
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
  const round = useRound();
  const [mode, setMode] = useState<DomainsCurrenciesDrillMode>('mixed');
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

  const startSession = (drillMode: DomainsCurrenciesDrillMode) => {
    setMode(drillMode);
    round.reset();
    showTrial(engine.startDomainsCurrenciesSession(drillMode, initialSkillId));
  };

  const exitToPicker = useCallback(() => {
    round.reset();
    setTrial(null);
    setFeedback(null);
    setBreakdown(null);
    setSelection([]);
  }, [round.reset]);

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

  const submitIds = useCallback(
    async (ids: string[]) => {
      if (!trial || feedback || submitting.current || ids.length === 0) return;
      const prompt = trial.domainsCurrenciesPrompt;
      submitting.current = true;
      setSaving(true);
      try {
        const result = await engine.submitDomainsCurrenciesAnswer(ids);
        setFeedback(result);
        round.record({
          correct: result.correct,
          fluent: result.correct && result.isFluentSpeed && !result.assisted,
          responseTimeMs: result.responseTimeMs,
          label: prompt?.marker ?? trial.sample.text,
          sublabel: prompt?.countries.map((c) => c.name).join(', '),
        });
      } finally {
        submitting.current = false;
        setSaving(false);
        setBreakdown(null);
      }
    },
    [engine, feedback, round.record, trial]
  );

  // Domains have exactly one answer, so a tap answers immediately;
  // currencies can match several countries, so taps toggle until "Check".
  const chooseOption = useCallback(
    (id: string) => {
      if (feedback || submitting.current) return;
      if (isDomain) {
        setSelection([id]);
        void submitIds([id]);
        return;
      }
      setSelection((selected) =>
        selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]
      );
    },
    [feedback, isDomain, submitIds]
  );

  const openBreakdown = useCallback(() => {
    if (!feedback && !submitting.current) setBreakdown(engine.requestGuidedBreakdown());
  }, [engine, feedback]);

  const dismissBreakdown = useCallback(() => {
    engine.dismissGuidedBreakdown();
    setBreakdown(null);
    heading.current?.focus({ preventScroll: true });
  }, [engine]);

  const handleContinue = useCallback(() => {
    if (round.isComplete) {
      round.finish();
      return;
    }
    showTrial(engine.nextTrial());
  }, [engine, round.finish, round.isComplete]);

  const handlePlayAgain = useCallback(() => {
    round.reset();
    showTrial(engine.nextTrial());
  }, [engine, round.reset]);

  useEffect(() => {
    if (!trial || round.showResults) return;
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target !== document.body && !target.closest('[data-sign-drill]')) return;
      if (target instanceof HTMLElement && target.closest('details')) return;
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat || submitting.current) return;
      const focusedButton = target instanceof HTMLButtonElement;
      const option = trial.options.find(({ shortcutKey }) => String(shortcutKey) === event.key);
      if (event.key === 'Escape') {
        event.preventDefault();
        if (breakdown) dismissBreakdown();
        else exitToPicker();
      } else if (!feedback && (event.key === '?' || (event.key === ' ' && !focusedButton))) {
        event.preventDefault();
        openBreakdown();
      } else if (!feedback && option) {
        event.preventDefault();
        chooseOption(option.id);
      } else if (event.key === 'Enter' && !focusedButton) {
        event.preventDefault();
        if (feedback) handleContinue();
        else void submitIds(selection);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [trial, feedback, breakdown, selection, round.showResults, dismissBreakdown, openBreakdown, exitToPicker, submitIds, chooseOption, handleContinue]);

  const prompt = trial?.domainsCurrenciesPrompt;
  if (!trial || !prompt) {
    return (
      <div className="space-y-8">
        <SectionPickerHeader
          sectionId="domains-currencies"
          title="Domains & Currencies"
          description="Read country-code domains on signs and spot currency marks on price tags. Shared currencies? Pick every matching country."
          onBack={onBackToDashboard}
        />
        {initialSkillId && (
          <p className="chip !text-[0.875rem]">
            Focus: {resolveSkillDisplayInfo(initialSkillId).label}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {DRILL_MODES.map(({ id, label, hint, icon: Icon, color }) => (
            <button
              type="button"
              key={id}
              onClick={() => startSession(id)}
              className="card flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 md:flex-col md:items-start"
            >
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: color }}>
                <Icon aria-hidden="true" className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[1.125rem] font-black">{label}</span>
                <span className="block text-[0.875rem] text-[var(--text-secondary)]">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (round.showResults) {
    return (
      <RoundResults
        sectionLabel="Domains & Currencies"
        summary={round.summary}
        onPlayAgain={handlePlayAgain}
        onBack={exitToPicker}
        backLabel="Change mode"
      />
    );
  }

  const markerStart = trial.sample.text.indexOf(prompt.marker);
  const reveal = (feedback || breakdown) && markerStart >= 0;
  const expected = feedback?.expectedCountryIds ?? [];
  const matches = new Set(prompt.countries.map(({ id }) => id));
  const modeLabel = DRILL_MODES.find((m) => m.id === mode)?.label ?? 'Mixed';

  const optionState = (id: string): AnswerTileState => {
    const selected = selection.includes(id);
    if (!feedback) return selected ? 'selected' : 'idle';
    if (expected.includes(id)) return 'correct';
    if (selected) return 'wrong';
    return 'dim';
  };

  return (
    <div data-sign-drill className="mx-auto max-w-3xl space-y-5">
      <RoundHeader
        title={`Domains & Currencies · ${modeLabel}`}
        subtitle={`${isDomain ? 'Country-code domain' : 'Currency sign'}${trial.isFollowUp ? ' · follow-up' : ''}`}
        answered={round.answered}
        roundLength={round.roundLength}
        streak={round.streak}
        elapsedMs={feedback?.responseTimeMs ?? elapsedMs}
        fluencyMs={trial.fluencyThresholdMs}
        onExit={exitToPicker}
        showingFeedback={Boolean(feedback)}
      />

      <section className="card space-y-5 p-5 sm:p-7" key={trial.trialNumber}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 ref={heading} tabIndex={-1} className="text-[1.375rem] font-black sm:text-[1.5rem]">
            {isDomain ? 'Which country is this domain from?' : 'Which countries use this currency?'}
          </h2>
          {feedback && <MasteryBadge state={feedback.newMastery} size="xs" />}
        </div>

        <p
          dir="auto"
          className="break-words rounded-2xl border-4 border-[var(--border-strong)] bg-[var(--surface-elevated)] p-6 text-center font-mono text-[1.75rem] font-bold sm:text-[2.25rem]"
        >
          {reveal ? (
            <>
              {trial.sample.text.slice(0, markerStart)}
              <mark className="rounded-md bg-[var(--brand-soft)] px-1 text-inherit underline decoration-[var(--brand-accent)] decoration-4 underline-offset-4">
                {prompt.marker}
              </mark>
              {trial.sample.text.slice(markerStart + prompt.marker.length)}
            </>
          ) : (
            trial.sample.text
          )}
        </p>

        {!feedback && !breakdown && (
          <div className="flex justify-center">
            <button type="button" onClick={openBreakdown} className="btn btn-ghost btn-sm !text-[var(--warn)]">
              <Lightbulb aria-hidden="true" className="h-4 w-4" />
              Show me what to look for
              <kbd className="hidden text-[0.6875rem] opacity-70 sm:inline">?</kbd>
            </button>
          </div>
        )}

        {breakdown && (
          <aside
            role="complementary"
            aria-label="Guided Breakdown"
            className="anim-rise space-y-2 rounded-2xl border-2 border-[var(--warn)] bg-[var(--warn-soft)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="flex items-center gap-1.5 font-black">
                <Lightbulb aria-hidden="true" className="h-4 w-4" /> Guided Breakdown
              </h3>
              <button type="button" onClick={dismissBreakdown} className="btn btn-ghost btn-sm">
                Close breakdown
              </button>
            </div>
            <p>{breakdown.gestaltNote}</p>
            <p>
              <strong>Matching choices:</strong>{' '}
              {trial.options.filter(({ id }) => matches.has(id)).map(({ label }) => label).join(', ')}
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[0.875rem]">
              {breakdown.distractorEliminations.map(({ optionId, reason }) => (
                <li key={optionId}>{reason}</li>
              ))}
            </ul>
          </aside>
        )}

        {!isDomain && !feedback && (
          <p className="text-center text-[0.875rem] font-bold text-[var(--text-secondary)]">
            Select every match, then check.
          </p>
        )}

        <div role="group" aria-label="Country choices" className="grid gap-3 sm:grid-cols-2">
          {trial.options.map(({ id, label, shortcutKey }) => {
            const state = optionState(id);
            const missed = feedback && state === 'correct' && !selection.includes(id);
            return (
              <AnswerTile
                key={id}
                label={label}
                sublabel={missed ? 'Missed' : undefined}
                shortcutKey={shortcutKey}
                state={state}
                ariaPressed={isDomain ? undefined : selection.includes(id)}
                disabled={Boolean(feedback) || saving}
                onClick={() => chooseOption(id)}
              />
            );
          })}
        </div>

        {!feedback && !isDomain && (
          <button
            type="button"
            disabled={selection.length === 0 || saving}
            onClick={() => void submitIds(selection)}
            className="btn btn-primary btn-lg w-full"
          >
            {saving ? 'Checking…' : 'Check answer'}
            <kbd className="hidden text-[0.75rem] opacity-80 sm:inline">Enter</kbd>
          </button>
        )}
      </section>

      {feedback && (
        <FeedbackBanner
          correct={feedback.correct}
          seed={trial.trialNumber}
          answer={
            <>
              <span className="font-mono">{prompt.marker}</span> →{' '}
              {prompt.countries.map(({ name }) => name).join(', ')}
            </>
          }
          detail={
            <>
              {formatSpeed(feedback.responseTimeMs, trial.fluencyThresholdMs, feedback.assisted, feedback.correct)}
              {isDomain && ` · ${prompt.countries[0].coverageTier} coverage`}
              {feedback.saveFailed && ' · progress could not be saved'}
            </>
          }
          continueLabel={round.isComplete ? 'See results' : 'Continue'}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}
