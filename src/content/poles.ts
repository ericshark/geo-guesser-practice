import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, PoleVisual, Topic } from './types.ts';
import { chunkLessons } from './helpers.ts';

const TOPIC_ID = 'poles';
const GROUP = 'poles';

function pole(
  id: string,
  title: string,
  style: PoleVisual['style'],
  spot: string,
  detail: string[],
  countryIds: string[],
  alt: string,
  value: 1 | 2 | 3,
  confusables: Clue['confusables'] = []
): Clue {
  const known = countryIds.filter((c) => PLAYABLE_COUNTRY_MAP[c]);
  return {
    id: `pole:${id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title,
    stem: 'Which utility pole style is this?',
    spot,
    detail: [...detail, 'Diagrams are schematic: real poles vary and wear.'],
    regions: [...new Set(known.map((c) => PLAYABLE_COUNTRY_MAP[c].region))],
    countryIds: known,
    choiceGroup: GROUP,
    confusables,
    foils: [],
    stimuli: [{ text: alt, kind: 'plain', visual: { kind: 'pole', style } }],
    tells: [],
    value,
    confidence: 'high',
  };
}

/** Utility poles appear in nearly every rural round; shape and markings differ by country. */
export function buildPoles(): { topic: Topic; clues: Clue[] } {
  const clues: Clue[] = [
    pole(
      'holey-to-ground',
      'Holes down to the ground',
      'holey-to-ground',
      'A concrete pole with large see-through holes that run all the way to the ground.',
      ['The community calls these "holey poles"; they are common in Hungary and Romania.'],
      ['hu', 'ro'],
      'Concrete pole with large holes running to the ground',
      3,
      [{ clueId: 'pole:holey-above-ground', howToTell: 'Check the base: here the holes reach the ground, in Poland they stop about half a metre above it.' }]
    ),
    pole(
      'holey-above-ground',
      'Holes that stop above the ground',
      'holey-above-ground',
      'A concrete pole with large holes that stop about half a metre above the ground.',
      ['Polish poles are distinct from Hungary and Romania because the lowest part is solid.'],
      ['pl'],
      'Concrete pole with large holes ending above a solid base',
      3,
      [{ clueId: 'pole:holey-to-ground', howToTell: 'The base is solid in Poland; Hungary and Romania have holes all the way down.' }]
    ),
    pole(
      'yellow-black',
      'Yellow and black stripes',
      'yellow-black-stripes',
      'A pole with yellow and black stripes on its lower section.',
      ['Seen in Japan, South Korea, Taiwan and Colombia.', 'Stripes run to the ground in Taiwan but stop short in South Korea.'],
      ['jp', 'kr', 'tw', 'co'],
      'Pole with yellow and black stripes on the lower part',
      3
    ),
    pole(
      'white-base',
      'White-painted base',
      'white-base',
      'A pole whose bottom section is painted white.',
      ['Many Ukrainian poles have a white base; some Romanian ones do too, and so do poles in Curaçao.'],
      ['ua', 'ro'],
      'Dark pole with a white-painted base',
      2
    ),
    pole(
      'ladder',
      'Ladder-style indents',
      'ladder',
      'A square concrete pole with ladder-like indents down its length.',
      ['Common in Brazil, Chile, Ecuador, Spain, France, Cambodia and parts of West Africa.', 'Brazilian poles have more rungs than Chilean ones.'],
      ['br', 'cl', 'ec', 'es', 'fr', 'kh', 'sn', 'ng'],
      'Square concrete pole with ladder-like indents',
      2
    ),
    pole(
      'red-white',
      'Red and white stripes',
      'red-white-stripes',
      'A pole painted in red and white bands near the bottom.',
      ['Indonesian poles sometimes carry the red-and-white national flag colours.'],
      ['id'],
      'Pole painted in red and white bands',
      2
    ),
    pole(
      'crucifix',
      'Wooden crucifix pole',
      'crucifix',
      'A wooden pole with a long cross arm, shaped like a crucifix.',
      ['The most common pole type in the Philippines; also common in Mexico.'],
      ['ph', 'mx'],
      'Wooden pole with a long cross arm',
      2
    ),
    pole(
      'lattice',
      'Eiffel-tower lattice',
      'lattice',
      'A tapering steel lattice tower instead of a plain pole.',
      ['These Eiffel-tower-like poles are a common sight throughout Bulgaria.'],
      ['bg'],
      'Tapering steel lattice pole',
      2
    ),
  ];

  const lessons = chunkLessons({
    topicId: TOPIC_ID,
    baseId: 'poles-shapes',
    title: 'Pole shapes and markings',
    summary: 'Holes, stripes, colours and shapes that identify a country.',
    clues,
    max: 4,
  });

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 7,
      title: 'Utility poles',
      tagline: 'Pole and crossbar styles by region.',
      why: 'Poles line almost every road, including the empty ones with no signs. Their shape and markings are a dependable clue in Europe, Asia and Latin America, and often separate neighbouring countries.',
      bestRegions: 'Eastern Europe, East and Southeast Asia, Latin America',
      lessons,
    },
  };
}
