import type { Clue, RoadVisual, Topic } from './types.ts';
import { attachSources, chunkLessons, geohints, linkConfusables, plonkit, wiki } from './helpers.ts';

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
 * A clue is `high` only when two independent references agree; otherwise it is phrased as a tendency.
 */
export function buildRoadLines(): { topic: Topic; clues: Clue[] } {
  const europe: Clue[] = [
    clue(
      'norway-long-dash',
      'Norway',
      'Long dashes along the edges',
      'Long dashes, with short gaps, along both outer edges of the road.',
      ['Compare the Netherlands, where the edge dashes are short and the gaps are about as long as the dashes.'],
      ['no'],
      ['Europe'],
      { kind: 'road', centre: 'white-dashed', edge: 'white-long-dash' },
      3,
      'medium',
      'Road with long dashed edge lines and a dashed centre line'
    ),
    clue(
      'uk-zigzag',
      'United Kingdom',
      'Zigzag lines in towns',
      'Zigzag lines beside the kerb in urban areas.',
      ['They mark no-stopping zones beside crossings and bus stops, and are very common in British towns.'],
      ['gb'],
      ['Europe'],
      { kind: 'road', centre: 'white-dashed', edge: 'none', zigzag: true },
      2,
      'medium',
      'Urban road with zigzag lines beside the kerb'
    ),
    clue(
      'ireland-yellow-dashes',
      'Ireland',
      'Yellow dashes along the edges',
      'Dashed yellow lines along the outside edges of the road.',
      [
        'Plonk It calls yellow edge dashes very common on Irish roads, with a white line down the middle.',
        'In and around towns, double yellow lines can run along the kerb.',
      ],
      ['ie'],
      ['Europe'],
      { kind: 'road', centre: 'white-dashed', edge: 'yellow-dashed' },
      3,
      'high',
      'Road with dashed yellow edge lines and a dashed white centre line'
    ),
    clue(
      'netherlands-short-dash-edge',
      'Netherlands',
      'Short dashes along the edges',
      'Short dashes, with gaps about as long as the dashes, along the outer edges.',
      ['Dutch roads are marked entirely in white, with broken lines at the edge rather than a solid one.'],
      ['nl'],
      ['Europe'],
      { kind: 'road', centre: 'white-dashed', edge: 'white-short-dash' },
      2,
      'high',
      'Road with short dashed white edge lines and a dashed white centre line'
    ),
  ];

  const world: Clue[] = [
    clue(
      'southern-africa-yellow-edge',
      'Southern Africa',
      'Solid yellow edge lines',
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
    clue(
      'japan-mexico-single-yellow',
      'Japan and Mexico',
      'One solid yellow centre line',
      'A single unbroken yellow line down the middle, with white lines at the edges.',
      [
        'Japan never has yellow outer lines, so yellow in the middle with white at the edge fits it.',
        'Mexico mixes this with single broken and double yellow centre lines.',
      ],
      ['jp', 'mx'],
      ['Asia', 'North America'],
      { kind: 'road', centre: 'yellow-solid', edge: 'white' },
      2,
      'medium',
      'Road with one solid yellow centre line and white edge lines'
    ),
    clue(
      'thailand-yellow-centre',
      'Thailand',
      'Yellow centre line',
      'A yellow centre line, solid or dashed, with white edge lines.',
      ['Thai centre lines come in both solid and dashed yellow.', 'Neighbouring Malaysia keeps all its road lines white.'],
      ['th'],
      ['Asia'],
      { kind: 'road', centre: 'yellow-dashed', edge: 'white' },
      2,
      'medium',
      'Road with a dashed yellow centre line and white edge lines'
    ),
    clue(
      'philippines-yellow-white',
      'Philippines',
      'Yellow and white side by side',
      'A yellow line and a white line running together down the middle.',
      [
        'Common in the Philippines, where the yellow often has an orange tint.',
        'Japan also uses it now and then, so check the plates and the driving side.',
      ],
      ['ph'],
      ['Asia'],
      { kind: 'road', centre: 'yellow-white', edge: 'white' },
      2,
      'medium',
      'Road with a solid yellow line beside a dashed white line down the middle'
    ),
  ];

  const clues = [...europe, ...world];

  linkConfusables(clues, 'road:', [
    [
      'norway-long-dash',
      'netherlands-short-dash-edge',
      'Norway: long dashes with short gaps along the edges. Netherlands: short dashes with gaps as long as the dashes.',
    ],
    [
      'ireland-yellow-dashes',
      'southern-africa-yellow-edge',
      'Ireland: the yellow edge line is broken into dashes. Southern Africa: the yellow edge line is solid.',
    ],
    [
      'uk-zigzag',
      'ireland-yellow-dashes',
      'The United Kingdom has white zigzags along the kerb; Ireland has yellow dashes along the road edge.',
    ],
    [
      'americas-double-yellow',
      'japan-mexico-single-yellow',
      'The Americas: two yellow lines in the middle. Japan and Mexico: a single yellow line in the middle.',
    ],
    [
      'thailand-yellow-centre',
      'philippines-yellow-white',
      'Thailand: only yellow in the middle. Philippines: a yellow line and a white line together.',
    ],
  ]);

  attachSources(clues, 'road:', {
    'ireland-yellow-dashes': [plonkit('ireland', 'Ireland'), geohints('lines', 'Road lines')],
    'netherlands-short-dash-edge': [plonkit('netherlands', 'Netherlands'), wiki('Road_surface_marking', 'Road surface marking')],
    'japan-mexico-single-yellow': [plonkit('japan', 'Japan'), plonkit('mexico', 'Mexico')],
    'thailand-yellow-centre': [plonkit('thailand', 'Thailand'), plonkit('indonesia', 'Indonesia (Malaysia comparison)')],
    'philippines-yellow-white': [plonkit('philippines', 'Philippines'), geohints('lines', 'Road lines')],
    'southern-africa-yellow-edge': [geohints('lines', 'Road lines')],
  });

  const lessons = [
    ...chunkLessons({
      topicId: TOPIC_ID,
      baseId: 'road-lines-europe',
      title: 'Road lines in Europe',
      summary: 'Edge-line patterns and zigzags that separate European countries.',
      clues: europe,
      max: 6,
    }),
    ...chunkLessons({
      topicId: TOPIC_ID,
      baseId: 'road-lines-world',
      title: 'Road lines beyond Europe',
      summary: 'Yellow and white centre and edge lines that point to a region.',
      clues: world,
      max: 6,
    }),
  ];

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 3,
      title: 'Road lines',
      tagline: 'Colours and patterns painted on the road.',
      why: 'Almost every round is on a road, and its markings are painted by national rules. Edge-line style and centre-line colour narrow a guess long before any sign appears.',
      bestRegions: 'Africa, the Americas, Northern Europe, East Asia',
      lessons,
    },
  };
}
