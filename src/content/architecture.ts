import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, Topic } from './types.ts';
import { attachSources, chunkLessons, linkConfusables, plonkit, wiki } from './helpers.ts';

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
  value: 1 | 2 | 3,
  confidence: Clue['confidence'] = 'high'
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
    confidence,
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
      3,
      'medium'
    ),
    building(
      'horreo',
      'Spain',
      'Asturias',
      'arch-spain-horreo',
      'Small wooden granaries raised on stone pillars (hórreos).',
      ['Most common in Galicia and Asturias, in the north-west of Spain.'],
      ['es'],
      'Wooden granary raised on stone pillars beside a village road',
      3,
      'medium'
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
      2,
      'medium'
    ),
    building(
      'black-roofs',
      'Luxembourg',
      'Black tiled roofs',
      'arch-luxembourg',
      'Dark slate roofs on plain white houses.',
      ['The plain white, grey or pastel walls are typical too; the look also reaches nearby Belgium and France but is strongest in Luxembourg.'],
      ['lu'],
      'White house with a dark slate-tiled roof',
      2,
      'medium'
    ),
    building(
      'dutch-brick',
      'Netherlands',
      'Brick row houses',
      'arch-netherlands',
      'Tall terraces of red-brown brick with big windows, right on the pavement.',
      ['Brick is the default Dutch building material, and rows of attached houses line the streets.'],
      ['nl'],
      'Terrace of dark red-brown brick houses with bicycles on the pavement',
      2
    ),
    building(
      'greek-whitewash',
      'Greece',
      'Whitewashed island villages',
      'arch-greece',
      'Cube-shaped whitewashed houses, often with a blue-domed chapel and blue shutters.',
      ['The look is typical of the Cycladic islands such as Santorini.'],
      ['gr'],
      'Whitewashed houses and a blue-domed church above a bay',
      3,
      'medium'
    ),
    building(
      'turf-roofs',
      'Faroe Islands and Iceland',
      'Turf roofs',
      'arch-faroe-turf',
      'Grass growing on the roof of a small timber house.',
      ['Turf roofs are traditional in the Faroe Islands and in Iceland.'],
      ['fo', 'is'],
      'Timber house with a grass-covered roof beside the sea',
      3,
      'medium'
    ),
    building(
      'bali-gates',
      'Indonesia',
      'Bali',
      'arch-bali',
      'A temple gateway split in two, with carved dark stone, guardian statues and thatched pavilions.',
      ['Split gateways (candi bentar) and tiered roofs are the signature of Balinese Hindu temples.'],
      ['id'],
      'A split temple gate with guardian statues and thatched pavilions',
      3
    ),
    building(
      'alpine-chalet',
      'Switzerland and Austria',
      'Wooden chalets',
      'arch-swiss-chalet',
      'Dark timber houses with wide overhanging roofs and balconies on green mountain slopes.',
      ['Chalets are typical of the Alps, so they point to Switzerland, Austria and the neighbouring mountain regions.'],
      ['ch', 'at'],
      'Brown timber chalets with balconies on a green mountain slope',
      2,
      'medium'
    ),
  ];

  linkConfusables(clues, 'arch:', [
    ['trulli', 'greek-whitewash', 'Trulli are cone-shaped grey stone roofs; Greek island houses are flat-roofed whitewashed cubes with blue accents.'],
    ['horreo', 'alpine-chalet', 'A hórreo is a small granary on stone pillars; an Alpine chalet is a full timber house with a broad roof and balconies.'],
    ['wood-houses', 'alpine-chalet', 'American clapboard houses are painted boards on a plain box; chalets are dark carved timber with deep eaves and balconies.'],
    ['black-roofs', 'dutch-brick', 'Luxembourg: white walls with a black roof. Netherlands: red-brown brick walls.'],
    ['turf-roofs', 'wood-houses', 'A grass roof settles it: Faroese and Icelandic houses are timber with turf, while American houses have shingles.'],
    ['bali-gates', 'greek-whitewash', 'Bali: dark carved stone, split gates and thatch. Greece: plain whitewashed walls with blue accents.'],
  ]);

  attachSources(clues, 'arch:', {
    trulli: [wiki('Trullo')],
    horreo: [wiki('H%C3%B3rreo', 'Hórreo')],
    'black-roofs': [plonkit('luxembourg', 'Luxembourg')],
    'dutch-brick': [plonkit('netherlands', 'Netherlands'), wiki('Dutch_architecture', 'Dutch architecture')],
    'greek-whitewash': [wiki('Cycladic_architecture', 'Cycladic architecture')],
    'turf-roofs': [wiki('Turf_house', 'Turf house'), plonkit('faroe-islands', 'Faroe Islands')],
    'bali-gates': [plonkit('indonesia', 'Indonesia'), wiki('Candi_bentar')],
    'alpine-chalet': [wiki('Chalet')],
  });

  const lessons = [
    ...chunkLessons({
      topicId: TOPIC_ID,
      baseId: 'architecture-roofs',
      title: 'Roofs and building styles',
      summary: 'Distinctive buildings that place you in a country or region.',
      clues: clues.slice(0, 5),
      max: 6,
    }),
    ...chunkLessons({
      topicId: TOPIC_ID,
      baseId: 'architecture-regions',
      title: 'Regional building traditions',
      summary: 'Whitewash, turf, temples and chalets: styles tied to one region.',
      clues: clues.slice(5),
      max: 6,
    }),
  ];

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 10,
      title: 'Architecture',
      tagline: 'Roofs, fences and building styles.',
      why: 'Any building is a clue. Roof shape and material can be seen from far away, and some regions have buildings found nowhere else, which gives very close guesses.',
      bestRegions: 'Europe, North America, Indonesia',
      lessons,
    },
  };
}
