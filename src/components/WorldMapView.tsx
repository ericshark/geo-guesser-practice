import React, { useId, useMemo, useState } from 'react';
import {
  COUNTRY_MAP_GEOMETRIES,
  MAP_REGION_PRESETS,
  MAP_REGION_PRESET_MAP,
  PLAYABLE_COUNTRIES,
  PLAYABLE_COUNTRY_MAP,
  type CountryMapGeometry,
  type MapRegionPresetId,
  type PlayableCountry,
} from '../data/index.ts';
import { ATLAS_CONTEXT_PATH } from '../data/atlasPaths.ts';
import type { MapSelectionEvaluation } from '../engine/practiceEngine.ts';

export interface WorldMapViewProps {
  selectedCountryIds: string[];
  onToggleCountry: (countryId: string) => void;
  evaluation?: MapSelectionEvaluation | null;
  highlightedCoverageCountryIds?: string[];
  showAllCoverageTiers?: boolean;
  highlightedDrivingCountryIds?: string[];
  showAllDrivingSides?: boolean;
  initialRegionPreset?: MapRegionPresetId;
  activeRegionPreset?: MapRegionPresetId;
  onRegionPresetChange?: (presetId: MapRegionPresetId) => void;
  readOnly?: boolean;
  ariaLabel?: string;
}

type CountryVisualStatus =
  | 'default'
  | 'selected'
  | 'correct'
  | 'missed'
  | 'incorrect'
  | 'tier-official'
  | 'tier-limited'
  | 'tier-none'
  | 'driving-left'
  | 'driving-right';

// The Oceania preset extends east past the date line to include American Samoa.
function atlasWrapOffset(x: number, preset: MapRegionPresetId): number {
  return preset === 'oceania' && x < 60 ? 1000 : 0;
}

interface EnrichedCountryGeometry extends CountryMapGeometry {
  country: PlayableCountry;
}

