import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, StreetSignVisual, Topic } from './types.ts';
import { attachSources, chunkLessons, linkConfusables, plonkit } from './helpers.ts';

const TOPIC_ID = 'street-names';
const GROUP = 'street-names';

function street(
  id: string,
  title: string,
  subtitle: string,
  spot: string,
  detail: string[],
  countryIds: string[],
  visual: StreetSignVisual,
  alt: string,
  value: 1 | 2 | 3
): Clue {
  const known = countryIds.filter((c) => PLAYABLE_COUNTRY_MAP[c]);
  return {
    id: `street:${id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title,
    subtitle,
    stem: 'Where would you expect street name plates like this?',
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
    // Plates change from town to town, so every clue here is a tendency, not a rule.
    confidence: 'medium',
  };
}

/** Street name plates differ by colour, outline, shape and mounting; many countries have a house style. */
export function buildStreetNames(): { topic: Topic; clues: Clue[] } {
  const clues: Clue[] = [
    street(
      'netherlands-blue',
      'Netherlands',
      'Blue plates, white lettering',
      'A plain blue plate with white lettering.',
      ['Some Dutch towns use yellow, white or green plates, but blue is the common one.'],
      ['nl'],
      { kind: 'street-sign', bg: 'blue', border: 'none', shape: 'rect' },
      'Plain blue street name plate',
      3
    ),
    street(
      'france-paris',
      'France',
      'Blue enamel plates',
      'A blue plate with white lettering and a white border, often fixed to a wall.',
      ['Paris-style enamelled plates are the model; other French towns vary in colour and style.'],
      ['fr'],
      { kind: 'street-sign', bg: 'blue', border: 'white', shape: 'rect' },
      'Blue street name plate with a white border',
      2
    ),
    street(
      'germany-blue',
      'Germany',
      'Blue plates with a white outline',
      'A blue plate with a white outline, sometimes with a separate strip for house numbers.',
      ['Munich, Dortmund and Frankfurt use blue; Berlin uses white with a grey border and Stuttgart uses black plates. Each city has its own style.'],
      ['de'],
      { kind: 'street-sign', bg: 'blue', border: 'white', shape: 'rect', band: 'blue' },
      'Blue street name plate with a white outline and a house-number strip',
      2
    ),
    street(
      'uk-white-low',
      'United Kingdom',
      'Low white plates on posts',
      'A white plate with black lettering, set low on short posts or on a wall.',
      ['Suburban plates often carry a small cul-de-sac symbol, and London ones add the postcode and borough in red.'],
      ['gb'],
      { kind: 'street-sign', bg: 'white', border: 'none', shape: 'rect', posts: true },
      'White street name plate on two short posts',
      3
    ),
    street(
      'italy-blue-border',
      'Italy',
      'White with a thin blue border',
      'A white plate with black lettering and a thin blue border.',
      ['The plates are often fixed to a wall, at first-floor height.'],
      ['it'],
      { kind: 'street-sign', bg: 'white', border: 'blue', shape: 'rect' },
      'White street name plate with a thin blue border',
      2
    ),
    street(
      'korea-arrow',
      'South Korea',
      'Blue arrow-shaped plates',
      'A blue plate with a pointed end, hung from a bar fixed to a pole.',
      ['The arrow tells you which way the street runs.'],
      ['kr'],
      { kind: 'street-sign', bg: 'blue', border: 'white', shape: 'arrow' },
      'Blue arrow-shaped street name plate',
      2
    ),
    street(
      'usa-green',
      'United States',
      'Green plates at junctions',
      'A green plate with white lettering, on a post or hung from a mast arm over the junction.',
      ['Many cities use their own colours, but green is the standard one.'],
      ['us'],
      { kind: 'street-sign', bg: 'green', border: 'none', shape: 'rect' },
      'Green street name plate',
      3
    ),
    street(
      'thailand-black-bottom',
      'Thailand',
      'Bulky white plate, black base',
      'A bulky white plate whose lower part is painted black.',
      ['Bangkok and Nonthaburi have their own blue plates with a green strip.'],
      ['th'],
      { kind: 'street-sign', bg: 'white', border: 'none', shape: 'rect', band: 'black' },
      'White street name plate with a black strip at the bottom',
      2
    ),
  ];

  linkConfusables(clues, 'street:', [
    ['netherlands-blue', 'france-paris', 'The Dutch plate is a plain blue rectangle; the French plate has a white border.'],
    ['france-paris', 'germany-blue', 'French plates sit on walls and carry no number strip; German plates often add a separate strip for house numbers.'],
    ['germany-blue', 'netherlands-blue', 'A white outline and a house-number strip point to Germany; a plain blue plate points to the Netherlands.'],
    ['korea-arrow', 'netherlands-blue', 'Korean plates are pointed at one end and hang from a bar; Dutch plates are plain rectangles.'],
    ['uk-white-low', 'italy-blue-border', 'British plates stand low on posts with no border; Italian plates have a thin blue border and sit on walls.'],
    ['usa-green', 'netherlands-blue', 'Green plates at junctions are American; blue plates are European or Korean.'],
    ['thailand-black-bottom', 'uk-white-low', 'The Thai plate is bulky with a black base; the British plate is low, on two small posts, with no black.'],
  ]);

  attachSources(clues, 'street:', {
    'netherlands-blue': [plonkit('netherlands', 'Netherlands')],
    'germany-blue': [plonkit('germany', 'Germany')],
    'uk-white-low': [plonkit('united-kingdom', 'United Kingdom')],
    'italy-blue-border': [plonkit('italy', 'Italy')],
    'korea-arrow': [plonkit('south-korea', 'South Korea')],
    'thailand-black-bottom': [plonkit('thailand', 'Thailand')],
  });

  const lessons = [
    ...chunkLessons({ topicId: TOPIC_ID, baseId: 'street-names-europe', title: 'Street plates in Europe', summary: 'Colour, outline and mounting of European street name plates.', clues: clues.slice(0, 5), max: 6 }),
    ...chunkLessons({ topicId: TOPIC_ID, baseId: 'street-names-world', title: 'Street plates elsewhere', summary: 'Pointed, green and bulky plates from Asia and North America.', clues: clues.slice(5), max: 6 }),
  ];

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 4.1,
      title: 'Street-name sign styles',
      tagline: 'Colour, shape and mounting of street name plates.',
      why: 'Street name plates appear in every town and are designed locally. Colour, outline, shape and height often tell countries (and sometimes cities) apart even when the words are blurred.',
      bestRegions: 'Europe, East Asia, North America',
      lessons,
    },
  };
}
