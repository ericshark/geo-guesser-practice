import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';

export type AnswerTileState = 'idle' | 'correct' | 'wrong' | 'dim' | 'selected';

interface AnswerTileProps {
  label: ReactNode;
  sublabel?: ReactNode;
  shortcutKey?: string | number;
  state?: AnswerTileState;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  ariaPressed?: boolean;
}

/** Big tappable multiple-choice tile with a keyboard shortcut badge. */
export function AnswerTile({
  label,
  sublabel,
  shortcutKey,
  state = 'idle',
  disabled,
  onClick,
  className = '',
  ariaPressed,
}: AnswerTileProps) {
  return (
    <button
      type="button"
      data-state={state}
      disabled={disabled}
      aria-pressed={ariaPressed}
      onClick={onClick}
      className={`answer-tile ${className}`}
    >
      {shortcutKey !== undefined && (
        <kbd className="key-badge" aria-hidden="true">
          {shortcutKey}
        </kbd>
      )}
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {sublabel && (
          <span className="block truncate text-[0.8125rem] font-semibold text-[var(--text-secondary)]">
            {sublabel}
          </span>
        )}
      </span>
      {state === 'correct' && (
        <Check aria-label="Correct answer" className="h-6 w-6 shrink-0 text-[var(--good)]" strokeWidth={3} />
      )}
      {state === 'wrong' && (
        <X aria-label="Your answer" className="h-6 w-6 shrink-0 text-[var(--bad)]" strokeWidth={3} />
      )}
    </button>
  );
}

/** Derives a tile state from the answer feedback for a single option. */
export function getAnswerTileState(
  optionId: string,
  feedback: { correctId: string; chosenId?: string | null } | null
): AnswerTileState {
  if (!feedback) return 'idle';
  if (optionId === feedback.correctId) return 'correct';
  if (optionId === feedback.chosenId) return 'wrong';
  return 'dim';
}
