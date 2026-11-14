import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, KmPostVisual, Topic } from './types.ts';
import { attachSources, chunkLessons, linkConfusables, plonkit } from './helpers.ts';

const TOPIC_ID = 'km-posts';

function post(
  id: string,
  title: string,
  subtitle: string,
  spot: string,
  detail: string[],
  countryIds: string[],
  visual: KmPostVisual,
  alt: string,
  value: 1 | 2 | 3
): Clue {
  const known = countryIds.filter((c) => PLAYABLE_COUNTRY_MAP[c]);
  return {
    id: `km:${id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title,
    subtitle,
    stem: 'Where would you expect a kilometre marker like this?',
    spot,
    detail,
    regions: [...new Set(known.map((c) => PLAYABLE_COUNTRY_MAP[c].region))],
    countryIds: known,
    choiceGroup: 'km-posts',
    confusables: [],
    foils: [],
    stimuli: [{ text: alt, kind: 'plain', visual }],
    tells: [],
    value,
    confidence: 'medium',
  };
}

function numbering(
  id: string,
  title: string,
  spot: string,
  detail: string[],
  countryIds: string[],
  samples: string[],
  value: 1 | 2 | 3
): Clue {
  const known = countryIds.filter((c) => PLAYABLE_COUNTRY_MAP[c]);
  return {
    id: `km:${id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title,
    stem: 'Which country numbers its roads like this?',
    spot,
    detail,
    regions: [...new Set(known.map((c) => PLAYABLE_COUNTRY_MAP[c].region))],
    countryIds: known,
    choiceGroup: 'road-numbers',
    confusables: [],
    foils: [],
    stimuli: samples.map((text) => ({ text, kind: 'sign' as const, mono: true })),
    tells: [],
    value,
    confidence: 'medium',
  };
}

/**
 * Kilometre posts and road numbers are printed on the road itself, so they are reliable once learned.
 * Each clue is a tendency: markers vary by road type and region inside a country.
 */
export function buildKmPosts(): { topic: Topic; clues: Clue[] } {
  const posts: Clue[] = [
    post(
      'france-semicircle',
      'France',
      'Red or yellow semicircle on top',
      'A white marker with a red or yellow semicircle on top.',
      ['It may be a waystone or a flat sign. Major highways use square markers with a red top.'],
      ['fr'],
      { kind: 'km-post', shape: 'post', body: 'white', cap: 'red' },
      'White kilometre post with a red semicircle on top',
      3
    ),
    post(
      'spain-border',
      'Spain',
      'Rectangle with a coloured border',
      'A rectangular marker with a coloured border and the road code at the top.',
      ['The border colour tracks the road size; national roads always have a red marker.'],
      ['es'],
      { kind: 'km-post', shape: 'plate', body: 'white', border: 'red' },
      'White rectangular kilometre marker with a red border',
      3
    ),
    post(
      'germany-blue',
      'Germany',
      'Blue marker on the motorway',
      'A blue rectangular marker with a white border, found on the Autobahn.',
      ['Federal and local roads use white markers with a black border.'],
      ['de'],
      { kind: 'km-post', shape: 'plate', body: 'blue', border: 'white' },
      'Blue rectangular kilometre marker with a white border',
      3
    ),
    post(
      'italy-roman',
      'Italy',
      'Roman numeral over the kilometre figure',
      'A white square with a Roman numeral above an Arabic number.',
      ['The Arabic number is the kilometre; the Roman numeral counts hundreds of metres from it.'],
      ['it'],
      { kind: 'km-post', shape: 'plate', body: 'white', border: 'black', roman: true },
      'White square marker with a small numeral above a larger number',
      2
    ),
    post(
      'argentina-strip',
      'Argentina',
      'White marker with a black top strip',
      'A white marker with a black strip across the top that carries the road number.',
      ['The code reads RN for a national route and RP for a provincial route.'],
      ['ar'],
      { kind: 'km-post', shape: 'plate', body: 'white', topBand: 'black' },
      'White kilometre marker with a black strip across the top',
      2
    ),
    post(
      'brazil-blue',
      'Brazil',
      'Blue marker with road and kilometre',
      'A blue marker at the roadside showing the road number and the kilometre.',
      ['It is the common Brazilian marker beside federal and state highways.'],
      ['br'],
      { kind: 'km-post', shape: 'plate', body: 'blue' },
      'Blue kilometre marker at the roadside',
      2
    ),
  ];

  const numbers: Clue[] = [
    numbering(
      'france-d-roads',
      'France',
      'Road numbers with a D prefix, on small yellow signs.',
      ['Small yellow signs with a D number sit on top of direction signs and town entry signs.', 'They mark départementale roads and are unique to France.'],
      ['fr'],
      ['D 906 · D 25 · D 117'],
      3
    ),
    numbering(
      'italy-ss-sp',
      'Italy',
      'Road numbers beginning SS, SR or SP.',
      ['SS is a state road, SR a regional road and SP a provincial road.'],
      ['it'],
      ['SS 16 · SP 40 · SR 429'],
      3
    ),
    numbering(
      'uk-a-b',
      'United Kingdom',
      'A and B roads whose first digit tells the area.',
      ['A380 and B3217 are both in the south-west: roads are grouped by their first digit.'],
      ['gb'],
      ['A380 · B3217 · A66'],
      2
    ),
    numbering(
      'usa-interstate',
      'United States',
      'Interstate numbers that show the direction of travel.',
      ['Even numbers run west to east and odd numbers run south to north; US highways use the reverse pattern for low numbers.'],
      ['us'],
      ['I-95 · I-80 · US 66'],
      3
    ),
    numbering(
      'south-africa-n-r',
      'South Africa',
      'N and R route numbers, with M for city routes.',
      ['On Google Maps the N roads show a blue pentagon instead of the letter.', 'Three-digit R roads are often grouped by region.'],
      ['za'],
      ['N2 · R61 · M13'],
      2
    ),
    numbering(
      'australia-alphanumeric',
      'Australia',
      'Alphanumeric route names such as M1, A2 and C222.',
      ['Australian highways carry a letter followed by a number.'],
      ['au'],
      ['M1 · A2 · B23 · C222'],
      2
    ),
  ];

  const clues = [...posts, ...numbers];

  linkConfusables(clues, 'km:', [
    ['france-semicircle', 'spain-border', 'French markers are white posts with a red or yellow semicircle; Spanish markers are flat rectangles with a coloured border.'],
    ['spain-border', 'germany-blue', 'A coloured border on white points to Spain; a solid blue marker points to Germany.'],
    ['germany-blue', 'brazil-blue', 'German markers are blue with a white border; Brazilian blue markers have no border and sit beside highways.'],
    ['italy-roman', 'argentina-strip', 'Italian markers carry a Roman numeral above the kilometre; Argentine markers have a black strip with the road code.'],
    ['argentina-strip', 'spain-border', 'A black top strip is Argentine; Spanish markers have a coloured border all round.'],
    ['france-d-roads', 'italy-ss-sp', 'French D numbers sit on small yellow signs; Italian numbers start with SS, SR or SP.'],
    ['uk-a-b', 'australia-alphanumeric', 'British roads are A and B with three or four digits; Australian ones include M, A, B and C with shorter numbers.'],
    ['usa-interstate', 'south-africa-n-r', 'The United States uses I and US numbers; South Africa uses N, R and M.'],
  ]);

  attachSources(clues, 'km:', {
    'france-semicircle': [plonkit('france', 'France')],
    'spain-border': [plonkit('spain', 'Spain')],
    'germany-blue': [plonkit('germany', 'Germany')],
    'italy-roman': [plonkit('italy', 'Italy')],
    'argentina-strip': [plonkit('argentina', 'Argentina')],
    'brazil-blue': [plonkit('brazil', 'Brazil')],
    'france-d-roads': [plonkit('france', 'France')],
    'italy-ss-sp': [plonkit('italy', 'Italy')],
    'uk-a-b': [plonkit('united-kingdom', 'United Kingdom')],
    'usa-interstate': [plonkit('united-states', 'United States')],
    'south-africa-n-r': [plonkit('south-africa', 'South Africa')],
    'australia-alphanumeric': [plonkit('australia', 'Australia')],
  });

  const lessons = [
    ...chunkLessons({ topicId: TOPIC_ID, baseId: 'km-posts-markers', title: 'Kilometre markers', summary: 'Shape, colour and numerals of roadside kilometre markers.', clues: posts, max: 6 }),
    ...chunkLessons({ topicId: TOPIC_ID, baseId: 'km-posts-numbers', title: 'Road numbering', summary: 'Prefixes and patterns that road numbers follow by country.', clues: numbers, max: 6 }),
  ];

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 4.2,
      title: 'Kilometre posts & road numbering',
      tagline: 'Roadside markers and the way each country numbers its roads.',
      why: 'Markers and route numbers sit on the roadside in most rounds. Their colour and shape tell countries apart, and the number itself often points to a region.',
      bestRegions: 'Europe, South America, Southern Africa',
      lessons,
    },
  };
}
