import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, Topic } from './types.ts';
import { chunkLessons } from './helpers.ts';

const TOPIC_ID = 'architecture';
const GROUP = 'architecture';

function building(
  id: string,
  title: string,
  subtitle: string,
  photoId: string,
  spot: string,
  detail: string[],
  countryIds: string[],
  alt: string,
  value: 1 | 2 | 3
): Clue {
  const known = countryIds.filter((c) => PLAYABLE_COUNTRY_MAP[c]);
  return {
    id: `arch:${id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title,
    subtitle,
    stem: 'Where would you expect to see buildings like this?',
    spot,
    detail,
    regions: [...new Set(known.map((c) => PLAYABLE_COUNTRY_MAP[c].region))],
    countryIds: known,
    choiceGroup: GROUP,
    confusables: [],
    foils: [],
    stimuli: [{ text: alt, kind: 'plain', visual: { kind: 'photo', id: photoId } }],
    tells: [],
    value,
    confidence: 'high',
  };
}

/** Roofs and building styles that can be read from far away. Photos are examples, credited on the Credits page. */
export function buildArchitecture(): { topic: Topic; clues: Clue[] } {
  const clues: Clue[] = [
    building(
      'trulli',
      'Italy',
      'Apulia',
      'arch-italy-trullo',
      'Cone-shaped stone roofs on small whitewashed buildings (trulli).',
      ['Found in a small part of Apulia, so a trullo gives you a very close guess in southern Italy.'],
      ['it'],
      'Whitewashed stone building with cone-shaped stone roofs in a wheat field',
      3
    ),
    building(
      'horreo',
      'Spain',
      'Asturias',
      'arch-spain-horreo',
      'Small wooden granaries raised on stone pillars (hórreos).',
      ['Very common in the northern region of Asturias.'],
      ['es'],
      'Wooden granary raised on stone pillars beside a village road',
      3
    ),
    building(
      'wood-houses',
      'Eastern North America',
      'United States and Canada',
      'arch-canada-wood',
      'One or two storey houses clad in painted wooden boards.',
      ['Wooden houses like this are typical of the eastern United States and Canada.'],
      ['us', 'ca'],
      'Painted wooden clapboard house with a front porch',
      2
    ),
    building(
      'black-roofs',
      'Luxembourg',
      'Black tiled roofs',
      'arch-luxembourg',
      'Dark, almost black tiled roofs on plain white houses.',
      ['The vast majority of buildings in Luxembourg have a black tiled roof.'],
      ['lu'],
      'White house with a dark slate-tiled roof',
      2
    ),
  ];

  const lessons = chunkLessons({
    topicId: TOPIC_ID,
    baseId: 'architecture-roofs',
    title: 'Roofs and building styles',
    summary: 'Distinctive buildings that place you in a country or region.',
    clues,
    max: 4,
  });

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 10,
      title: 'Architecture',
      tagline: 'Roofs, fences and building styles.',
      why: 'Any building is a clue. Roof shape and material can be seen from far away, and some regions have buildings found nowhere else, which gives very close guesses.',
      bestRegions: 'Europe, North America',
      lessons,
    },
  };
}
