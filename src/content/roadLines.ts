import type { Clue, RoadVisual, Topic } from './types.ts';
import { chunkLessons } from './helpers.ts';

const TOPIC_ID = 'road-lines';
const GROUP = 'road-lines';

function clue(
  id: string,
  title: string,
  subtitle: string,
  spot: string,
  detail: string[],
  countryIds: string[],
  regions: Clue['regions'],
  visual: RoadVisual,
  value: 1 | 2 | 3,
  confidence: Clue['confidence'],
  alt: string
): Clue {
  return {
    id: `road:${id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title,
    subtitle,
    stem: 'Where would you expect a road marked like this?',
    spot,
    detail,
    regions,
    countryIds,
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
 * Road markings are among the most reliable clues because almost every round is on a road.
 * Each clue is a distinctive marking; the answer is the place it points to. Diagrams are schematic.
 */
export function buildRoadLines(): { topic: Topic; clues: Clue[] } {
  const clues: Clue[] = [
    clue(
      'norway-long-dash',
      'Norway',
      'Long dashes along the edges',
      'Long dashed lines along the outer edges of the road.',
      ['Norway is the only Northern European country with these long outside dashes.'],
      ['no'],
      ['Europe'],
      { kind: 'road', centre: 'white-dashed', edge: 'white-long-dash' },
      3,
      'high',
      'Road with long dashed edge lines and a dashed centre line'
    ),
    clue(
      'uk-zigzag',
      'United Kingdom',
      'Zigzag lines in towns',
      'Zigzag lines beside the kerb in urban areas.',
      ['Seen along crossings and bus stops; very common in the United Kingdom.'],
      ['gb'],
      ['Europe'],
      { kind: 'road', centre: 'white-dashed', edge: 'none', zigzag: true },
      2,
      'high',
      'Urban road with zigzag lines beside the kerb'
    ),
    clue(
      'southern-africa-yellow-edge',
      'Southern Africa',
      'Yellow outer edge lines',
      'Solid yellow lines along the outer edges of the road.',
      [
        'A strong clue across the south of Africa; yellow edge lines are also common in the Middle East.',
        'Treat it as a strong tendency rather than a rule.',
      ],
      ['za', 'bw', 'na', 'ls', 'sz', 'zw', 'zm'],
      ['Africa'],
      { kind: 'road', centre: 'white-dashed', edge: 'yellow' },
      3,
      'medium',
      'Road with solid yellow edge lines and a dashed white centre line'
    ),
    clue(
      'americas-double-yellow',
      'The Americas',
      'Double yellow centre line',
      'A double yellow line down the middle of the road.',
      ['The most common centre line in the United States, and widespread across the Americas.'],
      ['us', 'ca', 'mx', 'br', 'co', 'pe', 'cl', 'ar'],
      ['North America', 'South America'],
      { kind: 'road', centre: 'yellow-double', edge: 'white' },
      3,
      'medium',
      'Road with a double yellow centre line and white edge lines'
    ),
  ];

  const lessons = chunkLessons({
    topicId: TOPIC_ID,
    baseId: 'road-lines-core',
    title: 'Road lines that point somewhere',
    summary: 'Edge and centre line colours and patterns that narrow down a country or region.',
    clues,
    max: 6,
  });

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 3,
      title: 'Road lines',
      tagline: 'Centre and edge line colours and patterns.',
      why: 'Nearly every round is on a road, so line colour and pattern are among the most consistent clues. On their own they rarely settle a country, but combined with other clues they narrow it quickly.',
      bestRegions: 'Africa, the Americas, Northern Europe',
      lessons,
    },
  };
}