export const WorldMapView: React.FC<WorldMapViewProps> = ({
  selectedCountryIds,
  onToggleCountry,
  evaluation = null,
  highlightedCoverageCountryIds = [],
  showAllCoverageTiers = false,
  highlightedDrivingCountryIds = [],
  showAllDrivingSides = false,
  initialRegionPreset = 'world',
  activeRegionPreset: controlledPreset,
  onRegionPresetChange,
  readOnly = false,
  ariaLabel = 'Interactive world map of Playable Countries',
}) => {
  const contextPathId = useId();
  const [internalPreset, setInternalPreset] = useState<MapRegionPresetId>(initialRegionPreset);
  const [hoveredCountryId, setHoveredCountryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activePresetId = controlledPreset ?? internalPreset;
  const activePreset = MAP_REGION_PRESET_MAP[activePresetId] ?? MAP_REGION_PRESET_MAP.world;

  const viewBoxNumbers = useMemo<[number, number, number, number]>(() => {
    const [x, y, width, height] = activePreset.viewBox.split(' ').map(Number);
    return [x, y, width, height];
  }, [activePreset.viewBox]);

  const handlePresetChange = (presetId: MapRegionPresetId) => {
    if (!controlledPreset) {
      setInternalPreset(presetId);
    }
    onRegionPresetChange?.(presetId);
  };

  const selectedSet = useMemo(() => new Set(selectedCountryIds), [selectedCountryIds]);
  const highlightedCoverageSet = useMemo(
    () => new Set(highlightedCoverageCountryIds),
    [highlightedCoverageCountryIds]
  );
  const highlightedDrivingSet = useMemo(
    () => new Set(highlightedDrivingCountryIds),
    [highlightedDrivingCountryIds]
  );
  const correctSet = useMemo(
    () => new Set(evaluation?.correctCountryIds ?? []),
    [evaluation]
  );
  const missedSet = useMemo(
    () => new Set(evaluation?.missedCountryIds ?? []),
    [evaluation]
  );
  const incorrectSet = useMemo(
    () => new Set(evaluation?.incorrectCountryIds ?? []),
    [evaluation]
  );

  const getCountryStatus = (countryId: string): CountryVisualStatus => {
    if (evaluation) {
      if (correctSet.has(countryId)) return 'correct';
      if (missedSet.has(countryId)) return 'missed';
      if (incorrectSet.has(countryId)) return 'incorrect';
      return 'default';
    }
    if (showAllCoverageTiers || highlightedCoverageSet.has(countryId)) {
      const tier = PLAYABLE_COUNTRY_MAP[countryId]?.coverageTier;
      if (tier === 'official') return 'tier-official';
      if (tier === 'limited') return 'tier-limited';
      if (tier === 'none') return 'tier-none';
    }
    if (showAllDrivingSides || highlightedDrivingSet.has(countryId)) {
      const side = PLAYABLE_COUNTRY_MAP[countryId]?.drivingSide;
      if (side === 'left') return 'driving-left';
      if (side === 'right') return 'driving-right';
    }
    return selectedSet.has(countryId) ? 'selected' : 'default';
  };

  const getStatusBadgeText = (status: CountryVisualStatus): string | null => {
    switch (status) {
      case 'correct':
        return '✓ Correct';
      case 'missed':
        return '! Missed';
      case 'incorrect':
        return '✗ Incorrect';
      case 'selected':
        return '● Selected';
      case 'tier-official':
        return '● Official Coverage';
      case 'tier-limited':
        return '◐ Limited Coverage';
      case 'tier-none':
        return '○ None (No Coverage)';
      case 'driving-left':
        return 'L Left-Hand Traffic';
      case 'driving-right':
        return 'R Right-Hand Traffic';
      default:
        return null;
    }
  };

  const getStatusIcon = (status: CountryVisualStatus): string => {
    switch (status) {
      case 'correct':
      case 'tier-official':
        return '✓';
      case 'missed':
      case 'tier-limited':
        return '◐';
      case 'incorrect':
      case 'tier-none':
        return '✗';
      case 'driving-left':
        return 'L';
      case 'driving-right':
        return 'R';
      case 'selected':
        return '●';
      default:
        return '';
    }
  };

  const allGeometries = useMemo<EnrichedCountryGeometry[]>(() => {
    return PLAYABLE_COUNTRIES.map((country) => {
      const geom = COUNTRY_MAP_GEOMETRIES[country.id];
      return {
        ...geom,
        country,
      };
    });
  }, []);

  const territoryGeometries = useMemo(
    () => allGeometries.filter((g) => g.country.isTerritory || !g.svgPath),
    [allGeometries]
  );

  // Filter territories to those inside (or relevant to) the active regional zoom preset
  const visibleTerritories = useMemo(() => {
    if (activePresetId === 'world') {
      return territoryGeometries;
    }
    const [vx, vy, vw, vh] = viewBoxNumbers;
    const padX = vw * 0.08;
    const padY = vh * 0.08;
    return territoryGeometries.filter((g) => {
      const [x, cy] = g.centerSvg;
      const cx = x + atlasWrapOffset(x, activePresetId);
      return (
        cx >= vx - padX &&
        cx <= vx + vw + padX &&
        cy >= vy - padY &&
        cy <= vy + vh + padY
      );
    });
  }, [activePresetId, territoryGeometries, viewBoxNumbers]);

  // Filter countries for the accessible search / quick-select tray
  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const [vx, vy, vw, vh] = viewBoxNumbers;
    return PLAYABLE_COUNTRIES.filter((country) => {
      if (q) {
        return (
          country.name.toLowerCase().includes(q) ||
          country.id.toLowerCase().includes(q) ||
          country.region.toLowerCase().includes(q)
        );
      }
      if (activePresetId === 'world') return true;
      const geom = COUNTRY_MAP_GEOMETRIES[country.id];
      if (!geom) return true;
      const [x, cy] = geom.centerSvg;
      const cx = x + atlasWrapOffset(x, activePresetId);
      return (
        cx >= vx - vw * 0.05 &&
        cx <= vx + vw * 1.05 &&
        cy >= vy - vh * 0.05 &&
        cy <= vy + vh * 1.05
      );
    });
  }, [activePresetId, searchQuery, viewBoxNumbers]);

  const hoveredCountry: PlayableCountry | null = hoveredCountryId
    ? PLAYABLE_COUNTRY_MAP[hoveredCountryId] ?? null
    : null;

  // Scale stroke width & pill font sizes smoothly when zoomed into smaller regions
  const zoomRatio = viewBoxNumbers[2] / 1000;
  const baseStroke = Math.max(0.35, 0.75 * zoomRatio);

  return (
    <div
      className="rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden"
      data-testid="world-map-view"
    >
      {/* Top toolbar: Regional Zoom Presets */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-[var(--border-subtle)] bg-[#F5F5F7]/70 dark:bg-[#0B0C0E]/60 flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Regional zoom presets"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9AA0AA] mr-1.5">
            Zoom Preset:
          </span>
          {MAP_REGION_PRESETS.map((preset) => {
            const isActive = preset.id === activePresetId;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => handlePresetChange(preset.id)}
                data-region-preset={preset.id}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[var(--brand-accent)] dark:bg-[var(--brand-accent)] text-white shadow-2xs'
                    : 'bg-white dark:bg-[var(--surface-card)] text-slate-700 dark:text-[#E5E7EB] border border-slate-200/80 dark:border-[var(--border-subtle)] hover:border-[var(--brand-accent)] dark:hover:border-[var(--brand-accent)]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Status legend (always pairs color with icon + text for accessibility) */}
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-medium text-slate-600 dark:text-[#9AA0AA]">
          {evaluation ? (
            <>
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                <span
                  className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block"
                  aria-hidden="true"
                />
                ✓ Correct ({evaluation.correctCountryIds.length})
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                <span
                  className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block"
                  aria-hidden="true"
                />
                ! Missed ({evaluation.missedCountryIds.length})
              </span>
              <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300">
                <span
                  className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block"
                  aria-hidden="true"
                />
                ✗ Incorrect ({evaluation.incorrectCountryIds.length})
              </span>
            </>
          ) : showAllCoverageTiers || highlightedCoverageCountryIds.length > 0 ? (
            <>
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                <span
                  className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block"
                  aria-hidden="true"
                />
                ✓ Official
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                <span
                  className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block"
                  aria-hidden="true"
                />
                ◐ Limited
              </span>
              <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300">
                <span
                  className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block"
                  aria-hidden="true"
                />
                ✗ None
              </span>
            </>
          ) : showAllDrivingSides || highlightedDrivingCountryIds.length > 0 ? (
            <>
              <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-300">
                <span
                  className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block"
                  aria-hidden="true"
                />
                L Left-Hand Traffic
              </span>
              <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-300">
                <span
                  className="w-2.5 h-2.5 rounded-xs bg-teal-500 inline-block"
                  aria-hidden="true"
                />
                R Right-Hand Traffic
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-xs bg-[var(--brand-accent)] dark:bg-[var(--brand-accent)] inline-block"
                aria-hidden="true"
              />
              Selected ({selectedCountryIds.length})
            </span>
          )}
        </div>
      </div>

      {/* Vector World Map SVG Canvas */}
      <div className="relative bg-[#DFEDF3] dark:bg-[#172630] select-none">
        <svg
          viewBox={activePreset.viewBox}
          role="img"
          aria-label={ariaLabel}
          className={`block w-full ${activePresetId === 'world' ? 'h-auto' : 'h-[235px] sm:h-[360px]'}`}
          data-active-preset={activePresetId}
        >
          <title>{ariaLabel}</title>
          <desc>
            Offline atlas of Playable Countries. Use the regional zoom presets or select countries
            and territories on the map or with the country buttons.
          </desc>

          <path
            id={contextPathId}
            d={ATLAS_CONTEXT_PATH}
            data-layer="atlas-context"
            fillRule="evenodd"
            vectorEffect="non-scaling-stroke"
            strokeWidth={0.5}
            className="pointer-events-none fill-[#E0E4D9] stroke-[#AEB9B1] dark:fill-[#293332] dark:stroke-[#495A5B]"
          />

          {activePresetId === 'oceania' && (
            <use href={`#${contextPathId}`} x={1000} aria-hidden="true" className="pointer-events-none" />
          )}

          {/* Country Polygons */}
          <g data-layer="country-polygons">
            {allGeometries.map((geom) => {
              if (!geom.svgPath) return null;
              const x = geom.centerSvg[0];
              const offset = atlasWrapOffset(x, activePresetId);
              const status = getCountryStatus(geom.countryId);
              const isHovered = hoveredCountryId === geom.countryId;

              let fillClass =
                'fill-[#F3F2E6] dark:fill-[#35403D] hover:fill-[#D2E7EA] dark:hover:fill-[#485C60]';
              let strokeClass = 'stroke-[#9AAEAA] dark:stroke-[#647777]';

              if (status === 'selected') {
                fillClass = 'fill-[var(--brand-accent)] dark:fill-[var(--brand-accent)]';
                strokeClass = 'stroke-white dark:stroke-slate-900';
              } else if (status === 'correct' || status === 'tier-official') {
                fillClass = 'fill-emerald-500 dark:fill-emerald-500';
                strokeClass = 'stroke-emerald-900 dark:stroke-emerald-200';
              } else if (status === 'missed' || status === 'tier-limited') {
                fillClass = 'fill-amber-400 dark:fill-amber-500';
                strokeClass = 'stroke-amber-900 dark:stroke-amber-200';
              } else if (status === 'incorrect' || status === 'tier-none') {
                fillClass = 'fill-rose-500 dark:fill-rose-500';
                strokeClass = 'stroke-rose-900 dark:stroke-rose-200';
              } else if (status === 'driving-left') {
                fillClass = 'fill-indigo-500 dark:fill-indigo-500';
                strokeClass = 'stroke-indigo-900 dark:stroke-indigo-200';
              } else if (status === 'driving-right') {
                fillClass = 'fill-teal-500 dark:fill-teal-600';
                strokeClass = 'stroke-teal-900 dark:stroke-teal-200';
              }

              return (
                <path
                  key={geom.countryId}
                  d={geom.svgPath}
                  transform={offset ? `translate(${offset} 0)` : undefined}
                  data-country-id={geom.countryId}
                  data-status={status}
                  onClick={() => {
                    if (!readOnly) onToggleCountry(geom.countryId);
                  }}
                  onMouseEnter={() => setHoveredCountryId(geom.countryId)}
                  onMouseLeave={() =>
                    setHoveredCountryId((prev) => (prev === geom.countryId ? null : prev))
                  }
                  className={`transition-colors duration-150 ${
                    readOnly ? 'cursor-default' : 'cursor-pointer'
                  } ${fillClass} ${strokeClass}`}
                  fillRule="evenodd"
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={isHovered || status !== 'default' ? 1 : 0.55}
                  strokeLinejoin="round"
                >
                  <title>{`${geom.country.name} (${geom.countryId.toUpperCase()})${
                    status !== 'default' ? ` — ${getStatusBadgeText(status)}` : ''
                  }`}</title>
                </path>
              );
            })}
          </g>

          {/* Evaluated Status Pin Labels or Coverage/Driving Pin Labels on Highlighted Countries */}
          {(evaluation ||
            highlightedCoverageCountryIds.length > 0 ||
            highlightedDrivingCountryIds.length > 0) && (
            <g data-layer="evaluation-badges" className="pointer-events-none">
              {(evaluation
                ? [
                    ...evaluation.correctCountryIds.map((id) => ({
                      id,
                      status: 'correct' as const,
                    })),
                    ...evaluation.missedCountryIds.map((id) => ({
                      id,
                      status: 'missed' as const,
                    })),
                    ...evaluation.incorrectCountryIds.map((id) => ({
                      id,
                      status: 'incorrect' as const,
                    })),
                  ]
                : (highlightedCoverageCountryIds.length > 0
                    ? highlightedCoverageCountryIds
                    : highlightedDrivingCountryIds
                  ).map((id) => ({
                    id,
                    status: getCountryStatus(id),
                  }))
              ).map(({ id, status }) => {
                const geom = COUNTRY_MAP_GEOMETRIES[id];
                const country = PLAYABLE_COUNTRY_MAP[id];
                if (!geom || country?.isTerritory || status === 'default') return null;
                const [x, cy] = geom.centerSvg;
                const cx = x + atlasWrapOffset(x, activePresetId);
                const r = Math.max(3.2, 6.5 * zoomRatio);
                const fontSize = Math.max(2.6, 5.2 * zoomRatio);
                const badgeFill =
                  status === 'correct' || status === 'tier-official'
                    ? '#059669'
                    : status === 'missed' || status === 'tier-limited'
                      ? '#D97706'
                      : status === 'driving-left'
                        ? '#4F46E5'
                        : status === 'driving-right'
                          ? '#0D9488'
                          : '#E11D48';
                return (
                  <g key={`eval-badge-${id}`} transform={`translate(${cx}, ${cy})`}>
                    <circle
                      r={r}
                      fill={badgeFill}
                      stroke="#FFFFFF"
                      strokeWidth={baseStroke * 0.9}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#FFFFFF"
                      fontSize={fontSize}
                      fontWeight="700"
                    >
                      {getStatusIcon(status)}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Small Territory & Microstate Pill Markers on the SVG Map */}
          <g data-layer="territory-pills">
            {activePresetId !== 'world' && visibleTerritories.map((geom) => {
              const status = getCountryStatus(geom.countryId);
              const [x, cy] = geom.centerSvg;
              const cx = x + atlasWrapOffset(x, activePresetId);
              const [dx, dy] = geom.pillOffsetSvg;
              const px = cx + dx;
              const py = cy + dy;
              const pillW = Math.max(10, 22 * Math.sqrt(zoomRatio));
              const pillH = Math.max(5.5, 11 * Math.sqrt(zoomRatio));
              const fontSize = Math.max(3.2, 6.2 * Math.sqrt(zoomRatio));
              const dotR = Math.max(1.2, 2.2 * Math.sqrt(zoomRatio));

              let pillFill = '#FFFFFF';
              let pillStroke = '#475569';
              let pillText = '#0F172A';

              if (status === 'selected') {
                pillFill = '#5b45e8';
                pillStroke = '#FFFFFF';
                pillText = '#FFFFFF';
              } else if (status === 'correct' || status === 'tier-official') {
                pillFill = '#10B981';
                pillStroke = '#064E3B';
                pillText = '#FFFFFF';
              } else if (status === 'missed' || status === 'tier-limited') {
                pillFill = '#F59E0B';
                pillStroke = '#78350F';
                pillText = '#FFFFFF';
              } else if (status === 'incorrect' || status === 'tier-none') {
                pillFill = '#F43F5E';
                pillStroke = '#881337';
                pillText = '#FFFFFF';
              } else if (status === 'driving-left') {
                pillFill = '#4F46E5';
                pillStroke = '#312E81';
                pillText = '#FFFFFF';
              } else if (status === 'driving-right') {
                pillFill = '#0D9488';
                pillStroke = '#134E4A';
                pillText = '#FFFFFF';
              }

              const iconPrefix = getStatusIcon(status);
              const codeText = iconPrefix
                ? `${iconPrefix}${geom.countryId.toUpperCase()}`
                : geom.countryId.toUpperCase();

              return (
                <g
                  key={`svg-pill-${geom.countryId}`}
                  data-territory-marker={geom.countryId}
                  onClick={() => {
                    if (!readOnly) onToggleCountry(geom.countryId);
                  }}
                  onMouseEnter={() => setHoveredCountryId(geom.countryId)}
                  onMouseLeave={() =>
                    setHoveredCountryId((prev) => (prev === geom.countryId ? null : prev))
                  }
                  className={readOnly ? 'cursor-default' : 'cursor-pointer'}
                >
                  <title>{`${geom.country.name} (Territory / Microstate)${
                    status !== 'default' ? ` — ${getStatusBadgeText(status)}` : ''
                  }`}</title>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={px}
                    y2={py}
                    stroke={pillStroke}
                    strokeWidth={baseStroke * 0.85}
                  />
                  <circle cx={cx} cy={cy} r={dotR} fill={pillStroke} />
                  <rect
                    x={px - pillW / 2}
                    y={py - pillH / 2}
                    width={pillW}
                    height={pillH}
                    rx={pillH / 2}
                    fill={pillFill}
                    stroke={pillStroke}
                    strokeWidth={baseStroke * 1.1}
                  />
                  <text
                    x={px}
                    y={py}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={pillText}
                    fontSize={fontSize}
                    fontWeight="700"
                    className="font-mono"
                  >
                    {codeText}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Hover / Active Country Inspector Badge */}
        <div
          className="px-3.5 py-1.5 border-t border-slate-200/80 dark:border-[var(--border-subtle)] bg-white/95 dark:bg-[var(--surface-card)]/95 flex flex-wrap items-center justify-between gap-2 text-xs"
          aria-live="polite"
        >
          {hoveredCountry ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-[#F3F4F6]">
                {hoveredCountry.name}
              </span>
              <span className="font-mono text-[11px] uppercase px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {hoveredCountry.id}
              </span>
              <span className="text-slate-500 dark:text-[#9AA0AA]">{hoveredCountry.region}</span>
              {hoveredCountry.isTerritory && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50">
                  Territory / Microstate Pill
                </span>
              )}
              {(evaluation || showAllCoverageTiers || highlightedCoverageCountryIds.length > 0) && (
                <span className="text-[11px] text-slate-500 dark:text-[#9AA0AA]">
                  Coverage: <strong className="uppercase">{hoveredCountry.coverageTier}</strong>
                </span>
              )}
              {(evaluation || showAllDrivingSides || highlightedDrivingCountryIds.length > 0) && (
                <span className="text-[11px] text-slate-500 dark:text-[#9AA0AA]">
                  Driving: <strong className="uppercase">{hoveredCountry.drivingSide}-hand</strong>
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-500 dark:text-[#9AA0AA]">
              Select a country on the map or use the country buttons below.
            </span>
          )}
          <span className="text-[11px] font-mono text-slate-500 dark:text-[#9AA0AA]">
            Preset: {activePreset.label}
          </span>
        </div>
      </div>

      {/* Small GeoGuessr Territories & Microstates Accessible Pill Bar */}
      <div
        className="px-3.5 py-2.5 border-t border-slate-200 dark:border-[var(--border-subtle)] bg-[#F5F5F7]/50 dark:bg-[#0B0C0E]/40"
        data-testid="territory-pill-bar"
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9AA0AA]">
            Small Territories &amp; Microstates ({visibleTerritories.length})
          </span>
          <span className="text-[11px] text-slate-500 dark:text-[#9AA0AA]">
            Select small islands and microstates
          </span>
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Small GeoGuessr territories and microstates"
        >
          {visibleTerritories.map((territory) => {
            const status = getCountryStatus(territory.countryId);
            const isSelected = selectedSet.has(territory.countryId);
            const badgeIcon = getStatusIcon(status);

            let pillStyle =
              'bg-white dark:bg-[var(--surface-card)] text-slate-700 dark:text-[#E5E7EB] border-slate-300 dark:border-[var(--border-subtle)] hover:border-[var(--brand-accent)] dark:hover:border-[var(--brand-accent)]';
            if (status === 'selected') {
              pillStyle =
                'bg-[var(--brand-accent)] dark:bg-[var(--brand-accent)] text-white border-[var(--brand-accent)] dark:border-[var(--brand-accent)]';
            } else if (status === 'correct' || status === 'tier-official') {
              pillStyle =
                'bg-emerald-600 text-white border-emerald-700 dark:bg-emerald-600 dark:border-emerald-400';
            } else if (status === 'missed' || status === 'tier-limited') {
              pillStyle =
                'bg-amber-500 text-slate-950 border-amber-700 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-300';
            } else if (status === 'incorrect' || status === 'tier-none') {
              pillStyle =
                'bg-rose-600 text-white border-rose-700 dark:bg-rose-600 dark:border-rose-400';
            } else if (status === 'driving-left') {
              pillStyle =
                'bg-indigo-600 text-white border-indigo-700 dark:bg-indigo-600 dark:border-indigo-400';
            } else if (status === 'driving-right') {
              pillStyle =
                'bg-teal-600 text-white border-teal-700 dark:bg-teal-600 dark:border-teal-400';
            }

            return (
              <button
                key={`pill-btn-${territory.countryId}`}
                type="button"
                disabled={readOnly}
                aria-pressed={isSelected}
                data-territory-pill={territory.countryId}
                data-status={status}
                onClick={() => {
                  if (!readOnly) onToggleCountry(territory.countryId);
                }}
                onMouseEnter={() => setHoveredCountryId(territory.countryId)}
                onMouseLeave={() =>
                  setHoveredCountryId((prev) =>
                    prev === territory.countryId ? null : prev
                  )
                }
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                  readOnly ? 'cursor-default' : 'cursor-pointer'
                } ${pillStyle}`}
              >
                {badgeIcon && (
                  <span className="font-bold" aria-hidden="true">
                    {badgeIcon}
                  </span>
                )}
                <span>{territory.country.name}</span>
                <span className="font-mono text-[10px] opacity-80 uppercase">
                  {territory.countryId}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accessible Country Quick-Filter & Keyboard Selection Tray */}
      <div className="px-3.5 py-2.5 border-t border-slate-200 dark:border-[var(--border-subtle)] bg-white dark:bg-[var(--surface-card)]">
        <search className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <label
            htmlFor="world-map-country-filter"
            className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#9AA0AA]"
          >
            Accessible Country Selector ({filteredCountries.length} in view)
          </label>
          <input
            id="world-map-country-filter"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter countries by name or code..."
            className="text-xs px-2.5 py-1 rounded-md border border-slate-200 dark:border-[var(--border-subtle)] bg-[#F5F5F7] dark:bg-[#0B0C0E] text-slate-900 dark:text-[#F3F4F6] focus:outline-2 focus:outline-[var(--brand-accent)] w-56"
          />
        </search>
        <div
          className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1"
          role="group"
          aria-label="Playable Countries list"
        >
          {filteredCountries.map((country) => {
            const status = getCountryStatus(country.id);
            const isSelected = selectedSet.has(country.id);
            const badgeIcon = getStatusIcon(status);

            let chipClass =
              'bg-[#F5F5F7] dark:bg-[#0B0C0E] text-slate-700 dark:text-[#E5E7EB] border-slate-200 dark:border-[var(--border-subtle)] hover:border-[var(--brand-accent)] dark:hover:border-[var(--brand-accent)]';
            if (status === 'selected') {
              chipClass =
                'bg-[var(--brand-accent)] dark:bg-[var(--brand-accent)] text-white border-[var(--brand-accent)] dark:border-[var(--brand-accent)]';
            } else if (status === 'correct' || status === 'tier-official') {
              chipClass = 'bg-emerald-600 text-white border-emerald-700';
            } else if (status === 'missed' || status === 'tier-limited') {
              chipClass = 'bg-amber-500 text-slate-950 border-amber-700 font-semibold';
            } else if (status === 'incorrect' || status === 'tier-none') {
              chipClass = 'bg-rose-600 text-white border-rose-700';
            } else if (status === 'driving-left') {
              chipClass = 'bg-indigo-600 text-white border-indigo-700';
            } else if (status === 'driving-right') {
              chipClass = 'bg-teal-600 text-white border-teal-700';
            }

            return (
              <button
                key={`country-chip-${country.id}`}
                type="button"
                disabled={readOnly}
                aria-pressed={isSelected}
                data-country-chip={country.id}
                data-status={status}
                onClick={() => {
                  if (!readOnly) onToggleCountry(country.id);
                }}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border transition-colors ${
                  readOnly ? 'cursor-default' : 'cursor-pointer'
                } ${chipClass}`}
              >
                {badgeIcon && (
                  <span className="font-bold" aria-hidden="true">
                    {badgeIcon}
                  </span>
                )}
                <span>{country.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
