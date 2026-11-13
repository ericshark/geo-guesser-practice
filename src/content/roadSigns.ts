import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, SignVisual, Topic } from './types.ts';
import { chunkLessons } from './helpers.ts';

const TOPIC_ID = 'road-signs';
const GROUP = 'road-signs';

function sign(
  id: string,
  title: string,
  spot: string,
  detail: string[],
  countryIds: string[],
  visual: SignVisual,
  alt: string,
  value: 1 | 2 | 3,
  confidence: Clue['confidence'],
  confusables: Clue['confusables'] = []
): Clue {
  const known = countryIds.filter((c) => PLAYABLE_COUNTRY_MAP[c]);
  return {
    id: `sign:${id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title,
    stem: 'Which sign style is this?',
    spot,
    detail: [...detail, 'Diagrams show shape and colour only; real signs vary.'],
    regions: [...new Set(known.map((c) => PLAYABLE_COUNTRY_MAP[c].region))],
    countryIds: known,
    choiceGroup: GROUP,
    confusables,
    foils: [],
    stimuli: [{ text: alt, kind: 'plain', visual }],
    tells: [],
    value,
    confidence,
  };
}

/**
 * Sign shape and colour tell you where you are before you can read a word. Clues are styles;
 * several countries share one, and the feedback lists them.
 */
export function buildRoadSigns(): { topic: Topic; clues: Clue[] } {
  const warnings: Clue[] = [
    sign(
      'yellow-diamond',
      'Yellow diamond warning sign',
      'A yellow, diamond-shaped warning sign.',
      [
        'Standard across the Americas, Australia and New Zealand, and also used in Japan.',
        'Ireland is the only European country with yellow diamond warning signs.',
      ],
      ['ie', 'jp', 'us', 'ca', 'mx', 'au', 'nz'],
      { kind: 'sign', shape: 'diamond', fill: 'yellow', accent: 'black' },
      'Yellow diamond-shaped warning sign',
      3,
      'high'
    ),
    sign(
      'triangle-yellow',
      'Triangle, red border, yellow fill',
      'A warning triangle with a red border and a yellow fill.',
      [
        'Seen in Finland, Sweden, Iceland and Greece.',
        'South Korea and Vietnam are the only Asian countries with this style.',
      ],
      ['fi', 'se', 'is', 'gr', 'kr', 'vn'],
      { kind: 'sign', shape: 'triangle', fill: 'yellow', accent: 'red' },
      'Warning triangle with a red border and yellow fill',
      3,
      'high',
      [{ clueId: 'sign:triangle-white', howToTell: 'Check the fill: yellow here, white in Norway and Denmark.' }]
    ),
    sign(
      'triangle-white',
      'Triangle, red border, white fill',
      'A warning triangle with a red border and a white fill.',
      ['The common European style. Norway and Denmark use it, which separates them from their yellow-fill Nordic neighbours.'],
      ['no', 'dk'],
      { kind: 'sign', shape: 'triangle', fill: 'white', accent: 'red' },
      'Warning triangle with a red border and white fill',
      2,
      'high',
      [{ clueId: 'sign:triangle-yellow', howToTell: 'The fill is white here; Finland, Sweden and Iceland use yellow.' }]
    ),
    sign(
      'square-triangle',
      'Triangle on a white square',
      'A red-bordered triangle drawn on a white square sign.',
      ['The white sign itself is square rather than triangular, which is unique to Singapore.'],
      ['sg'],
      { kind: 'sign', shape: 'square-with-triangle', fill: 'white', accent: 'red' },
      'Red-bordered warning triangle on a square white sign',
      2,
      'high'
    ),
  ];

  const directions: Clue[] = [
    sign(
      'direction-white-red',
      'White with red lettering',
      'A white direction sign with red lettering.',
      ['This colour scheme is a clear sign of Denmark.'],
      ['dk'],
      { kind: 'sign', shape: 'rectangle', fill: 'white', accent: 'red' },
      'White direction sign with red lettering',
      3,
      'high'
    ),
    sign(
      'direction-yellow-black',
      'Yellow with black lettering',
      'A yellow direction sign with black lettering.',
      [
        'Common in Slovenia, Montenegro, Serbia, North Macedonia, Croatia and Luxembourg.',
        'Also used for directions in Norway and Iceland.',
      ],
      ['si', 'me', 'rs', 'mk', 'hr', 'lu', 'no', 'is'],
      { kind: 'sign', shape: 'rectangle', fill: 'yellow', accent: 'black' },
      'Yellow direction sign with black lettering',
      2,
      'medium'
    ),
    sign(
      'direction-green-white',
      'Green with white lettering',
      'A green direction sign with white lettering.',
      ['Highway direction signs in Poland, South Africa, Botswana, South Korea, Taiwan and New Zealand.'],
      ['pl', 'za', 'bw', 'kr', 'tw', 'nz'],
      { kind: 'sign', shape: 'rectangle', fill: 'green', accent: 'white' },
      'Green direction sign with white lettering',
      2,
      'medium'
    ),
  ];

  const clues = [...warnings, ...directions];
  const lessons = [
    ...chunkLessons({
      topicId: TOPIC_ID,
      baseId: 'signs-warning',
      title: 'Warning signs',
      summary: 'Shape and fill colour of warning signs.',
      clues: warnings,
      max: 4,
    }),
    ...chunkLessons({
      topicId: TOPIC_ID,
      baseId: 'signs-direction',
      title: 'Direction signs',
      summary: 'Background and lettering colours of direction signs.',
      clues: directions,
      max: 4,
    }),
  ];

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 4,
      title: 'Road signs',
      tagline: 'Shapes and colours that differ by country.',
      why: 'Sign shape and colour can be read at a glance, before any text. A yellow diamond or a white-and-red direction sign settles a region in a second.',
      bestRegions: 'Europe, Asia-Pacific, the Americas',
      lessons,
    },
  };
}
