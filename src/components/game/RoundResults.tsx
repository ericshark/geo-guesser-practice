import { useEffect, useMemo, type CSSProperties } from 'react';
import { Flame, RotateCcw, Target, Timer, Trophy, Zap } from 'lucide-react';
import type { RoundSummary } from './useRound.ts';

interface RoundResultsProps {
  sectionLabel: string;
  summary: RoundSummary;
  onPlayAgain: () => void;
  onBack: () => void;
  backLabel: string;
}

function headlineFor(ratio: number): { title: string; emoji: string } {
  if (ratio === 1) return { title: 'Perfect round!', emoji: '🏆' };
  if (ratio >= 0.8) return { title: 'Excellent work!', emoji: '🌟' };
  if (ratio >= 0.6) return { title: 'Solid round!', emoji: '💪' };
  if (ratio >= 0.4) return { title: 'Getting there!', emoji: '🧭' };
  return { title: 'Every miss is a lesson', emoji: '📚' };
}

const CONFETTI_COLORS = ['var(--sec-languages)', 'var(--sec-driving)', 'var(--sec-coverage)', 'var(--sec-domains)', 'var(--xp)', 'var(--good)'];

export function RoundResults({
  sectionLabel,
  summary,
  onPlayAgain,
  onBack,
  backLabel,
}: RoundResultsProps) {
  const ratio = summary.total > 0 ? summary.correct / summary.total : 0;
  const { title, emoji } = headlineFor(ratio);
  const accuracy = Math.round(ratio * 100);

  // Results screen owns Enter/Escape; capture phase keeps section-level
  // shortcut handlers (registered on window, bubble phase) from also firing.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onPlayAgain();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onBack();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onBack, onPlayAgain]);

  const confetti = useMemo(
    () =>
      ratio >= 0.8
        ? Array.from({ length: 28 }, (_, i) => ({
            id: i,
            left: `${(i * 37) % 100}%`,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            dx: `${((i * 53) % 160) - 80}px`,
            dy: `${180 + ((i * 29) % 160)}px`,
            rot: `${(i * 97) % 720}deg`,
            delay: `${(i % 7) * 60}ms`,
          }))
        : [],
    [ratio]
  );

  const stats = [
    { icon: Target, label: 'Accuracy', value: `${accuracy}%`, color: 'var(--good)' },
    { icon: Flame, label: 'Best streak', value: String(summary.bestStreak), color: 'var(--xp)' },
    { icon: Zap, label: 'Lightning fast', value: `${summary.fluent}/${summary.total}`, color: 'var(--brand-accent)' },
    { icon: Timer, label: 'Avg time', value: `${(summary.averageMs / 1000).toFixed(1)}s`, color: 'var(--sec-coverage)' },
  ];

  return (
    <div className="relative mx-auto max-w-2xl">
      {confetti.length > 0 && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible">
          {confetti.map((c) => (
            <span
              key={c.id}
              className="confetti-piece absolute top-6 block h-2.5 w-1.5 rounded-sm opacity-0"
              style={
                {
                  left: c.left,
                  backgroundColor: c.color,
                  animationDelay: c.delay,
                  '--dx': c.dx,
                  '--dy': c.dy,
                  '--rot': c.rot,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      <section aria-labelledby="round-results-heading" className="card anim-rise space-y-6 p-6 text-center sm:p-10">
        <div className="space-y-2">
          <p className="text-[0.8125rem] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
            {sectionLabel} · Round complete
          </p>
          <div aria-hidden="true" className="anim-pop text-[3.5rem] leading-none">
            {emoji}
          </div>
          <h1 id="round-results-heading" tabIndex={-1} className="text-[2rem] font-black">
            {title}
          </h1>
          <p className="text-[1.25rem] font-extrabold">
            <Trophy aria-hidden="true" className="mr-1.5 inline h-5 w-5 align-[-3px] text-[var(--xp)]" />
            {summary.correct} / {summary.total} correct
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-2xl border-2 border-[var(--border-subtle)] p-3">
              <Icon aria-hidden="true" className="mx-auto h-5 w-5" style={{ color }} />
              <dd className="mt-1 text-[1.375rem] font-black tabular-nums">{value}</dd>
              <dt className="text-[0.75rem] font-bold text-[var(--text-secondary)]">{label}</dt>
            </div>
          ))}
        </dl>

        {summary.missed.length > 0 && (
          <div className="rounded-2xl bg-[var(--surface-elevated)] p-4 text-left">
            <h2 className="text-[0.9375rem] font-extrabold">Worth another look</h2>
            <ul className="mt-2 flex flex-wrap gap-2" role="list">
              {summary.missed.map((m) => (
                <li key={m.label} className="chip !bg-[var(--bad-soft)] !text-[var(--text-primary)] !text-[0.8125rem]">
                  {m.label}
                  {m.sublabel && <span className="font-semibold text-[var(--text-secondary)]">{m.sublabel}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[0.75rem] text-[var(--text-secondary)]">
              These will come back sooner in your next rounds.
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={onBack} className="btn btn-secondary btn-lg">
            {backLabel}
          </button>
          <button type="button" onClick={onPlayAgain} autoFocus className="btn btn-primary btn-lg">
            <RotateCcw aria-hidden="true" className="h-5 w-5" />
            Play another round
            <kbd className="hidden text-[0.75rem] opacity-80 sm:inline">Enter</kbd>
          </button>
        </div>
      </section>
    </div>
  );
}
