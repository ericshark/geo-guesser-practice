import { ATLAS_COUNTRY_PATHS } from './atlasPaths.ts';
import { projectLatLonToSvg } from './mapProjection.ts';
import { PLAYABLE_COUNTRIES } from './countries.ts';
import type { PlayableCountry } from './types.ts';

export type MapRegionPresetId =
  | 'world'
  | 'europe'
  | 'asia'
  | 'south-se-asia'
  | 'africa'
  | 'southern-eastern-africa'
  | 'oceania'
  | 'americas';

export interface MapRegionPreset {
  id: MapRegionPresetId;
  label: string;
  shortLabel: string;
  viewBox: string; // "minX minY width height" in 1000x500 map coordinate space
  description: string;
}

export const MAP_REGION_PRESETS: MapRegionPreset[] = [
  {
    id: 'world',
    label: 'World',
    shortLabel: 'World',
    viewBox: '0 12 1000 408',
    description: 'Global overview of all Playable Countries and Street View territories',
  },
  {
    id: 'europe',
    label: 'Europe',
    shortLabel: 'Europe',
    viewBox: '420 45 220 120',
    description: 'Western, Central, Northern, Southern, and Eastern Europe',
  },
  {
    id: 'asia',
    label: 'Asia',
    shortLabel: 'Asia',
    viewBox: '550 35 450 270',
    description: 'Middle East, Central Asia, South Asia, East Asia, and Southeast Asia',
  },
  {
    id: 'south-se-asia',
    label: 'South & SE Asia',
    shortLabel: 'S & SE Asia',
    viewBox: '675 155 215 125',
    description: 'India, Bangladesh, Sri Lanka, Bhutan, Mainland & Maritime Southeast Asia',
  },
  {
    id: 'africa',
    label: 'Africa',
    shortLabel: 'Africa',
    viewBox: '440 148 215 198',
    description: 'Northern, Western, Central, Eastern, and Southern Africa',
  },
  {
    id: 'southern-eastern-africa',
    label: 'Southern & Eastern Africa',
    shortLabel: 'S & E Africa',
    viewBox: '515 215 140 135',
    description: 'Kenya, Uganda, Rwanda, Tanzania, South Africa, Botswana, Lesotho, Eswatini, Madagascar, Réunion',
  },
  {
    id: 'oceania',
    label: 'Oceania',
    shortLabel: 'Oceania',
    viewBox: '755 192 300 200',
    description: 'Australia, New Zealand, Christmas Island, Guam, Northern Mariana Islands, American Samoa',
  },
  {
    id: 'americas',
    label: 'Americas',
    shortLabel: 'Americas',
    viewBox: '0 17 430 398',
    description: 'North America, Central America, Caribbean, and South America',
  },
];

export const MAP_REGION_PRESET_MAP: Record<MapRegionPresetId, MapRegionPreset> =
  Object.fromEntries(MAP_REGION_PRESETS.map((p) => [p.id, p])) as Record<
    MapRegionPresetId,
    MapRegionPreset
  >;

export interface CountryMapGeometry {
  countryId: string;
  svgPath?: string;
  centerSvg: [number, number]; // [x, y]
  pillOffsetSvg: [number, number]; // [dx, dy] for small-territory pill marker placement to prevent overlap
}

/**
 * Explicit offsets in SVG coordinates for dense clusters of small GeoGuessr territories
 * (e.g., Channel Islands, Caribbean, Pearl River Delta, European microstates) so every
 * territory pill is legible and non-overlapping.
 */
const TERRITORY_PILL_OFFSETS: Record<string, [number, number]> = {
  im: [-16, -6],
  je: [-14, 10],
  gg: [-24, -2],
  lu: [10, -6],
  li: [14, 2],
  mc: [8, 12],
  ad: [-14, 8],
  sm: [14, -4],
  gi: [-18, 10],
  mt: [10, 12],
  cy: [12, 8],
  fo: [-14, -8],
  gl: [0, 0],
  hk: [18, -6],
  mo: [-18, 10],
  sg: [-16, 12],
  cx: [-14, 12],
  gu: [-14, 10],
  mp: [14, -8],
  as: [0, 10],
  re: [14, 8],
  pr: [-16, -10],
  vi: [18, -4],
  bm: [14, -6],
  cw: [0, 12],
};

export const COUNTRY_MAP_GEOMETRIES: Record<string, CountryMapGeometry> = Object.fromEntries(
  PLAYABLE_COUNTRIES.map((country) => {
    const centerSvg = projectLatLonToSvg(country.coordinates[0], country.coordinates[1]);
    const pillOffsetSvg = TERRITORY_PILL_OFFSETS[country.id] ?? [0, 0];
    return [
      country.id,
      {
        countryId: country.id,
        svgPath: ATLAS_COUNTRY_PATHS[country.id],
        centerSvg,
        pillOffsetSvg,
      },
    ];
  })
);

/**
 * Picks the most helpful initial zoom preset when presenting a set of target countries.
 */
export function inferBestRegionPresetForCountries(
  countries: PlayableCountry[]
): MapRegionPresetId {
  if (countries.length === 0) return 'world';
  const regions = new Set(countries.map((c) => c.region));
  if (regions.size > 1) {
    return 'world';
  }
  const soleRegion = Array.from(regions)[0];
  const subregions = new Set(countries.map((c) => c.subregion));

  if (soleRegion === 'Europe') return 'europe';
  if (soleRegion === 'Oceania') return 'oceania';
  if (soleRegion === 'Americas') return 'americas';
  if (soleRegion === 'Asia') {
    const allSouthOrSe = Array.from(subregions).every(
      (s) => s === 'South Asia' || s === 'Southeast Asia'
    );
    return allSouthOrSe ? 'south-se-asia' : 'asia';
  }
  if (soleRegion === 'Africa') {
    const allSouthOrEast = Array.from(subregions).every(
      (s) => s === 'Southern Africa' || s === 'Eastern Africa'
    );
    return allSouthOrEast ? 'southern-eastern-africa' : 'africa';
  }
  return 'world';
}
