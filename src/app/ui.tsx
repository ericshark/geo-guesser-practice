import { ATLAS_CONTEXT_PATH, ATLAS_COUNTRY_PATHS } from '../data/atlasPaths.ts';
import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import { projectLatLonToSvg } from '../data/mapProjection.ts';
import type { MasteryCounts } from '../engine/mastery.ts';

/** Stacked bar of mastered / familiar / learning clues out of the total. */
export function MasteryBar({ counts, label }: { counts: MasteryCounts; label?: string }) {
  const pct = (n: number) => (counts.total === 0 ? 0 : (n / counts.total) * 100);
  const text =
    label ??
    `${counts.mastered} mastered, ${counts.familiar} familiar, ${counts.learning} learning, ${counts.new} not started`;
  return (
    <div
      className="progress"
      role="img"
      aria-label={text}
      title={text}
    >
      <span className="seg-mastered" style={{ width: `${pct(counts.mastered)}%` }} />
      <span className="seg-familiar" style={{ width: `${pct(counts.familiar)}%` }} />
      <span className="seg-learning" style={{ width: `${pct(counts.learning)}%` }} />
    </div>
  );
}

export function MasteryLegend() {
  return (
    <div className="legend" aria-hidden="true">
      <span><i className="dot dot-mastered" /> Mastered</span>
      <span><i className="dot dot-familiar" /> Familiar</span>
      <span><i className="dot dot-learning" /> Learning</span>
      <span><i className="dot" /> New</span>
    </div>
  );
}

export function CountryChips({ ids, limit = 8 }: { ids: string[]; limit?: number }) {
  const names = ids.map((id) => PLAYABLE_COUNTRY_MAP[id]?.name).filter(Boolean) as string[];
  if (names.length === 0) return null;
  const shown = names.slice(0, limit);
  return (
    <div className="country-chips">
      {shown.map((n) => (
        <span key={n} className="chip">{n}</span>
      ))}
      {names.length > limit && <span className="chip">+{names.length - limit} more</span>}
    </div>
  );
}

/** Small world map that frames and highlights the given countries. */
export function MiniMap({ countryIds }: { countryIds: string[] }) {
  const countries = countryIds.map((id) => PLAYABLE_COUNTRY_MAP[id]).filter(Boolean);
  if (countries.length === 0) return null;

  const points = countries.map((c) => projectLatLonToSvg(c.coordinates[0], c.coordinates[1]));
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Frame the targets with generous margin, keep a 2:1 aspect, and stay inside the 1000x500 map.
  const width = Math.min(1000, Math.max(160, (maxX - minX) * 1.5 + 90, ((maxY - minY) * 1.5 + 60) * 2));
  const height = width / 2;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const x = Math.max(0, Math.min(1000 - width, cx - width / 2));
  const y = Math.max(0, Math.min(500 - height, cy - height / 2));
  const dot = Math.max(2, width / 70);

  return (
    <svg
      className="minimap"
      viewBox={`${x} ${y} ${width} ${height}`}
      role="img"
      aria-label={`Map highlighting ${countries.map((c) => c.name).join(', ')}`}
    >
      <path className="land" d={ATLAS_CONTEXT_PATH} />
      {countries.map((c, i) =>
        ATLAS_COUNTRY_PATHS[c.id] ? (
          <path key={c.id} className="hit" d={ATLAS_COUNTRY_PATHS[c.id]} />
        ) : (
          <circle key={c.id} className="dotmark" cx={points[i][0]} cy={points[i][1]} r={dot} />
        )
      )}
      {/* Small countries are easy to miss at this scale, so mark every target with a dot too. */}
      {width > 300 &&
        countries.map((c, i) => (
          <circle key={`d-${c.id}`} className="dotmark" cx={points[i][0]} cy={points[i][1]} r={dot * 0.7} />
        ))}
    </svg>
  );
}

export function formatDue(due: Date, now: Date): string {
  const ms = due.getTime() - now.getTime();
  if (ms <= 60_000) return 'in a minute';
  const hours = ms / 3_600_000;
  if (hours < 1) return `in ${Math.round(ms / 60_000)} min`;
  if (hours < 24) return `in ${Math.round(hours)} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}
