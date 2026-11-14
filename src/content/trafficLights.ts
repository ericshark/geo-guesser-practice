import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, PedSignalVisual, Topic, TrafficLightVisual } from './types.ts';
import { attachSources, chunkLessons, linkConfusables, plonkit, wiki } from './helpers.ts';

const TOPIC_ID = 'traffic-lights';

function light(
  id: string,
  title: string,
  subtitle: string,
  spot: string,
  detail: string[],
  countryIds: string[],
  visual: TrafficLightVisual | PedSignalVisual,
  alt: string,
  value: 1 | 2 | 3,
  confidence: Clue['confidence'] = 'medium'
): Clue {
  const known = countryIds.filter((c) => PLAYABLE_COUNTRY_MAP[c]);
  const pedestrian = visual.kind === 'ped-signal';
  return {
    id: `light:${id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title,
    subtitle,
    stem: pedestrian ? 'Where would you see a pedestrian signal like this?' : 'Where would you expect traffic lights like this?',
    spot,
    detail,
    regions: [...new Set(known.map((c) => PLAYABLE_COUNTRY_MAP[c].region))],
    countryIds: known,
    choiceGroup: 'traffic-lights',
    confusables: [],
    foils: [],
    stimuli: [{ text: alt, kind: 'plain', visual }],
    tells: [],
    value,
    confidence,
  };
}

/** Signal heads differ by orientation, housing, outline and mounting; pedestrian figures differ by country. */
export function buildTrafficLights(): { topic: Topic; clues: Clue[] } {
  const heads: Clue[] = [
    light(
      'japan-horizontal',
      'Japan',
      'Horizontal, with a blue-green go lamp',
      'A horizontal row of lamps whose go light is a blue-green, called blue in Japanese.',
      ['Vertical heads appear in Hokkaido and along the north-western coast, where snow is heavy.'],
      ['jp'],
      { kind: 'traffic-light', orientation: 'horizontal', housing: 'black', blueGreen: true, mount: 'pole' },
      'Horizontal traffic light with a blue-green go lamp',
      3,
      'high'
    ),
    light(
      'north-america-arm',
      'United States and Canada',
      'Heads hung over the road',
      'Signal heads hanging from long metal arms stretched over the junction.',
      ['The same arms often carry street name signs and other signs.'],
      ['us', 'ca'],
      { kind: 'traffic-light', orientation: 'vertical', housing: 'black', mount: 'arm' },
      'Vertical traffic light hung from a long overhead arm',
      3
    ),
    light(
      'michigan-wires',
      'Michigan',
      'Yellow heads on wires',
      'Yellow signal heads and signs hanging from wires strung across the junction.',
      ['Plonk It says many large Michigan intersections are signalled this way.'],
      ['us'],
      { kind: 'traffic-light', orientation: 'vertical', housing: 'yellow', mount: 'wires' },
      'Yellow traffic light hanging from wires',
      2
    ),
    light(
      'quebec-shapes',
      'Quebec and the Maritimes',
      'Horizontal, with shaped lamps',
      'A horizontal head whose lamps are different shapes: red square, amber diamond, green circle.',
      ['The shaped lamps were designed so colour-blind drivers can tell them apart.'],
      ['ca'],
      { kind: 'traffic-light', orientation: 'horizontal', housing: 'black', shapedLamps: true, mount: 'pole' },
      'Horizontal traffic light with a square red, diamond amber and round green lamp',
      2
    ),
    light(
      'australia-outline',
      'Australia',
      'White outline round the housing',
      'A signal head with a white outline round its frame.',
      ['Plonk It finds outlined heads in Western Australia, Queensland, New South Wales, the ACT and Tasmania; the central states have none.'],
      ['au'],
      { kind: 'traffic-light', orientation: 'vertical', housing: 'black', outline: true, mount: 'pole' },
      'Vertical traffic light with a white outline round the housing',
      2
    ),
    light(
      'countdown',
      'Vietnam and the Philippines',
      'Countdown display on the head',
      'A signal head with a number counting down the seconds to the change.',
      ['Countdown lamps are popular in Vietnam and China, and are also used in the Philippines.'],
      ['vn', 'ph'],
      { kind: 'traffic-light', orientation: 'vertical', housing: 'black', countdown: true, mount: 'pole' },
      'Vertical traffic light with a countdown display above it',
      2
    ),
  ];

  const people: Clue[] = [
    light(
      'ampelmann',
      'Germany (Ampelmännchen)',
      'The hatted pedestrian figure',
      'A pedestrian signal showing a little man wearing a hat.',
      ['It began in East Berlin and has spread to crossings in Berlin and other German cities; it is a nostalgic symbol of the former East Germany.'],
      ['de'],
      { kind: 'ped-signal', style: 'hat-man' },
      'Pedestrian signal with a green man wearing a hat',
      2
    ),
    light(
      'hand-walker',
      'North America (hand signal)',
      'White walker, orange hand',
      'A white walking figure for go and an orange hand for stop.',
      ['Older signals used the words WALK and DON’T WALK instead.'],
      ['us', 'ca'],
      { kind: 'ped-signal', style: 'white-man-orange-hand' },
      'Pedestrian signal with a white walking figure and an orange hand',
      3
    ),
    light(
      'green-red-man',
      'United Kingdom and Ireland (green man)',
      'Green walking man, red standing man',
      'A green walking man for go and a red standing man for stop.',
      ['In the United Kingdom, many lights use only these two images.'],
      ['gb', 'ie', 'hk', 'ch'],
      { kind: 'ped-signal', style: 'walk-stand' },
      'Pedestrian signal with a green walking man and a red standing man',
      2
    ),
  ];

  const clues = [...heads, ...people];

  linkConfusables(clues, 'light:', [
    ['japan-horizontal', 'quebec-shapes', 'Japan: round lamps with a blue-green go light. Quebec: a red square, an amber diamond and a green circle.'],
    ['north-america-arm', 'michigan-wires', 'Most North American heads hang from rigid arms; Michigan’s yellow heads hang from wires.'],
    ['australia-outline', 'north-america-arm', 'A white outline round a pole-mounted head is Australian; North American heads hang from arms and have no outline.'],
    ['countdown', 'australia-outline', 'The countdown number above the lamps points to Vietnam or the Philippines; Australian heads have only an outline.'],
    ['ampelmann', 'green-red-man', 'The East German figure wears a hat; the British-style figure is a plain walking man.'],
    ['hand-walker', 'green-red-man', 'American signals use a white figure and an orange hand; British-style signals use a green walking man and a red standing man.'],
  ]);

  attachSources(clues, 'light:', {
    'japan-horizontal': [plonkit('japan', 'Japan'), wiki('Traffic_light')],
    'north-america-arm': [plonkit('united-states', 'United States')],
    'michigan-wires': [plonkit('united-states', 'United States')],
    'quebec-shapes': [wiki('Traffic_light')],
    'australia-outline': [plonkit('australia', 'Australia')],
    countdown: [wiki('Traffic_light')],
    ampelmann: [wiki('Ampelm%C3%A4nnchen', 'Ampelmännchen'), wiki('Traffic_light')],
    'hand-walker': [wiki('Traffic_light')],
    'green-red-man': [wiki('Traffic_light')],
  });

  const lessons = [
    ...chunkLessons({ topicId: TOPIC_ID, baseId: 'traffic-lights-heads', title: 'Signal heads', summary: 'Orientation, mounting, outline and lamp shape of vehicle signals.', clues: heads, max: 6 }),
    ...chunkLessons({ topicId: TOPIC_ID, baseId: 'traffic-lights-people', title: 'Pedestrian signals', summary: 'The figure on the crossing signal tells countries apart.', clues: people, max: 6 }),
  ];

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 4.3,
      title: 'Traffic lights',
      tagline: 'Signal heads and pedestrian figures.',
      why: 'Traffic signals appear in every town. Whether they hang or stand, lie flat or upright, and what the pedestrian figure looks like, are decided nationally and are easy to spot.',
      bestRegions: 'Japan, North America, Australia, Germany',
      lessons,
    },
  };
}
