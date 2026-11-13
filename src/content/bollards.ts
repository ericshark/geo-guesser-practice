import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { BollardVisual, Clue, Topic } from './types.ts';
import { chunkLessons } from './helpers.ts';

const TOPIC_ID = 'bollards';
const GROUP = 'bollards';

function bollard(
  id: string,
  title: string,
  spot: string,
  detail: string[],
  countryIds: string[],
  visual: BollardVisual,
  alt: string,
  value: 1 | 2 | 3,
  confusables: Clue['confusables'] = []
): Clue {
  const known = countryIds.filter((c) => PLAYABLE_COUNTRY_MAP[c]);
  return {
    id: `bollard:${id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title,
    stem: 'Which bollard pattern is this?',
    spot,
    detail: [...detail, 'Diagrams are schematic: real bollards vary in shape and wear.'],
    regions: [...new Set(known.map((c) => PLAYABLE_COUNTRY_MAP[c].region))],
    countryIds: known,
    choiceGroup: GROUP,
    confusables,
    foils: [],
    stimuli: [{ text: alt, kind: 'plain', visual }],
    tells: [],
    value,
    confidence: 'high',
  };
}

/**
 * Bollards (the roadside posts) are one of the strongest clues in Europe. Each clue is a distinctive
 * marking; several countries can share one, and the feedback lists them.
 */
export function buildBollards(): { topic: Topic; clues: Clue[] } {
  const clues: Clue[] = [
    bollard(
      'red-rect-front',
      'Red rectangle on the front',
      'A red rectangle on the front, in the middle; the back has the same rectangle in white.',
      ['Hungary, Croatia, Bulgaria and North Macedonia share this design.', 'Slovakia has recently moved to a very similar one.'],
      ['hu', 'hr', 'bg', 'mk'],
      { kind: 'bollard', body: 'white', marking: 'red-rect-centre' },
      'White bollard with a red rectangle in the centre of the front',
      3,
      [{ clueId: 'bollard:red-rect-off-centre', howToTell: 'Check whether the red rectangle sits in the middle (these countries) or off to one side (Serbia).' }]
    ),
    bollard(
      'red-rect-off-centre',
      'Red rectangle off to one side',
      'A red rectangle placed to one side rather than in the middle.',
      ['Serbian bollards look like Slovenia’s and Montenegro’s, but the red rectangle is always off-centre.'],
      ['rs'],
      { kind: 'bollard', body: 'white', marking: 'red-rect-off-centre' },
      'White bollard with a red rectangle to one side of the front',
      2,
      [{ clueId: 'bollard:red-rect-front', howToTell: 'Serbia’s red rectangle is always to one side, never centred.' }]
    ),
    bollard(
      'red-diagonal',
      'Red diagonal stripe',
      'A red stripe running diagonally around the bollard.',
      ['The red diagonal wrapping around the post is the Polish design.'],
      ['pl'],
      { kind: 'bollard', body: 'white', marking: 'red-diagonal-stripe' },
      'White bollard with a red diagonal stripe',
      3
    ),
    bollard(
      'black-cap-dark-reflector',
      'Black cap and dark reflector',
      'A black "hat" on top and a blackish or dark red reflector on the front.',
      ['No other country combines both features, which makes Austria one of the easiest to spot.'],
      ['at'],
      { kind: 'bollard', body: 'white', marking: 'black-cap-dark-reflector' },
      'White bollard with a black top and a dark reflector',
      3
    ),
    bollard(
      'orange-stripes',
      'Orange stripes in the black part',
      'Fluorescent orange stripes in the black section of the bollard.',
      ['The back has a white rectangle in the black section.'],
      ['cz'],
      { kind: 'bollard', body: 'white', marking: 'black-lower-orange-stripes' },
      'White bollard with a black lower section and orange stripes',
      3
    ),
    bollard(
      'vertical-red-in-black',
      'Vertical red rectangle in a black diagonal',
      'A vertical red rectangle inside a black diagonal strip that reaches the top.',
      ['A rare design; the rear has a white rectangle instead of the red one.'],
      ['it', 'al'],
      { kind: 'bollard', body: 'white', marking: 'red-rect-in-black-diagonal' },
      'White bollard with a black diagonal strip holding a vertical red rectangle',
      2
    ),
    bollard(
      'red-white-bands',
      'Red and white sections',
      'A post painted in alternating red and white sections.',
      ['Bangladeshi bollards look like chimneys; Cambodian ones are red and white too, either striped or split in two.'],
      ['bd', 'kh'],
      { kind: 'bollard', body: 'red-white-bands', marking: 'none' },
      'Bollard painted in alternating red and white bands',
      2
    ),
    bollard(
      'yellow',
      'Yellow bollard',
      'A distinctly yellow bollard.',
      ['In Iceland the whole post is yellow with a distinct top edge; Danish bollards have a yellow section on the front that is absent at the back.'],
      ['is', 'dk'],
      { kind: 'bollard', body: 'yellow', marking: 'none' },
      'Yellow bollard',
      2
    ),
  ];

  const lessons = chunkLessons({
    topicId: TOPIC_ID,
    baseId: 'bollards-europe',
    title: 'Bollards of Europe and Asia',
    summary: 'Roadside post markings that identify a country.',
    clues,
    max: 4,
  });

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 5,
      title: 'Bollards',
      tagline: 'Roadside posts: the strongest clue in Europe.',
      why: 'Posts line the roads of much of Europe, and their colours and reflectors differ by country. A single bollard can settle a country that landscape and language cannot.',
      bestRegions: 'Europe, parts of Asia',
      lessons,
    },
  };
}
