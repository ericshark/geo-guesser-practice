import { PLAYABLE_COUNTRIES } from '../data/index.ts';
import type { PlayableCountry, WorldRegion } from '../data/types.ts';
import type { Clue, Foil, Lesson, Topic } from './types.ts';
import { chunkLessons } from './helpers.ts';

const TOPIC_ID = 'foundations';

/** Left-hand-traffic countries that come up most often in GeoGuessr (value 3). */
const CORE_LEFT = new Set([
  'gb', 'ie', 'au', 'nz', 'za', 'jp', 'th', 'in', 'id', 'my', 'ke', 'bw', 'na', 'zw', 'zm', 'mz', 'sg', 'hk',
]);

/**
 * Countries with no official Street View road coverage that players meet most often
 * (i.e. a round can never be there). Kept to a short list that is stable over time.
 */
const NO_COVERAGE_IDS = ['cn', 'ir', 'kp', 'sa', 'eg', 'dz', 'cu', 've', 'by', 'mm', 'et'];

const REGION_ORDER: WorldRegion[] = ['Africa', 'Asia', 'Europe', 'Oceania', 'Americas'];

function foilPool(
  target: PlayableCountry,
  predicate: (c: PlayableCountry) => boolean,
  noteFor: (c: PlayableCountry) => string,
  idPrefix: string,
  size = 6
): Foil[] {
  const candidates = PLAYABLE_COUNTRIES.filter(
    (c) => c.id !== target.id && predicate(c) && !c.isTerritory
  );
  const score = (c: PlayableCountry) =>
    (c.subregion === target.subregion ? 0 : c.region === target.region ? 1 : 2) * 10 +
    (c.drivingNote || c.isTrapCountry ? 0 : 1);
  return candidates
    .sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name))
    .slice(0, size)
    .map((c) => ({ id: `${idPrefix}:${c.id}`, label: c.name, note: noteFor(c) }));
}

function drivingClue(country: PlayableCountry): Clue {
  const detail: string[] = [];
  if (country.drivingNote) detail.push(country.drivingNote);
  return {
    id: `drive-left:${country.id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title: country.name,
    stem: 'Which of these countries drives on the left?',
    spot: `${country.name} drives on the left.`,
    detail,
    regions: [country.region],
    countryIds: [country.id],
    choiceGroup: '',
    confusables: [],
    foils: foilPool(
      country,
      (c) => c.drivingSide === 'right',
      (c) => `${c.name} drives on the right.${c.drivingNote ? ` ${c.drivingNote}` : ''}`,
      'foil-right'
    ),
    stimuli: [{ text: 'Which side of the road does traffic keep to?', kind: 'plain' }],
    tells: [],
    value: CORE_LEFT.has(country.id) ? 3 : country.isTerritory ? 1 : 2,
    confidence: 'high',
  };
}

function coverageClue(country: PlayableCountry): Clue {
  return {
    id: `no-coverage:${country.id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title: country.name,
    stem: 'Which of these countries has no official Street View road coverage?',
    spot: `${country.name} has no official Street View road coverage.`,
    detail: [
      'Coverage changes over time, so treat this as the current rule of thumb.',
      'If a round looks like this country, it is almost certainly a neighbour or unofficial coverage.',
    ],
    regions: [country.region],
    countryIds: [country.id],
    choiceGroup: '',
    confusables: [],
    foils: foilPool(
      country,
      (c) => c.coverageTier === 'official',
      (c) => `${c.name} has extensive official coverage.`,
      'foil-covered'
    ),
    stimuli: [{ text: 'Where can a round never take place?', kind: 'plain' }],
    tells: [],
    value: 2,
    confidence: 'medium',
  };
}

export function buildFoundations(): { topic: Topic; clues: Clue[] } {
  const clues: Clue[] = [];
  const lessons: Lesson[] = [];

  // Driving side: one lesson group per region, most important countries first.
  const left = PLAYABLE_COUNTRIES.filter((c) => c.drivingSide === 'left');
  for (const region of REGION_ORDER) {
    const inRegion = left
      .filter((c) => c.region === region)
      .map(drivingClue)
      .sort((a, b) => b.value - a.value || a.title.localeCompare(b.title));
    if (inRegion.length === 0) continue;
    const label =
      region === 'Americas' ? 'the Americas' : region === 'Oceania' ? 'Oceania' : region;
    lessons.push(
      ...chunkLessons({
        topicId: TOPIC_ID,
        baseId: `drive-left-${region.toLowerCase()}`,
        title: `Driving on the left · ${label}`,
        summary: `Which countries in ${label} keep left, and the neighbours that do not.`,
        clues: inRegion,
        max: 5,
      })
    );
    clues.push(...inRegion);
  }

  // Missing Street View.
  const noCoverage = NO_COVERAGE_IDS.map((id) => PLAYABLE_COUNTRIES.find((c) => c.id === id))
    .filter((c): c is PlayableCountry => Boolean(c) && c!.coverageTier === 'none')
    .map(coverageClue);
  lessons.push(
    ...chunkLessons({
      topicId: TOPIC_ID,
      baseId: 'no-coverage',
      title: 'Where Street View does not exist',
      summary: 'Countries with no official road coverage, so a round can never be there.',
      clues: noCoverage,
      max: 6,
    })
  );
  clues.push(...noCoverage);

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 1,
      title: 'Foundations',
      tagline: 'The fastest filters: which side traffic keeps to, and where rounds cannot be.',
      why: 'Driving side crosses out whole continents in a second, and knowing where there is no Street View stops you guessing countries that cannot appear.',
      bestRegions: 'Africa, South and Southeast Asia, the British Isles, Oceania',
      lessons,
    },
  };
}
