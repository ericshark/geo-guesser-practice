import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, Topic } from './types.ts';
import { chunkLessons } from './helpers.ts';

const TOPIC_ID = 'vehicles';
const GROUP = 'vehicles';

function vehicle(
  id: string,
  title: string,
  photoId: string,
  spot: string,
  detail: string[],
  countryIds: string[],
  alt: string,
  value: 1 | 2 | 3,
  confidence: Clue['confidence']
): Clue {
  const known = countryIds.filter((c) => PLAYABLE_COUNTRY_MAP[c]);
  return {
    id: `vehicle:${id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title,
    stem: 'Which country do you expect to see this vehicle in?',
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
    confidence,
  };
}

/**
 * Local vehicles are visible in most inhabited rounds and are tied to places. Photos are
 * examples; each is credited on the Credits page.
 */
export function buildVehicles(): { topic: Topic; clues: Clue[] } {
  const clues: Clue[] = [
    vehicle(
      'hong-kong',
      'Hong Kong',
      'vehicle-hong-kong',
      'Red-and-white (urban) taxis; green taxis serve other areas.',
      ['Hong Kong has a very large number of red and green taxis, so you rarely go far without seeing one.'],
      ['hk'],
      'Red-and-white taxi beside a double-decker bus',
      3,
      'high'
    ),
    vehicle(
      'philippines',
      'Philippines',
      'vehicle-philippines',
      'Brightly decorated jeepney minibuses.',
      ['Colourful minibuses are common in the Philippines, as are rickshaw-style bikes with sidecars.'],
      ['ph'],
      'Brightly decorated jeepney',
      3,
      'high'
    ),
    vehicle(
      'bangladesh',
      'Bangladesh',
      'vehicle-bangladesh',
      'Cycle rickshaws: a bicycle at the front and two wheels behind a decorated seat.',
      ['Rickshaws like this appear in other parts of Asia, but they are especially common in Bangladesh, which drives on the left.'],
      ['bd'],
      'Decorated cycle rickshaw with a rider',
      2,
      'medium'
    ),
    vehicle(
      'peru',
      'Peru',
      'vehicle-peru',
      'Tuk-tuk style motorcycle taxis.',
      ['In Latin America, tuk-tuks point to Peru: no other Latin American country has them.'],
      ['pe'],
      'Motorcycle tuk-tuk taxi',
      3,
      'high'
    ),
  ];

  const lessons = chunkLessons({
    topicId: TOPIC_ID,
    baseId: 'vehicles-taxis',
    title: 'Taxis and local transport',
    summary: 'Vehicles tied to a country or city.',
    clues,
    max: 4,
  });

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 8,
      title: 'Vehicles & taxis',
      tagline: 'Local transport that gives a country away.',
      why: 'Wherever people live, vehicles appear. Taxi colours, rickshaws and tuk-tuks are tied to particular countries and are often visible when nothing else is.',
      bestRegions: 'Asia, Latin America',
      lessons,
    },
  };
}
