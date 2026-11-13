import type { ReactNode } from 'react';
import { CircleCheck, CircleX } from 'lucide-react';

const PRAISE = ['Nice!', 'Great eye!', 'Spot on!', 'Nailed it!', 'Correct!'];

interface FeedbackBannerProps {
  correct: boolean;
  /** Main line, e.g. "It's Polish (polski)". */
  answer: ReactNode;
  /** Small line under the answer: time, fluency, etc. */
  detail?: ReactNode;
  badges?: ReactNode;
  continueLabel?: string;
  onContinue: () => void;
  /** Seed for picking a stable praise word for this question. */
  seed?: number;
}

/**
 * Bottom sheet shown after answering: green for correct, red for wrong,
 * with one big Continue button (Enter).
 */
export function FeedbackBanner({
  correct,
  answer,
  detail,
  badges,
  continueLabel = 'Continue',
  onContinue,
  seed = 0,
}: FeedbackBannerProps) {
  const headline = correct ? PRAISE[Math.abs(seed) % PRAISE.length] : 'Not quite';
  const Icon = correct ? CircleCheck : CircleX;

  return (
    <section
      aria-label="Answer feedback"
      aria-live="polite"
      data-tone={correct ? 'good' : 'bad'}
      className="feedback-sheet anim-rise -mx-4 px-4 py-4 sm:mx-0 sm:rounded-b-[1.25rem] sm:px-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Icon
            aria-hidden="true"
            className={`anim-pop mt-0.5 h-9 w-9 shrink-0 ${correct ? 'text-[var(--good)]' : 'text-[var(--bad)]'}`}
            strokeWidth={2.5}
          />
          <div className="min-w-0">
            <p
              className={`text-[1.25rem] font-black ${correct ? 'text-[var(--good)]' : 'text-[var(--bad)]'}`}
            >
              {headline}
            </p>
            <p className="text-[1rem] font-bold">{answer}</p>
            {detail && (
              <p className="text-[0.8125rem] text-[var(--text-secondary)]">{detail}</p>
            )}
            {badges && <div className="mt-1.5 flex flex-wrap gap-1.5">{badges}</div>}
          </div>
        </div>
        <button
          type="button"
          onClick={onContinue}
          autoFocus
          className={`btn btn-lg w-full shrink-0 sm:w-auto ${correct ? 'btn-good' : 'btn-bad'}`}
        >
          {continueLabel}
          <kbd className="hidden text-[0.75rem] opacity-80 sm:inline">Enter</kbd>
        </button>
      </div>
    </section>
  );
}

/** Formats a response time with a short fluency note. */
export function formatSpeed(
  responseTimeMs: number,
  fluencyTargetMs: number,
  assisted = false,
  correct = true
): string {
  const seconds = `${(responseTimeMs / 1000).toFixed(1)}s`;
  if (assisted) return `${seconds} · used a hint`;
  if (!correct) return seconds;
  return responseTimeMs <= fluencyTargetMs
    ? `${seconds} · lightning fast ⚡`
    : `${seconds} · aim for under ${fluencyTargetMs / 1000}s`;
}
