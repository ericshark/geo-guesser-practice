import React from 'react';
import type { MasteryState } from '../data/types.ts';

const MASTERY_CONFIG: Record<
  MasteryState,
  {
    label: string;
    symbol: string;
    className: string;
    dotColor: string;
  }
> = {
  unseen: {
    label: 'Unseen',
    symbol: '○',
    className:
      'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    dotColor: '#71717a',
  },
  learning: {
    label: 'Learning',
    symbol: '◐',
    className:
      'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30',
    dotColor: '#f59e0b',
  },
  recognized: {
    label: 'Recognized',
    symbol: '◕',
    className:
      'bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/30',
    dotColor: '#0ea5e9',
  },
  mastered: {
    label: 'Mastered',
    symbol: '●',
    className:
      'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    dotColor: '#10b981',
  },
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
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${cfg.className} ${
        size === 'xs'
          ? 'px-2 py-0.5 text-[0.75rem]'
          : 'px-2.5 py-0.5 text-[0.8125rem]'
      }`}
    >
      <span aria-hidden="true">{cfg.symbol}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

export function MasteryRing({
  unseen,
  learning,
  recognized,
  mastered,
  total,
}: {
  unseen: number;
  learning: number;
  recognized: number;
  mastered: number;
  total: number;
}) {
  const safeTotal = Math.max(1, total);
  const size = 64;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { count: mastered, color: '#10b981' },
    { count: recognized, color: '#0ea5e9' },
    { count: learning, color: '#f59e0b' },
    { count: unseen, color: 'rgba(128,128,128,0.22)' },
  ];

  let accumulatedFraction = 0;
  const activePercent = Math.round(
    ((mastered + recognized) / safeTotal) * 100
  );

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="-rotate-90"
      >
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
      <span className="absolute text-[0.75rem] font-semibold tracking-tight">
        {activePercent}%
      </span>
    </div>
  );
}
