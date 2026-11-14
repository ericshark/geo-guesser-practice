import type { KmPostVisual, PedSignalVisual, StreetSignVisual, TrafficLightVisual } from '../content/types.ts';

/** Schematic roadside signage: street name plates, kilometre markers and traffic signals. */

const SIGN = { blue: '#1d5bb5', white: '#f5f5f2', green: '#1f7a3d', black: '#1c1c1e', red: '#c0392b', yellow: '#e8b923', orange: '#e07b1a' };
const svgStyle = { width: '100%', maxWidth: 360, height: 'auto', display: 'block', margin: '0 auto', borderRadius: 8 } as const;

function Backdrop({ children, label, height = 150 }: { children: React.ReactNode; label: string; height?: number }) {
  return (
    <svg viewBox={`0 0 320 ${height}`} role="img" aria-label={label} style={svgStyle}>
      <rect width={320} height={height} fill="#cfd5d9" />
      <rect y={height - 24} width={320} height={24} fill="#8a8f7a" />
      {children}
    </svg>
  );
}

/** A street name plate with placeholder lettering (the lettering is not the clue). */
export function StreetSignSvg({ visual, label }: { visual: StreetSignVisual; label: string }) {
  const fill = SIGN[visual.bg];
  const ink = visual.bg === 'white' ? SIGN.black : SIGN.white;
  const x = 60;
  const y = 28;
  const w = 200;
  const h = 70;
  const border = visual.border === 'none' ? null : SIGN[visual.border];
  return (
    <Backdrop label={label}>
      {visual.posts && (
        <>
          <rect x={x + 22} y={y + h} width={7} height={26} fill="#555" />
          <rect x={x + w - 29} y={y + h} width={7} height={26} fill="#555" />
        </>
      )}
      {visual.shape === 'arrow' ? (
        <>
          <rect x={x + w / 2 - 3} y={0} width={6} height={y + 4} fill="#555" />
          <polygon points={`${x},${y} ${x + w - 26},${y} ${x + w},${y + h / 2} ${x + w - 26},${y + h} ${x},${y + h}`} fill={fill} stroke="#222" strokeWidth={2} />
          {border && <polygon points={`${x + 5},${y + 5} ${x + w - 30},${y + 5} ${x + w - 8},${y + h / 2} ${x + w - 30},${y + h - 5} ${x + 5},${y + h - 5}`} fill="none" stroke={border} strokeWidth={2} />}
        </>
      ) : (
        <>
          <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} stroke="#222" strokeWidth={2} />
          {border && <rect x={x + 5} y={y + 5} width={w - 10} height={h - 10} rx={2} fill="none" stroke={border} strokeWidth={2} />}
        </>
      )}
      {visual.band && (
        <rect
          x={x + 5}
          y={y + h - 22}
          width={visual.shape === 'arrow' ? w - 34 : w - 10}
          height={17}
          fill={SIGN[visual.band]}
        />
      )}
      <rect x={x + 22} y={y + 18} width={w - 70} height={11} rx={2} fill={ink} opacity={0.85} />
      <rect x={x + 22} y={y + 35} width={w - 110} height={7} rx={2} fill={ink} opacity={0.5} />
    </Backdrop>
  );
}

/** A kilometre post or plate. */
export function KmPostSvg({ visual, label }: { visual: KmPostVisual; label: string }) {
  const body = SIGN[visual.body];
  const ink = visual.body === 'white' ? SIGN.black : SIGN.white;
  const border = visual.border ? SIGN[visual.border] : null;
  const cx = 160;
  return (
    <Backdrop label={label}>
      {visual.shape === 'post' ? (
        <g>
          <rect x={cx - 26} y={36} width={52} height={90} fill={body} stroke="#222" strokeWidth={2} />
          {visual.cap && <path d={`M ${cx - 26} 36 A 26 26 0 0 1 ${cx + 26} 36 Z`} fill={SIGN[visual.cap]} stroke="#222" strokeWidth={2} />}
          <rect x={cx - 14} y={58} width={28} height={9} rx={2} fill={ink} opacity={0.8} />
          <rect x={cx - 18} y={76} width={36} height={16} rx={2} fill={ink} opacity={0.75} />
        </g>
      ) : (
        <g>
          <rect x={cx - 3} y={90} width={6} height={36} fill="#555" />
          <rect x={cx - 42} y={26} width={84} height={72} rx={3} fill={body} stroke="#222" strokeWidth={2} />
          {border && <rect x={cx - 38} y={30} width={76} height={64} rx={2} fill="none" stroke={border} strokeWidth={5} />}
          {visual.topBand && <rect x={cx - 38} y={30} width={76} height={18} fill={SIGN[visual.topBand]} />}
          {visual.roman && <rect x={cx - 12} y={38} width={24} height={7} rx={1} fill={ink} opacity={0.6} />}
          <rect x={cx - 20} y={visual.roman ? 54 : 56} width={40} height={20} rx={2} fill={ink} opacity={0.75} />
        </g>
      )}
    </Backdrop>
  );
}

