import type { ReactNode } from 'react';
import { Flame, X } from 'lucide-react';

interface RoundHeaderProps {
  title: string;
  subtitle?: string;
  answered: number;
  roundLength: number;
  streak: number;
  elapsedMs: number;
  fluencyMs: number;
  onExit: () => void;
  exitLabel?: string;
  /** Extra controls rendered on the right (e.g. "Study card"). */
  actions?: ReactNode;
  showingFeedback?: boolean;
}

/**
 * Top bar of a round: exit, progress through the round, streak flame, and
 * a small timer ring that fills toward the fluency target (never punishing).
 */
export function RoundHeader({
  title,
  subtitle,
  answered,
  roundLength,
  streak,
  elapsedMs,
  fluencyMs,
  onExit,
  exitLabel = 'Exit round (Esc)',
  actions,
  showingFeedback = false,
}: RoundHeaderProps) {
  const progress = Math.min(1, answered / roundLength);
  // While feedback is showing, the current question is already counted as answered.
  const questionNumber = Math.min(roundLength, showingFeedback ? answered : answered + 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onExit}
          aria-label={exitLabel}
          title={exitLabel}
          className="btn btn-ghost btn-sm !px-2"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>

        <div
          role="progressbar"
          aria-label={`Question ${questionNumber} of ${roundLength}`}
          aria-valuemin={0}
          aria-valuemax={roundLength}
          aria-valuenow={answered}
          className="progress-track flex-1"
        >
          <div
            className="progress-fill"
            style={{ width: `${Math.max(4, progress * 100)}%` }}
          />
        </div>

        <span
          className={`inline-flex items-center gap-1 text-[1rem] font-extrabold tabular-nums ${
            streak > 0 ? 'text-[var(--xp)]' : 'text-[var(--text-secondary)] opacity-60'
          }`}
          title="Correct answers in a row"
        >
          <Flame
            aria-hidden="true"
            className={`h-5 w-5 ${streak >= 3 ? 'anim-bounce' : ''}`}
            key={streak}
            fill={streak > 0 ? 'currentColor' : 'none'}
          />
          <span className="visually-hidden">Streak</span>
          {streak}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.75rem] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">
            Question {questionNumber} / {roundLength}
          </p>
          <h1 className="truncate text-[1.125rem] font-extrabold">{title}</h1>
          {subtitle && (
            <p className="text-[0.8125rem] text-[var(--text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <TimerRing elapsedMs={elapsedMs} fluencyMs={fluencyMs} />
        </div>
      </div>
    </div>
  );
}

function TimerRing({ elapsedMs, fluencyMs }: { elapsedMs: number; fluencyMs: number }) {
  const size = 44;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(1, elapsedMs / fluencyMs);
  const fast = elapsedMs <= fluencyMs;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="timer"
      aria-label={`${(elapsedMs / 1000).toFixed(1)} seconds; target ${fluencyMs / 1000} seconds`}
      title={`Answer within ${fluencyMs / 1000}s for a fluent answer`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-elevated)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={fast ? 'var(--brand-accent)' : 'var(--warn)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${ratio * circumference} ${circumference}`}
        />
      </svg>
      <span className="absolute text-[0.6875rem] font-extrabold tabular-nums">
        {(elapsedMs / 1000).toFixed(1)}
      </span>
    </div>
  );
}
