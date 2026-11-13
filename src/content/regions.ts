import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, Lesson, Topic } from './types.ts';
import { chunkLessons } from './helpers.ts';

const TOPIC_ID = 'regions';

interface Region {
  id: string;
  title: string;
  /** Observations that point to this region. Every one should be (nearly) exclusive to it. */
  facts: string[];
  value: 1 | 2 | 3;
  confidence?: Clue['confidence'];
}

interface CountrySet {
  key: string;
  countryId: string;
  noun: string;
  lessonTitle: string;
  regions: Region[];
}

/**
 * Region guessing inside very large countries, where clicking the middle loses most of the points.
 * Facts are taken from the Plonk It country guides and rewritten; only clues that single out one
 * state, province or region are used. Questions show one clue and ask where it belongs.
 */
const SETS: CountrySet[] = [
  {
    key: 'usa',
    countryId: 'us',
    noun: 'state',
    lessonTitle: 'United States',
    regions: [
      { id: 'nv', title: 'Nevada', value: 3, facts: ['Bollards that are a thin stick with a vertical white reflector outlined in black'] },
      { id: 'ut', title: 'Utah', value: 3, facts: ['Bollards with a white square reflector on top of a black rectangular reflector'] },
      { id: 'wi', title: 'Wisconsin', value: 3, facts: ['Plain white bollards with black reflectors', 'Green ATV route signs'] },
      { id: 'ks', title: 'Kansas', value: 2, facts: ['White reflectors on the signposts of rural stop signs'] },
      { id: 'az', title: 'Arizona', value: 2, facts: ['Kilometre distances on the exit and distance signs of Interstate 19, from Tucson to the Mexican border'] },
      { id: 'or', title: 'Oregon', value: 2, facts: ['Speed signs that say only "Speed" instead of "Speed Limit"'], confidence: 'medium' },
      { id: 'ia', title: 'Iowa', value: 1, facts: ['Ordinary roads paved in concrete far more often than in other states'], confidence: 'medium' },
      { id: 'mn', title: 'Minnesota', value: 2, facts: ['Yellow signs with vertical black triangles before bridges at major river crossings'], confidence: 'medium' },
    ],
  },
  {
    key: 'australia',
    countryId: 'au',
    noun: 'state or territory',
    lessonTitle: 'Australia',
    regions: [
      { id: 'wa', title: 'Western Australia', value: 3, facts: ['Black-and-white striped bollards', 'Yellow signposts', 'Dark green property markers beside the road'] },
      { id: 'sa', title: 'South Australia', value: 3, facts: ['Stobie poles, made of steel and concrete', 'Bus stops with yellow posts', 'White property markers beside the road'] },
      { id: 'nt', title: 'Northern Territory', value: 3, facts: ['A 130 km/h speed limit sign', 'Rusty metal utility poles with several holes'] },
      { id: 'vic', title: 'Victoria', value: 2, facts: ['Fire hydrants with red-painted tops', 'Utility poles topped with three circular coils'] },
      { id: 'qld', title: 'Queensland', value: 2, facts: ['Black-and-yellow bollards', 'Road signs with a fluorescent border'] },
      { id: 'nsw', title: 'New South Wales', value: 2, facts: ['Red "No Stopping" signs'] },
      { id: 'act', title: 'Australian Capital Territory', value: 1, facts: ['White "No Stopping" and "No Parking" signs that include text'] },
      { id: 'tas', title: 'Tasmania', value: 2, facts: ['Olive-green possum guards on electricity poles', 'White direction signs'] },
    ],
  },
  {
    key: 'canada',
    countryId: 'ca',
    noun: 'province',
    lessonTitle: 'Canada',
    regions: [
      { id: 'ab', title: 'Alberta', value: 3, facts: ['Rural roads numbered as township roads (east-west) and range roads (north-south)'] },
      { id: 'on', title: 'Ontario', value: 3, facts: ['Orange-and-black striped traffic cones', 'Kilometre markers with a white square at the bottom'] },
      { id: 'qc', title: 'Québec', value: 3, facts: ['Orange-and-white striped traffic cones', 'Red-and-white chevrons', 'Long thin white bollards attached to guardrails, with a red or green reflector on top'] },
      { id: 'nl', title: 'Newfoundland and Labrador', value: 2, facts: ['T-intersection signs with a rectangular yellow border around the diamond', 'Wooden boxes holding up road signs'] },
      { id: 'pe', title: 'Prince Edward Island', value: 2, facts: ['Reddish soil with potato farming', 'Transformers mounted at a 45° angle on poles'] },
      { id: 'mb', title: 'Manitoba', value: 2, facts: ['Rural grid roads referred to only by number and compass direction', 'Black-and-grey bollards with an orange stripe below the grey'] },
      { id: 'bc', title: 'British Columbia', value: 2, facts: ['Thin, slightly curved black-and-white bollards, mostly on Vancouver Island'], confidence: 'medium' },
      { id: 'ns', title: 'Nova Scotia', value: 1, facts: ['Short, curved lamp arms on utility poles'], confidence: 'medium' },
    ],
  },
  {
    key: 'brazil',
    countryId: 'br',
    noun: 'state',
    lessonTitle: 'Brazil',
    regions: [
      { id: 'rj', title: 'Rio de Janeiro', value: 2, facts: ['Street lamps curved along the whole of the lamp arm'], confidence: 'medium' },
      { id: 'pe', title: 'Pernambuco', value: 2, facts: ['Utility pole insulators that look like brown mushrooms'], confidence: 'medium' },
      { id: 'rr', title: 'Roraima', value: 2, facts: ['Open grassy plains with large mountains in the distance and thin, bunched grass'], confidence: 'medium' },
      { id: 'mt', title: 'Mato Grosso', value: 2, facts: ['Light pink soil'], confidence: 'medium' },
      { id: 'pr', title: 'Paraná', value: 2, facts: ['Deep maroon soil near the Paraná river'], confidence: 'medium' },
      { id: 'sc', title: 'Santa Catarina', value: 3, facts: ['Utility poles on Santa Catarina Island painted white with blue and red stripes', 'German-influenced building styles'], confidence: 'medium' },
      { id: 'rs', title: 'Rio Grande do Sul', value: 3, facts: ['Lush green fields where the soil is not red, resembling Uruguay in the south'], confidence: 'medium' },
    ],
  },
  {
    key: 'russia',
    countryId: 'ru',
    noun: 'region',
    lessonTitle: 'Russia',
    regions: [
      { id: 'kaliningrad', title: 'Kaliningrad', value: 3, facts: ['Lines of oak trees with a single white stripe around the trunk'] },
      { id: 'sochi', title: 'Black Sea coast (Sochi)', value: 3, facts: ['Palm trees, found nowhere else in Russia'] },
      { id: 'spb', title: 'Saint Petersburg', value: 2, facts: ['Downtown street signs with a transliteration on a black background'] },
      { id: 'moscow', title: 'Moscow', value: 2, facts: ['Blue tourist signs with English translations'] },
      { id: 'sakhalin', title: 'Sakhalin', value: 2, facts: ['Giant butterbur, the "Sakhalin cabbage", growing along the roads'] },
      { id: 'kamchatka', title: 'Kamchatka', value: 3, facts: ['Grey gravelly soil and many volcanoes'] },
      { id: 'dagestan', title: 'Dagestan', value: 2, facts: ['White limestone-brick buildings', 'Extremely dry, flat land west of the Caspian Sea'] },
      { id: 'murmansk', title: 'Murmansk', value: 2, facts: ['Open hilly land with low shrubs and fireweed'], confidence: 'medium' },
    ],
  },
];

