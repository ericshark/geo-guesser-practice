import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, Lesson, PlateVisual, Topic } from './types.ts';
import { chunkLessons } from './helpers.ts';

const TOPIC_ID = 'plates';
const GROUP = 'plates';

function plateClue(
  id: string,
  title: string,
  spot: string,
  detail: string[],
  countryIds: string[],
  visual: PlateVisual,
  alt: string,
  value: 1 | 2 | 3,
  confidence: Clue['confidence']
): Clue {
  const known = countryIds.filter((c) => PLAYABLE_COUNTRY_MAP[c]);
  return {
    id: `plate:${id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title,
    stem: 'Which plate pattern is this?',
    spot,
    detail,
    regions: [...new Set(known.map((c) => PLAYABLE_COUNTRY_MAP[c].region))],
    countryIds: known,
    choiceGroup: GROUP,
    confusables: [],
    foils: [],
    stimuli: [{ text: alt, kind: 'plain', visual }],
    tells: [],
    value,
    confidence,
  };
}

/**
 * Plate colours are readable even when the text is blurred. Patterns, not single countries, are
 * the unit: several countries share a pattern, and the feedback lists them.
 */
export function buildPlates(): { topic: Topic; clues: Clue[] } {
  const clues: Clue[] = [
    plateClue(
      'yellow-both',
      'Yellow front and rear',
      'Yellow plates on both the front and the back of ordinary cars.',
      [
        'Most cars carry yellow plates in the Netherlands, Luxembourg, Israel, Laos and Colombia.',
        'In the Netherlands, Luxembourg and Israel they also have a blue strip on the left.',
      ],
      ['nl', 'lu', 'il', 'la', 'co'],
      { kind: 'plate', front: 'yellow', rear: 'yellow', strip: 'blue-left' },
      'Yellow front and yellow rear plate',
      3,
      'high'
    ),
    plateClue(
      'yellow-rear',
      'White front, yellow rear',
      'A white plate on the front and a yellow plate on the back.',
      [
        'Seen in the United Kingdom, Isle of Man, Hong Kong, Kenya, Rwanda and Sri Lanka.',
        'In Hong Kong and Kenya the rear plate is almost square.',
      ],
      ['gb', 'im', 'hk', 'ke', 'rw', 'lk'],
      { kind: 'plate', front: 'white', rear: 'yellow', strip: 'none' },
      'White front plate and yellow rear plate',
      3,
      'high'
    ),
    plateClue(
      'red',
      'Red plates',
      'Plates with a red background.',
      ['Bhutan’s plates are a distinctive red, which no other country’s ordinary plates match.'],
      ['bt'],
      { kind: 'plate', front: 'red', rear: 'red', strip: 'none' },
      'Red front and rear plates',
      1,
      'high'
    ),
    plateClue(
      'eu-white',
      'White with a blue strip',
      'White plates with a blue strip on the left: the standard European plate.',
      [
        'Used across most of Europe, so on its own it only says "Europe".',
        'Yellow plates in this style are usually taxis or commercial vehicles (for example in Denmark, Hungary and Greece).',
      ],
      ['de', 'fr', 'it', 'es', 'pl', 'pt', 'dk', 'hu', 'gr'],
      { kind: 'plate', front: 'white', rear: 'white', strip: 'blue-left' },
      'White front and rear plates with a blue strip on the left',
      2,
      'high'
    ),
  ];

  const lessons: Lesson[] = chunkLessons({
    topicId: TOPIC_ID,
    baseId: 'plates-colours',
    title: 'Plate colours',
    summary: 'Colour patterns you can read even when the lettering is blurred.',
    clues,
    max: 6,
  });

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 6,
      title: 'Licence plates',
      tagline: 'Colours and patterns that narrow down a country.',
      why: 'Cars appear in most rounds, and plate colour stays readable when the text is blurred. A yellow plate or an unusual shape can settle a country that nothing else does.',
      bestRegions: 'Europe, East Africa, East Asia',
      lessons,
    },
  };
}
