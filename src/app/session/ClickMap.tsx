import { useMemo, useState } from 'react';
import { ATLAS_CONTEXT_PATH, ATLAS_COUNTRY_PATHS } from '../../data/atlasPaths.ts';
import { PLAYABLE_COUNTRY_MAP } from '../../data/index.ts';
import { projectLatLonToSvg } from '../../data/mapProjection.ts';
import { serializeSelection, type MapQuestion } from '../../engine/questionGen.ts';

type CellState = 'idle' | 'picked' | 'right' | 'wrong' | 'missed';

/**
 * Map-click question: the learner toggles every country the clue applies to, then checks.
 * Countries can be toggled on the map or from the list below it, which also covers territories
 * too small to hit and keyboard or screen-reader use.
 */
export function ClickMap({
  question,
  selected,
  onAnswer,
}: {
  question: MapQuestion;
  /** The serialized answer once the question is answered, otherwise null. */
  selected: string | null;
  onAnswer: (serialized: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const answered = selected !== null;
  const finalPicks = useMemo(() => (answered ? selected.split(',').filter(Boolean) : picked), [answered, selected, picked]);

  const countries = useMemo(
    () =>
      question.candidateIds
        .map((id) => PLAYABLE_COUNTRY_MAP[id])
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [question.candidateIds]
  );

  const frame = useMemo(() => {
    const points = countries.map((c) => projectLatLonToSvg(c.coordinates[0], c.coordinates[1]));
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    // Frame every clickable country with margin, keep a 2:1 aspect and stay inside the 1000x500 map.
    const width = Math.min(1000, Math.max(220, (maxX - minX) * 1.25 + 120, ((maxY - minY) * 1.25 + 70) * 2));
    const height = width / 2;
    const x = Math.max(0, Math.min(1000 - width, (minX + maxX) / 2 - width / 2));
    const y = Math.max(0, Math.min(500 - height, (minY + maxY) / 2 - height / 2));
    return { x, y, width, height, points };
  }, [countries]);

  const stateOf = (id: string): CellState => {
    const isTarget = question.targetIds.includes(id);
    const isPicked = finalPicks.includes(id);
    if (!answered) return isPicked ? 'picked' : 'idle';
    if (isTarget && isPicked) return 'right';
    if (isTarget) return 'missed';
    return isPicked ? 'wrong' : 'idle';
  };

  const toggle = (id: string) => {
    if (answered) return;
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const dot = Math.max(2.5, frame.width / 60);

  return (
    <div className="clickmap stack-sm">
      <svg
        className="minimap clickmap-svg"
        viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
        role="group"
        aria-label="Map of countries. Select every country that applies, or use the list below."
      >
        <path className="land" d={ATLAS_CONTEXT_PATH} />
        {countries.map((c, i) => {
          const state = stateOf(c.id);
          const shared = {
            className: 'cm-country',
            'data-state': state,
            role: 'button' as const,
            tabIndex: answered ? -1 : 0,
            'aria-label': c.name,
            'aria-pressed': finalPicks.includes(c.id),
            onClick: () => toggle(c.id),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                toggle(c.id);
              }
            },
          };
          const path = ATLAS_COUNTRY_PATHS[c.id];
          return path ? (
            <path key={c.id} d={path} {...shared}>
              <title>{c.name}</title>
            </path>
          ) : (
            <circle key={c.id} cx={frame.points[i][0]} cy={frame.points[i][1]} r={dot} {...shared}>
              <title>{c.name}</title>
            </circle>
          );
        })}
        {/* Territories are often a sliver at this scale, so every country also gets a clickable dot. */}
        {countries.map((c, i) => (
          <circle
            key={`dot-${c.id}`}
            className="cm-dot"
            data-state={stateOf(c.id)}
            cx={frame.points[i][0]}
            cy={frame.points[i][1]}
            r={dot * 0.8}
            onClick={() => toggle(c.id)}
          />
        ))}
      </svg>

      <div className="country-chips" role="group" aria-label="Countries">
        {countries.map((c) => (
          <button
            key={c.id}
            type="button"
            className="chip cm-chip"
            data-state={stateOf(c.id)}
            aria-pressed={finalPicks.includes(c.id)}
            disabled={answered}
            onClick={() => toggle(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {!answered && (
        <div className="row wrap">
          <button
            type="button"
            className="btn btn-primary"
            disabled={picked.length === 0}
            onClick={() => onAnswer(serializeSelection(picked))}
          >
            Check answer
          </button>
          <button type="button" className="btn btn-ghost" disabled={picked.length === 0} onClick={() => setPicked([])}>
            Clear
          </button>
          <span className="muted small">{picked.length} selected</span>
        </div>
      )}
    </div>
  );
}