export function buildRegions(): { topic: Topic; clues: Clue[] } {
  const clues: Clue[] = [];
  const lessons: Lesson[] = [];

  for (const set of SETS) {
    const country = PLAYABLE_COUNTRY_MAP[set.countryId];
    const group = `regions:${set.key}`;
    const setClues: Clue[] = set.regions.map((r) => ({
      id: `region:${set.key}:${r.id}`,
      topicId: TOPIC_ID,
      lessonId: '',
      title: r.title,
      stem: `Which ${set.noun} of ${country?.name ?? set.lessonTitle} has this?`,
      spot: `${r.facts[0]}.`,
      detail: r.facts.slice(1).map((f) => `${f}.`),
      regions: country ? [country.region] : [],
      countryIds: country ? [country.id] : [],
      choiceGroup: group,
      confusables: [],
      foils: [],
      stimuli: r.facts.map((text) => ({ text, kind: 'sentence' as const })),
      tells: [],
      value: r.value,
      confidence: r.confidence ?? 'high',
    }));
    lessons.push(
      ...chunkLessons({
        topicId: TOPIC_ID,
        baseId: `regions-${set.key}`,
        title: set.lessonTitle,
        summary: `Place yourself inside ${country?.name ?? set.lessonTitle} by ${set.noun}.`,
        clues: setClues,
        max: 4,
      })
    );
    clues.push(...setClues);
  }

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 12,
      title: 'Big-country regions',
      tagline: 'Place yourself inside the USA, Australia, Canada, Brazil and Russia.',
      why: 'In very large countries, clicking the middle loses most of the points, and a good guess in the right region can win a round. These clues each point to one state, province or region.',
      bestRegions: 'USA, Australia, Canada, Brazil, Russia',
      lessons,
    },
  };
}
