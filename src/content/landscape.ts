import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, Topic } from './types.ts';
import { attachSources, chunkLessons, linkConfusables, plonkit, wiki } from './helpers.ts';

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
      'Almost treeless green highland with bare volcanic mountains, often with snow on the peaks.',
      ['Only small patches of birch wood survive: mostly grass, moss and lava fields.', 'Small, brightly painted houses sit alone in the open.'],
      ['is'],
      'Treeless green lowland with bare volcanic mountains and a snow-capped peak',
      3,
      'medium'
    ),
    scene(
      'norway-fjord',
      'Norway',
      'landscape-norway',
      'A narrow, deep sea inlet between steep, forested mountain walls (a fjord).',
      ['Roads hug the water and climb in hairpins; green farmland sits in small patches along the shore.'],
      ['no'],
      'Turquoise fjord between steep green mountains with a switchback road',
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
      'medium'
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
    scene(
      'mongolia-steppe',
      'Mongolia',
      'landscape-mongolia',
      'Endless rolling grassland with no trees, low hills on the horizon and sparse fences or poles.',
      ['Kazakhstan has similar open steppe, so use plates, scripts and signs to separate them.'],
      ['mn', 'kz'],
      'Open green steppe with low hills and a lone telegraph pole',
      3,
      'medium'
    ),
    scene(
      'altiplano',
      'Bolivia and Peru',
      'landscape-altiplano',
      'A high, dry plateau of stony ground and bunch grass with snow peaks behind and adobe huts.',
      ['Eucalyptus planted in small clumps is typical; the thin air and treelessness mark the Andean altiplano.'],
      ['bo', 'pe'],
      'Gravel road across a high plateau with snow peaks, a lake and an adobe hut',
      3,
      'medium'
    ),
    scene(
      'patagonia',
      'Argentina and Chile',
      'landscape-patagonia',
      'Flat, wind-scoured steppe of golden tussock grass, with long fences and distant snow.',
      ['Wildlife such as guanacos is often in view. The far south of both countries looks like this.'],
      ['ar', 'cl'],
      'Golden tussock steppe under a pale sky with snow far away',
      2,
      'medium'
    ),
  ];

  linkConfusables(clues, 'landscape:', [
    ['iceland', 'norway-fjord', 'Iceland is treeless with bare volcanic slopes; Norwegian mountainsides are covered in forest and drop into fjords.'],
    ['mongolia-steppe', 'patagonia', 'Mongolia: smooth green grassland with low rounded hills. Patagonia: coarse golden tussock, often with fences and snow in view.'],
    ['altiplano', 'patagonia', 'The altiplano is high with snow peaks, adobe huts and lakes; Patagonia is a low flat steppe with long straight fences.'],
    ['australia', 'east-africa', 'Australia: red soil under low scrub. East Africa: pale golden grass under flat-topped acacia trees.'],
    ['southeast-asia', 'east-africa', 'Southeast Asia is wet and green with terraces; East Africa is dry and golden.'],
  ]);

  attachSources(clues, 'landscape:', {
    iceland: [wiki('Geography_of_Iceland', 'Geography of Iceland')],
    australia: [wiki('Outback')],
    'norway-fjord': [wiki('Fjord'), plonkit('norway', 'Norway')],
    'mongolia-steppe': [plonkit('mongolia', 'Mongolia'), wiki('Eurasian_Steppe', 'Eurasian steppe')],
    altiplano: [wiki('Altiplano'), plonkit('bolivia', 'Bolivia')],
    patagonia: [plonkit('argentina', 'Argentina'), wiki('Patagonian_Steppe', 'Patagonian steppe')],
  });

  const lessons = [
    ...chunkLessons({
      topicId: TOPIC_ID,
      baseId: 'landscape-signatures',
      title: 'Landscape signatures',
      summary: 'Broad scenery that points to a country or region.',
      clues: clues.slice(0, 5),
      max: 6,
    }),
    ...chunkLessons({
      topicId: TOPIC_ID,
      baseId: 'landscape-open-country',
      title: 'Steppe, plateau and fjord',
      summary: 'Treeless open country and dramatic terrain that narrows a region.',
      clues: clues.slice(5),
      max: 6,
    }),
  ];

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 9,
      title: 'Landscape & vegetation',
      tagline: 'Biomes, soil and signature trees.',
      why: 'Scenery is the main clue across much of the Americas and Africa, where countries are large and roads look alike. Soil colour, trees and terrain narrow a guess before any sign appears.',
      bestRegions: 'The Americas, Africa, Oceania, Central Asia',
      lessons,
    },
  };
}
