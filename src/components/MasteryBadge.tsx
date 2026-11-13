import type { MasteryState } from '../data/types.ts';

export const MASTERY_CONFIG: Record<
  MasteryState,
  { label: string; symbol: string; color: string }
> = {
  unseen: { label: 'Unseen', symbol: '○', color: 'var(--m-unseen)' },
  learning: { label: 'Learning', symbol: '◐', color: 'var(--m-learning)' },
  recognized: { label: 'Recognized', symbol: '◕', color: 'var(--m-recognized)' },
  mastered: { label: 'Mastered', symbol: '●', color: 'var(--m-mastered)' },
};

export function MasteryBadge({
  state,
  size = 'sm',
}: {
  state: MasteryState;
  size?: 'xs' | 'sm';
}) {
  const cfg = MASTERY_CONFIG[state];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-extrabold ${
        size === 'xs' ? 'px-2 py-0.5 text-[0.6875rem]' : 'px-2.5 py-0.5 text-[0.8125rem]'
      }`}
      style={{
        color: `color-mix(in srgb, ${cfg.color} 75%, var(--text-primary))`,
        backgroundColor: `color-mix(in srgb, ${cfg.color} 16%, transparent)`,
      }}
    >
      <span aria-hidden="true">{cfg.symbol}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

/** Stacked horizontal bar of Mastery States. */
export function MasteryBar({
  unseen,
  learning,
  recognized,
  mastered,
  total,
  className = '',
}: {
  unseen: number;
  learning: number;
  recognized: number;
  mastered: number;
  total: number;
  className?: string;
}) {
  const safeTotal = Math.max(1, total);
  const segments: Array<[MasteryState, number]> = [
    ['mastered', mastered],
    ['recognized', recognized],
    ['learning', learning],
    ['unseen', unseen],
  ];
  return (
    <div
      className={`flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-elevated)] ${className}`}
      role="img"
      aria-label={`${mastered} mastered, ${recognized} recognized, ${learning} learning, ${unseen} unseen`}
    >
      {segments.map(([state, count]) =>
        count > 0 && state !== 'unseen' ? (
          <div
            key={state}
            style={{
              width: `${(count / safeTotal) * 100}%`,
              backgroundColor: MASTERY_CONFIG[state].color,
            }}
          />
        ) : null
      )}
    </div>
  );
}

export function MasteryRing({
  unseen,
  learning,
  recognized,
  mastered,
  total,
  size = 64,
}: {
  unseen: number;
  learning: number;
  recognized: number;
  mastered: number;
  total: number;
  size?: number;
}) {
  const safeTotal = Math.max(1, total);
  const strokeWidth = Math.max(6, Math.round(size / 9));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { count: mastered, color: MASTERY_CONFIG.mastered.color },
    { count: recognized, color: MASTERY_CONFIG.recognized.color },
    { count: learning, color: MASTERY_CONFIG.learning.color },
    { count: unseen, color: 'var(--surface-elevated)' },
  ];

  let accumulatedFraction = 0;
  const activePercent = Math.round(((mastered + recognized) / safeTotal) * 100);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-elevated)" strokeWidth={strokeWidth} />
        {segments.map((seg, idx) => {
          if (seg.count <= 0) return null;
          const fraction = seg.count / safeTotal;
          const dashLength = fraction * circumference;
          const dashOffset = -accumulatedFraction * circumference;
          accumulatedFraction += fraction;
          return (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <span
        className="absolute font-black tracking-tight"
        style={{ fontSize: size >= 96 ? '1.375rem' : '0.75rem' }}
      >
        {activePercent}%
      </span>
    </div>
  );
}