/** A vehicle signal head, seen from the front. */
export function TrafficLightSvg({ visual, label }: { visual: TrafficLightVisual; label: string }) {
  const horizontal = visual.orientation === 'horizontal';
  const housing = visual.housing === 'yellow' ? SIGN.yellow : '#222';
  const lamps = [
    { colour: SIGN.red, lit: true, shape: 'square' as const },
    { colour: SIGN.yellow, lit: false, shape: 'diamond' as const },
    { colour: visual.blueGreen ? '#17a38f' : '#2e9e4f', lit: false, shape: 'circle' as const },
  ];
  const w = horizontal ? 150 : 50;
  const h = horizontal ? 50 : 118;
  const x = 160 - w / 2;
  const y = visual.countdown ? 40 : 22;
  const pitch = 38;
  const lamp = (i: number) => {
    const l = lamps[i];
    const cx = horizontal ? x + 25 + i * pitch * 1.3 : x + w / 2;
    const cy = horizontal ? y + h / 2 : y + 22 + i * pitch;
    const fillOpacity = l.lit ? 1 : 0.35;
    if (visual.shapedLamps && l.shape === 'square') return <rect key={i} x={cx - 13} y={cy - 13} width={26} height={26} fill={l.colour} opacity={fillOpacity} />;
    if (visual.shapedLamps && l.shape === 'diamond') return <polygon key={i} points={`${cx},${cy - 15} ${cx + 15},${cy} ${cx},${cy + 15} ${cx - 15},${cy}`} fill={l.colour} opacity={fillOpacity} />;
    return <circle key={i} cx={cx} cy={cy} r={13} fill={l.colour} opacity={fillOpacity} />;
  };
  // Horizontal heads read red on the left in right-hand traffic countries; keep the order fixed so the picture is stable.
  return (
    <svg viewBox="0 0 320 170" role="img" aria-label={label} style={svgStyle}>
      <rect width={320} height={170} fill="#cfd5d9" />
      {visual.mount === 'arm' && (
        <>
          <rect x={0} y={y - 12} width={x + w / 2 + 4} height={6} fill="#555" />
          <rect x={x + w / 2 - 3} y={y - 12} width={6} height={12} fill="#555" />
        </>
      )}
      {visual.mount === 'wires' && (
        <>
          <line x1={0} y1={0} x2={x + w / 2} y2={y} stroke="#555" strokeWidth={2} />
          <line x1={320} y1={0} x2={x + w / 2} y2={y} stroke="#555" strokeWidth={2} />
        </>
      )}
      {visual.mount === 'pole' && <rect x={x + w / 2 - 3} y={y + h} width={6} height={170 - y - h} fill="#555" />}
      {visual.countdown && (
        <g>
          <rect x={160 - 22} y={10} width={44} height={26} rx={3} fill="#111" />
          <text x={160} y={29} textAnchor="middle" fontSize={16} fontFamily="monospace" fill={SIGN.red}>23</text>
        </g>
      )}
      {visual.outline && <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} rx={8} fill="none" stroke={SIGN.white} strokeWidth={4} />}
      <rect x={x} y={y} width={w} height={h} rx={7} fill={housing} stroke="#111" strokeWidth={2} />
      {[0, 1, 2].map(lamp)}
    </svg>
  );
}

/** A pedestrian signal head: a green or white walking figure over a red or orange stopping one. */
export function PedSignalSvg({ visual, label }: { visual: PedSignalVisual; label: string }) {
  const walkColour = visual.style === 'white-man-orange-hand' ? SIGN.white : '#2e9e4f';
  const stopColour = visual.style === 'white-man-orange-hand' ? SIGN.orange : SIGN.red;
  const lamp = (cy: number, children: React.ReactNode) => (
    <g>
      <rect x={118} y={cy - 38} width={84} height={76} rx={8} fill="#111" />
      {children}
    </g>
  );
  const walker = (cy: number, colour: string, hat: boolean) => (
    <g stroke={colour} strokeWidth={5} strokeLinecap="round" fill={colour}>
      <circle cx={160} cy={cy - 20} r={6} stroke="none" />
      {hat && <ellipse cx={160} cy={cy - 26} rx={13} ry={3} stroke="none" />}
      <line x1={160} y1={cy - 12} x2={158} y2={cy + 6} />
      <line x1={158} y1={cy - 6} x2={146} y2={cy + 2} />
      <line x1={158} y1={cy - 6} x2={172} y2={cy - 2} />
      <line x1={158} y1={cy + 6} x2={148} y2={cy + 24} />
      <line x1={158} y1={cy + 6} x2={170} y2={cy + 22} />
    </g>
  );
  const stander = (cy: number, colour: string, hat: boolean) => (
    <g stroke={colour} strokeWidth={5} strokeLinecap="round" fill={colour}>
      <circle cx={160} cy={cy - 20} r={6} stroke="none" />
      {hat && <ellipse cx={160} cy={cy - 26} rx={13} ry={3} stroke="none" />}
      <line x1={160} y1={cy - 12} x2={160} y2={cy + 8} />
      <line x1={146} y1={cy - 4} x2={174} y2={cy - 4} />
      <line x1={160} y1={cy + 8} x2={152} y2={cy + 26} />
      <line x1={160} y1={cy + 8} x2={168} y2={cy + 26} />
    </g>
  );
  const hand = (cy: number, colour: string) => (
    <g fill={colour} stroke="none">
      <rect x={146} y={cy - 6} width={28} height={26} rx={6} />
      <rect x={146} y={cy - 22} width={5} height={20} rx={2.5} />
      <rect x={153} y={cy - 28} width={5} height={24} rx={2.5} />
      <rect x={160} y={cy - 28} width={5} height={24} rx={2.5} />
      <rect x={167} y={cy - 24} width={5} height={20} rx={2.5} />
    </g>
  );
  const hat = visual.style === 'hat-man';
  return (
    <svg viewBox="0 0 320 220" role="img" aria-label={label} style={svgStyle}>
      <rect width={320} height={220} fill="#cfd5d9" />
      {lamp(56, visual.style === 'white-man-orange-hand' ? walker(56, walkColour, false) : walker(56, walkColour, hat))}
      {lamp(150, visual.style === 'white-man-orange-hand' ? hand(150, stopColour) : stander(150, stopColour, hat))}
    </svg>
  );
}
