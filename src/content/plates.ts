import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, Lesson, PlateVisual, Topic } from './types.ts';
import { attachSources, chunkLessons, linkConfusables, plonkit, wiki } from './helpers.ts';

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
      'yellow-strip',
      'Yellow with a blue strip',
      'Yellow plates on the front and the back, with a blue strip on the left.',
      ['This is the Dutch and Luxembourg look: the European strip on a yellow plate.'],
      ['nl', 'lu'],
      { kind: 'plate', front: 'yellow', rear: 'yellow', strip: 'blue-left' },
      'Yellow front and yellow rear plates with a blue strip on the left',
      3,
      'high'
    ),
    plateClue(
      'yellow-plain',
      'Yellow, no strip',
      'Yellow plates on the front and the back with no blue strip.',
      ['Colombia and Israel both put plain yellow plates on ordinary cars.'],
      ['co', 'il'],
      { kind: 'plate', front: 'yellow', rear: 'yellow', strip: 'none' },
      'Plain yellow front and rear plates',
      2,
      'medium'
    ),
    plateClue(
      'yellow-short',
      'Short yellow plates',
      'Short, almost square yellow plates.',
      [
        'In Japan only small “kei” cars carry yellow plates, with black lettering.',
        'In Laos short yellow plates are the normal plate on cars.',
      ],
      ['jp', 'la'],
      { kind: 'plate', front: 'yellow', rear: 'yellow', strip: 'none', shape: 'short' },
      'Short yellow front and rear plates',
      2,
      'medium'
    ),
    plateClue(
      'yellow-rear',
      'White front, yellow rear',
      'A white plate on the front and a yellow plate on the back.',
      [
        'Seen in the United Kingdom, Isle of Man, Hong Kong, Kenya, Rwanda and Sri Lanka.',
        'The Kenyan rear plate is almost square.',
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
      ['In Bhutan nearly all private plates are red, and taxis carry yellow ones.'],
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
        'Ireland has this look at the back too, which separates it from the United Kingdom.',
      ],
      ['de', 'fr', 'it', 'es', 'pl', 'pt', 'ie'],
      { kind: 'plate', front: 'white', rear: 'white', strip: 'blue-left' },
      'White front and rear plates with a blue strip on the left',
      2,
      'medium'
    ),
    plateClue(
      'black',
      'Black plates',
      'Plates with a black background and white characters.',
      [
        'Indonesian cars carry black plates, with the white lettering often reading as three groups.',
        'Malaysia is black too, usually with only two groups of characters.',
      ],
      ['id', 'my'],
      { kind: 'plate', front: 'black', rear: 'black', strip: 'none' },
      'Black front and rear plates',
      3,
      'high'
    ),
    plateClue(
      'mercosur',
      'White with a blue band on top',
      'White plates with a blue band across the top.',
      ['The shared Mercosur plate, seen in Argentina, Brazil, Uruguay and Paraguay.'],
      ['ar', 'br', 'uy', 'py'],
      { kind: 'plate', front: 'white', rear: 'white', strip: 'blue-top' },
      'White front and rear plates with a blue band along the top',
      2,
      'high'
    ),
    plateClue(
      'russia-region',
      'White with a region code at the side',
      'White plates with no blue strip and a small region code and flag at the right-hand end.',
      ['Russian plates are fully white with black characters; the number at the right is the region.'],
      ['ru'],
      { kind: 'plate', front: 'white', rear: 'white', strip: 'flag-right' },
      'White front and rear plates with a region code and flag at the right-hand end',
      2,
      'high'
    ),
    plateClue(
      'us-rear-only',
      'Rear plate only',
      'A plate on the back of the car and nothing on the front.',
      ['Around half of the American states do not require a front plate, so a bare bumper fits the United States.'],
      ['us'],
      { kind: 'plate', front: 'white', rear: 'white', strip: 'none', frontless: true },
      'A car with no front plate and a white rear plate',
      2,
      'high'
    ),
  ];

  linkConfusables(clues, 'plate:', [
    [
      'yellow-strip',
      'yellow-plain',
      'Dutch and Luxembourg yellow plates carry a blue strip on the left; Colombian and Israeli yellow plates do not.',
    ],
    [
      'yellow-plain',
      'yellow-short',
      'Colombian and Israeli plates are long; the Japanese kei and Lao plates are short and almost square.',
    ],
    [
      'yellow-rear',
      'eu-white',
      'A yellow rear plate points to the United Kingdom or East Africa; a white rear plate with a blue strip is continental European (or Irish).',
    ],
    [
      'eu-white',
      'russia-region',
      'The European plate has a blue strip on the left; the Russian plate has none and ends with a region code and a flag.',
    ],
    [
      'eu-white',
      'mercosur',
      'The European strip is at the left edge; the Mercosur band runs across the top of the plate.',
    ],
    [
      'black',
      'red',
      'Indonesian and Malaysian plates are black with white characters; Bhutan’s are red.',
    ],
    [
      'us-rear-only',
      'yellow-rear',
      'A missing front plate points to the United States; the United Kingdom and East Africa show a white front and a yellow rear plate.',
    ],
  ]);

  attachSources(clues, 'plate:', {
    'yellow-strip': [plonkit('netherlands', 'Netherlands'), plonkit('luxembourg', 'Luxembourg'), wiki('Vehicle_registration_plates_of_the_Netherlands', 'Vehicle registration plates of the Netherlands')],
    'yellow-short': [plonkit('japan', 'Japan'), plonkit('laos', 'Laos'), wiki('Vehicle_registration_plates_of_Japan', 'Vehicle registration plates of Japan')],
    'yellow-rear': [plonkit('ireland', 'Ireland'), plonkit('hong-kong', 'Hong Kong'), plonkit('kenya', 'Kenya'), wiki('Vehicle_registration_plates_of_the_United_Kingdom', 'Vehicle registration plates of the United Kingdom')],
    red: [plonkit('bhutan', 'Bhutan'), wiki('Vehicle_registration_plates_of_Bhutan', 'Vehicle registration plates of Bhutan')],
    'eu-white': [plonkit('ireland', 'Ireland'), plonkit('russia', 'Russia')],
    black: [plonkit('indonesia', 'Indonesia'), wiki('Vehicle_registration_plates_of_Malaysia', 'Vehicle registration plates of Malaysia')],
    mercosur: [plonkit('argentina', 'Argentina'), wiki('Mercosur', 'Mercosur')],
    'russia-region': [plonkit('russia', 'Russia'), wiki('Vehicle_registration_plates_of_Russia', 'Vehicle registration plates of Russia')],
    'us-rear-only': [plonkit('united-states', 'United States'), wiki('Vehicle_registration_plates_of_the_United_States', 'Vehicle registration plates of the United States')],
  });

  const lessons: Lesson[] = [
    ...chunkLessons({
      topicId: TOPIC_ID,
      baseId: 'plates-colours',
      title: 'Plate colours',
      summary: 'Colour patterns you can read even when the lettering is blurred.',
      clues: clues.slice(0, 5),
      max: 6,
    }),
    ...chunkLessons({
      topicId: TOPIC_ID,
      baseId: 'plates-details',
      title: 'Strips, bands and missing plates',
      summary: 'Small details on plates: where the strip sits, what is missing, and which colour is rare.',
      clues: clues.slice(5),
      max: 6,
    }),
  ];

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 6,
      title: 'Licence plates',
      tagline: 'Colours and patterns that narrow down a country.',
      why: 'Cars appear in most rounds, and plate colour stays readable when the text is blurred. A yellow plate or an unusual shape can settle a country that nothing else does.',
      bestRegions: 'Europe, East Africa, East Asia, South America',
      lessons,
    },
  };
}
