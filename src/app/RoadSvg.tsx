import type { RoadVisual } from '../content/types.ts';

const COLOURS = { white: '#f5f5f2', yellow: '#e8b923' };

/** Schematic top-down road: asphalt with centre and edge lines. Not to scale, not photographic. */
export function RoadSvg({ visual, label }: { visual: RoadVisual; label: string }) {
  const W = 320;
  const H = 150;
  const left = 40;
  const right = W - 40;
  const mid = W / 2;
  const edgeColour = visual.edge === 'yellow' ? COLOURS.yellow : COLOURS.white;

  const dashes = (x: number, colour: string, dash: string, width = 4) => (
    <line x1={x} y1={0} x2={x} y2={H} stroke={colour} strokeWidth={width} strokeDasharray={dash} />
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} style={{ width: '100%', maxWidth: 360, height: 'auto', display: 'block', margin: '0 auto', borderRadius: 8 }}>
      <rect width={W} height={H} fill="#7a7f83" />
      <rect x={0} width={left - 8} height={H} fill="#8a8f7a" />
      <rect x={right + 8} width={W - right - 8} height={H} fill="#8a8f7a" />
      <rect x={left - 8} width={right - left + 16} height={H} fill="#43474b" />

      {visual.edge === 'white' || visual.edge === 'yellow' ? (
        <>
          {dashes(left, edgeColour, '0')}
          {dashes(right, edgeColour, '0')}
        </>
      ) : null}
      {visual.edge === 'white-long-dash' && (
        <>
          {dashes(left, COLOURS.white, '38 12')}
          {dashes(right, COLOURS.white, '38 12')}
        </>
      )}

      {visual.centre === 'white-dashed' && dashes(mid, COLOURS.white, '16 14')}
      {visual.centre === 'yellow-dashed' && dashes(mid, COLOURS.yellow, '16 14')}
      {visual.centre === 'yellow-double' && (
        <>
          {dashes(mid - 4, COLOURS.yellow, '0', 3)}
          {dashes(mid + 4, COLOURS.yellow, '0', 3)}
        </>
      )}

      {visual.zigzag && (
        <>
          <polyline
            fill="none"
            stroke={COLOURS.white}
            strokeWidth={3}
            points={Array.from({ length: 11 }, (_, i) => `${i % 2 === 0 ? left + 14 : left + 4},${i * 15}`).join(' ')}
          />
          <polyline
            fill="none"
            stroke={COLOURS.white}
            strokeWidth={3}
            points={Array.from({ length: 11 }, (_, i) => `${i % 2 === 0 ? right - 14 : right - 4},${i * 15}`).join(' ')}
          />
        </>
      )}
    </svg>
  );
}
