import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, Topic } from './types.ts';
import { chunkLessons } from './helpers.ts';

const TOPIC_ID = 'landscape';
const GROUP = 'landscape';

function scene(
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
    id: `landscape:${id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title,
    stem: 'Where is this landscape?',
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
 * Landscape is the main clue in much of the Americas and Africa. These are broad, well-known
 * signatures; photos are examples, not proof (each is credited on the Credits page).
 */
export function buildLandscape(): { topic: Topic; clues: Clue[] } {
  const clues: Clue[] = [
    scene(
      'iceland',
      'Iceland',
      'landscape-iceland',
      'Treeless green highland with bare volcanic mountains, often with snow on the peaks.',
      ['No forests: grass, moss and low shrubs.', 'Small, brightly painted houses sit alone in the open.'],
      ['is'],
      'Treeless green lowland with bare volcanic mountains and a snow-capped peak',
      3,
      'high'
    ),
    scene(
      'australia',
      'Australia',
      'landscape-australia',
      'Bright red-orange soil and dirt roads running through low scrub.',
      ['Red earth is the outback signature, especially in the centre and west.'],
      ['au'],
      'Straight red dirt road through low scrub',
      3,
      'high'
    ),
    scene(
      'east-africa',
      'East Africa',
      'landscape-kenya',
      'Dry golden grassland dotted with flat-topped acacia trees.',
      ['The umbrella-shaped acacia is the savanna signature of Kenya and Tanzania.', 'Other savanna regions exist, so pair it with car and road clues.'],
      ['ke', 'tz'],
      'Dry grassland with flat-topped acacia trees',
      3,
      'medium'
    ),
    scene(
      'southeast-asia',
      'Southeast Asia',
      'landscape-thailand',
      'Lush green hills cut into stepped rice terraces under dense tropical forest.',
      ['Terraced paddies are found across northern Thailand, Vietnam, Indonesia and the Philippines.'],
      ['th', 'vn', 'id', 'ph'],
      'Green rice terraces on a forested hillside',
      2,
      'medium'
    ),
  ];

  const lessons = chunkLessons({
    topicId: TOPIC_ID,
    baseId: 'landscape-signatures',
    title: 'Landscape signatures',
    summary: 'Broad scenery that points to a country or region.',
    clues,
    max: 4,
  });

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 9,
      title: 'Landscape & vegetation',
      tagline: 'Biomes, soil and signature trees.',
      why: 'Scenery is the main clue across much of the Americas and Africa, where countries are large and roads look alike. Soil colour, trees and terrain narrow a guess before any sign appears.',
      bestRegions: 'The Americas, Africa, Oceania',
      lessons,
    },
  };
}
