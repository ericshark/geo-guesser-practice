import type { BollardVisual, PlateVisual, PoleVisual, RoadVisual, SignVisual, Visual } from '../content/types.ts';

const COLOURS = { white: '#f5f5f2', yellow: '#e8b923', red: '#c0392b' };

/** Draws whichever schematic a stimulus carries. */
export function VisualSvg({ visual, label }: { visual: Visual; label: string }) {
  if (visual.kind === 'road') return <RoadSvg visual={visual} label={label} />;
  if (visual.kind === 'plate') return <PlateSvg visual={visual} label={label} />;
  if (visual.kind === 'sign') return <SignSvg visual={visual} label={label} />;
  if (visual.kind === 'pole') return <PoleSvg visual={visual} label={label} />;
  if (visual.kind === 'photo') {
    return (
      <img
        src={`/media/${visual.id}.jpg`}
        alt={label}
        loading="lazy"
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12, border: '1px solid var(--line)' }}
      />
    );
  }
  return <BollardSvg visual={visual} label={label} />;
}

/** A pole with its identifying detail exaggerated. Schematic, not to scale. */
export function PoleSvg({ visual, label }: { visual: PoleVisual; label: string }) {
  const s = visual.style;
  const x = 66;
  const w = 28;
  const top = 24;
  const base = 240;
  const concrete = '#b4b4ac';
  const wood = '#7a5a3a';
  const dark = '#333';
  const isWood = s === 'crucifix';

  return (
    <svg viewBox="0 0 160 260" role="img" aria-label={label} style={{ width: '100%', maxWidth: 200, height: 'auto', display: 'block', margin: '0 auto' }}>
      <defs>
        <clipPath id="pole-body">
          <rect x={x} y={top} width={w} height={base - top} />
        </clipPath>
      </defs>
      <rect x={0} y={base} width={160} height={20} fill="#8a8f7a" />

      {s === 'lattice' ? (
        <>
          <polygon points={`80,${top} 104,${base} 56,${base}`} fill="none" stroke={dark} strokeWidth={3} />
          {Array.from({ length: 7 }, (_, i) => {
            const y = top + 30 + i * 28;
            const half = 4 + ((y - top) / (base - top)) * 20;
            return <line key={i} x1={80 - half} y1={y} x2={80 + half} y2={y} stroke={dark} strokeWidth={2} />;
          })}
        </>
      ) : (
        <>
          <rect x={x} y={top} width={w} height={base - top} fill={isWood ? wood : concrete} stroke={dark} strokeWidth={2} />
          <g clipPath="url(#pole-body)">
            {s === 'holey-to-ground' &&
              Array.from({ length: 5 }, (_, i) => <rect key={i} x={x + 9} y={base - 24 - i * 34} width={10} height={24} rx={3} fill={dark} />)}
            {s === 'holey-above-ground' &&
              Array.from({ length: 4 }, (_, i) => <rect key={i} x={x + 9} y={base - 70 - i * 34} width={10} height={24} rx={3} fill={dark} />)}
            {s === 'yellow-black-stripes' &&
              Array.from({ length: 9 }, (_, i) => (
                <polygon key={i} points={`${x},${base - 30 - i * 22} ${x + w},${base - 52 - i * 22} ${x + w},${base - 36 - i * 22} ${x},${base - 14 - i * 22}`} fill={i % 2 === 0 ? '#f2c200' : '#161616'} />
              ))}
            {s === 'white-base' && <rect x={x} y={base - 80} width={w} height={80} fill="#fafafa" />}
            {s === 'red-white-stripes' &&
              Array.from({ length: 6 }, (_, i) => <rect key={i} x={x} y={base - 120 + i * 20} width={w} height={20} fill={i % 2 === 0 ? '#c8102e' : '#fafafa'} />)}
            {s === 'ladder' && (
              <>
                <rect x={x + 4} y={top + 60} width={w - 8} height={base - top - 70} fill={dark} opacity={0.55} />
                {Array.from({ length: 12 }, (_, i) => (
                  <rect key={i} x={x + 2} y={top + 70 + i * 14} width={w - 4} height={4} fill={concrete} />
                ))}
              </>
            )}
          </g>
        </>
      )}

      {/* Cross arm and wires. */}
      {s === 'crucifix' ? (
        <>
          <rect x={22} y={top + 22} width={116} height={9} fill={wood} stroke={dark} strokeWidth={2} />
          <rect x={46} y={top + 52} width={68} height={7} fill={wood} stroke={dark} strokeWidth={2} />
        </>
      ) : (
        <rect x={42} y={top + 6} width={76} height={6} fill={dark} />
      )}
    </svg>
  );
}

const SIGN_FILL ={ white: '#f7f7f4', yellow: '#f2c200', green: '#1f6b3a' };
const SIGN_ACCENT = { red: '#c8102e', black: '#161616', white: '#ffffff' };

/** Sign shape and colours only; pictograms and words are left out on purpose. */
export function SignSvg({ visual, label }: { visual: SignVisual; label: string }) {
  const fill = SIGN_FILL[visual.fill];
  const accent = SIGN_ACCENT[visual.accent];
  return (
    <svg viewBox="0 0 220 170" role="img" aria-label={label} style={{ width: '100%', maxWidth: 240, height: 'auto', display: 'block', margin: '0 auto' }}>
      <rect x={104} y={110} width={12} height={60} fill="#777" />
      {visual.shape === 'triangle' && (
        <polygon points="110,12 200,128 20,128" fill={fill} stroke={accent} strokeWidth={14} strokeLinejoin="round" />
      )}
      {visual.shape === 'diamond' && (
        <polygon points="110,6 204,62 110,118 16,62" fill={fill} stroke={accent} strokeWidth={5} strokeLinejoin="round" transform="translate(0 12)" />
      )}
      {visual.shape === 'square-with-triangle' && (
        <>
          <rect x={30} y={10} width={160} height={120} rx={6} fill={SIGN_FILL.white} stroke="#161616" strokeWidth={3} />
          <polygon points="110,28 168,114 52,114" fill="none" stroke={SIGN_ACCENT.red} strokeWidth={9} strokeLinejoin="round" />
        </>
      )}
      {visual.shape === 'rectangle' && (
        <>
          <rect x={14} y={22} width={192} height={100} rx={6} fill={fill} stroke="#161616" strokeWidth={3} />
          <rect x={36} y={44} width={120} height={10} rx={3} fill={accent} />
          <rect x={36} y={66} width={150} height={10} rx={3} fill={accent} />
          <rect x={36} y={88} width={90} height={10} rx={3} fill={accent} />
        </>
      )}
    </svg>
  );
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
