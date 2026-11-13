import type { BollardVisual, PlateVisual, RoadVisual, Visual } from '../content/types.ts';

const COLOURS = { white: '#f5f5f2', yellow: '#e8b923', red: '#c0392b' };

/** Draws whichever schematic a stimulus carries. */
export function VisualSvg({ visual, label }: { visual: Visual; label: string }) {
  if (visual.kind === 'road') return <RoadSvg visual={visual} label={label} />;
  if (visual.kind === 'plate') return <PlateSvg visual={visual} label={label} />;
  return <BollardSvg visual={visual} label={label} />;
}

/** A single roadside post in front of a plain background. Marking details are exaggerated for clarity. */
export function BollardSvg({ visual, label }: { visual: BollardVisual; label: string }) {
  const x = 60;
  const w = 56;
  const top = 16;
  const h = 150;
  const bodyFill = visual.body === 'yellow' ? COLOURS.yellow : COLOURS.white;
  const m = visual.marking;
  return (
    <svg viewBox="0 0 176 190" role="img" aria-label={label} style={{ width: '100%', maxWidth: 200, height: 'auto', display: 'block', margin: '0 auto' }}>
      <defs>
        <clipPath id="post">
          <rect x={x} y={top} width={w} height={h} rx={8} />
        </clipPath>
      </defs>
      <rect x={0} y={166} width={176} height={24} fill="#8a8f7a" />
      <g clipPath="url(#post)">
        <rect x={x} y={top} width={w} height={h} fill={bodyFill} />
        {visual.body === 'red-white-bands' &&
          Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={x} y={top + i * 25} width={w} height={25} fill={i % 2 === 0 ? COLOURS.red : COLOURS.white} />
          ))}
        {m === 'red-diagonal-stripe' && (
          <polygon points={`${x},${top + 50} ${x + w},${top + 10} ${x + w},${top + 50} ${x},${top + 90}`} fill={COLOURS.red} />
        )}
        {m === 'black-cap-dark-reflector' && (
          <>
            <rect x={x} y={top} width={w} height={34} fill="#151515" />
            <rect x={x + 14} y={top + 46} width={28} height={18} fill="#3a1d1d" />
          </>
        )}
        {m === 'black-lower-orange-stripes' && (
          <>
            <rect x={x} y={top + 70} width={w} height={80} fill="#151515" />
            <rect x={x} y={top + 84} width={w} height={8} fill="#ff7a00" />
            <rect x={x} y={top + 106} width={w} height={8} fill="#ff7a00" />
          </>
        )}
        {m === 'red-rect-centre' && <rect x={x + 14} y={top + 22} width={28} height={30} fill={COLOURS.red} />}
        {m === 'red-rect-off-centre' && <rect x={x + 4} y={top + 22} width={28} height={30} fill={COLOURS.red} />}
        {m === 'red-rect-in-black-diagonal' && (
          <>
            <polygon points={`${x},${top} ${x + 34},${top} ${x + w},${top + 60} ${x + w},${top + 110} ${x + 22},${top + 110} ${x},${top + 50}`} fill="#151515" />
            <rect x={x + 18} y={top + 26} width={14} height={40} fill={COLOURS.red} />
          </>
        )}
      </g>
      <rect x={x} y={top} width={w} height={h} rx={8} fill="none" stroke="#222" strokeWidth={2} />
    </svg>
  );
}

/** Front and rear plate side by side. Colours and strip only; the lettering is deliberately blank. */
export function PlateSvg({ visual, label }: { visual: PlateVisual; label: string }) {
  const plate = (x: number, colour: PlateVisual['front'], caption: string) => (
    <g>
      <rect x={x} y={34} width={130} height={40} rx={5} fill={COLOURS[colour]} stroke="#222" strokeWidth={2} />
      {visual.strip === 'blue-left' && <rect x={x + 2} y={36} width={14} height={36} rx={3} fill="#1b4fa8" />}
      <rect x={x + 30} y={48} width={84} height={12} rx={2} fill={colour === 'red' ? '#f3d9d4' : '#222'} opacity={0.18} />
      <text x={x + 65} y={96} textAnchor="middle" fontSize={11} fill="currentColor">{caption}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 320 110" role="img" aria-label={label} style={{ width: '100%', maxWidth: 360, height: 'auto', display: 'block', margin: '0 auto' }}>
      {plate(16, visual.front, 'Front')}
      {plate(174, visual.rear, 'Rear')}
    </svg>
  );
}

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
