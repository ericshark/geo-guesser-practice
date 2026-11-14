import { PLAYABLE_COUNTRIES } from '../data/index.ts';
import type { PlayableCountry, WorldRegion } from '../data/types.ts';
import type { Clue, Lesson, Topic } from './types.ts';
import { chunkLessons } from './helpers.ts';

const TOPIC_ID = 'text-clues';
/** Oceania has too few covered countries for its own lessons, so it is grouped with Asia. */
const REGION_GROUPS: { key: string; label: string; regions: WorldRegion[] }[] = [
  { key: 'europe', label: 'Europe', regions: ['Europe'] },
  { key: 'asia-pacific', label: 'Asia-Pacific', regions: ['Asia', 'Oceania'] },
  { key: 'africa', label: 'Africa', regions: ['Africa'] },
  // North America alone has too few covered countries to build 4-option questions, so the two
  // continents share text-clue lessons (keeps the original `americas` lesson ids too).
  { key: 'americas', label: 'Americas', regions: ['North America', 'South America'] },
];

function groupKey(region: WorldRegion): string {
  return REGION_GROUPS.find((g) => g.regions.includes(region))!.key;
}

/** Web addresses whose country is not obvious from the letters (value 3). */
const NON_OBVIOUS_TLDS = new Set(['ch', 'at', 'cz', 'za', 'ua', 'ge', 'gb', 'dk', 'se', 'si', 'sk', 'lt', 'lv', 'ee', 'hr', 'rs', 'bg', 'gr', 'jp', 'kr', 'tw', 'th', 'id', 'my', 'br', 'cl', 'ar', 'au', 'nz']);

function domainClue(country: PlayableCountry): Clue {
  return {
    id: `domain:${country.id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title: country.name,
    stem: 'Which country uses this web address?',
    spot: `Web addresses ending in ${country.tld}`,
    detail: [],
    regions: [country.region],
    countryIds: [country.id],
    choiceGroup: `domain:${groupKey(country.region)}`,
    confusables: [],
    foils: [],
    stimuli: country.tldExamples.map((text) => ({ text, kind: 'plain' as const, mono: true })),
    tells: [],
    value: NON_OBVIOUS_TLDS.has(country.id) ? 3 : 2,
    confidence: 'high',
  };
}

/** Currencies that are unambiguous: no other country uses the same code or the same symbol. */
function uniqueCurrencyCountries(): PlayableCountry[] {
  const covered = PLAYABLE_COUNTRIES.filter((c) => c.coverageTier !== 'none' && !c.isTerritory);
  const codeCount = new Map<string, number>();
  const symbolCount = new Map<string, number>();
  for (const c of PLAYABLE_COUNTRIES) {
    for (const cur of c.currencies) {
      codeCount.set(cur.code, (codeCount.get(cur.code) ?? 0) + 1);
      symbolCount.set(cur.symbol, (symbolCount.get(cur.symbol) ?? 0) + 1);
    }
  }
  return covered.filter(
    (c) =>
      c.currencies.length === 1 &&
      codeCount.get(c.currencies[0].code) === 1 &&
      symbolCount.get(c.currencies[0].symbol) === 1
  );
}

function currencyClue(country: PlayableCountry): Clue {
  const currency = country.currencies[0];
  return {
    id: `currency:${country.id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title: country.name,
    subtitle: currency.name,
    stem: 'Which country uses this currency?',
    spot: `${currency.name} (${currency.symbol}) is used only in ${country.name}.`,
    detail: [],
    regions: [country.region],
    countryIds: [country.id],
    choiceGroup: `currency:${groupKey(country.region)}`,
    confusables: [],
    foils: [],
    stimuli: [{ text: currency.exampleSign, kind: 'plain', mono: true }],
    tells: [],
    value: 2,
    confidence: 'high',
  };
}

export function buildTextClues(): { topic: Topic; clues: Clue[] } {
  const clues: Clue[] = [];
  const lessons: Lesson[] = [];

  const domainCountries = PLAYABLE_COUNTRIES.filter(
    (c) => c.coverageTier === 'official' && !c.isTerritory
  );
  for (const group of REGION_GROUPS) {
    const regionClues = domainCountries
      .filter((c) => group.regions.includes(c.region))
      .map(domainClue)
      .sort((a, b) => b.value - a.value || a.title.localeCompare(b.title));
    lessons.push(
      ...chunkLessons({
        topicId: TOPIC_ID,
        baseId: `domains-${group.key}`,
        title: `Web addresses · ${group.label}`,
        summary: 'Country domains seen on shop fronts, vans and billboards.',
        clues: regionClues,
        max: 6,
      })
    );
    clues.push(...regionClues);
  }

  const currencyCountries = uniqueCurrencyCountries();
  for (const group of REGION_GROUPS) {
    const regionClues = currencyCountries
      .filter((c) => group.regions.includes(c.region))
      .map(currencyClue)
      .sort((a, b) => a.title.localeCompare(b.title));
    lessons.push(
      ...chunkLessons({
        topicId: TOPIC_ID,
        baseId: `currency-${group.key}`,
        title: `Prices · ${group.label}`,
        summary: 'Currency symbols on shop windows and price tags.',
        clues: regionClues,
        max: 6,
      })
    );
    clues.push(...regionClues);
  }

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 11,
      title: 'Text clues',
      tagline: 'Web addresses and prices that give a country away.',
      why: 'Shops, vans and billboards often carry a web address or a price. A country domain or a currency symbol is an instant, reliable confirmation.',
      bestRegions: 'Everywhere with commercial streets',
      lessons,
    },
  };
}
