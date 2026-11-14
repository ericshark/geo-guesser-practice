import { PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { Clue, Topic } from './types.ts';
import { attachSources, chunkLessons, linkConfusables, plonkit, wiki } from './helpers.ts';

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
 * examples; each is credited on the Credits page. A clue is `high` only when two independent
 * references agree.
 */
export function buildVehicles(): { topic: Topic; clues: Clue[] } {
  const taxis: Clue[] = [
    vehicle(
      'hong-kong',
      'Hong Kong',
      'vehicle-hong-kong',
      'Red urban taxis; taxis in other areas are painted in other colours.',
      ['Hong Kong has a very large number of taxis, so you rarely go far without seeing one.'],
      ['hk'],
      'Red-and-white taxi beside a double-decker bus',
      3,
      'medium'
    ),
    vehicle(
      'thailand',
      'Thailand',
      'vehicle-thailand',
      'Bright pink taxis, with yellow-and-green ones as well, in Bangkok.',
      ['Tuk-tuks are common in the same streets.'],
      ['th'],
      'Pink taxis and a tuk-tuk on a Bangkok street at night',
      3,
      'medium'
    ),
    vehicle(
      'mexico',
      'Mexico City',
      'vehicle-mexico',
      'Taxis with a pink top half and a white lower half.',
      ['The roof sign reads TAXI and the bonnet often carries the city name.'],
      ['mx'],
      'Pink-and-white taxi in Mexico City',
      2,
      'medium'
    ),
    vehicle(
      'argentina',
      'Buenos Aires',
      'vehicle-argentina',
      'Black taxis with a yellow roof and yellow rear pillars.',
      ['Other Argentine cities have their own taxi colours.'],
      ['ar'],
      'Black taxi with a yellow roof',
      2,
      'medium'
    ),
  ];

  const transport: Clue[] = [
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
      'india',
      'India',
      'vehicle-india',
      'Three-wheeled auto-rickshaws with a black body and a yellow top.',
      ['Green-and-yellow ones also run on natural gas. Auto-rickshaws appear in nearby countries too, so check the plates and the signs.'],
      ['in'],
      'Black-and-yellow auto-rickshaw',
      3,
      'medium'
    ),
    vehicle(
      'peru',
      'Peru',
      'vehicle-peru',
      'Tuk-tuk style motorcycle taxis.',
      ['In South America these three-wheelers are most at home in Peru; Guatemala also has them.'],
      ['pe'],
      'Motorcycle tuk-tuk taxi',
      3,
      'medium'
    ),
    vehicle(
      'kenya',
      'Kenya',
      'vehicle-kenya',
      'Boxy minibuses covered in painted portraits and graffiti-style art (matatus).',
      ['Matatus are the main public transport in Kenyan towns; Kenya drives on the left.'],
      ['ke'],
      'Brightly painted matatu minibus',
      3,
      'medium'
    ),
  ];

  const trucks: Clue[] = [
    vehicle(
      'japan',
      'Japan',
      'vehicle-japan',
      'Tiny flat-bed trucks with a very short cab ("kei" trucks).',
      ['Kei vehicles carry short yellow plates, and these trucks work everywhere from farms to city lanes.'],
      ['jp'],
      'Small white kei truck with a short cab',
      2,
      'medium'
    ),
    vehicle(
      'pakistan',
      'Pakistan',
      'vehicle-pakistan',
      'Full-size lorries painted all over with ornate art, often with a decorated crown over the cab.',
      ['Truck art is a national tradition; bright patterns, flowers and calligraphy cover the sides and tail.'],
      ['pk'],
      'Brightly decorated truck on a road',
      2,
      'medium'
    ),
  ];

  const clues = [...taxis, ...transport, ...trucks];

  linkConfusables(clues, 'vehicle:', [
    ['hong-kong', 'mexico', 'Hong Kong taxis are red; Mexico City taxis are pink on top and white below.'],
    ['thailand', 'mexico', 'Bangkok taxis are bright pink (or yellow and green) all over; Mexico City taxis are only pink on the top half.'],
    ['mexico', 'argentina', 'Mexico City: pink and white. Buenos Aires: black with a yellow roof.'],
    ['philippines', 'kenya', 'Jeepneys are long open-sided minibuses with chrome and painted panels; matatus are boxy closed minibuses with large portraits and lights.'],
    ['peru', 'india', 'Peru’s tuk-tuks are motorcycle-fronted three-wheelers; Indian auto-rickshaws are black and yellow with a hard roof.'],
    ['bangladesh', 'india', 'Bangladesh: pedalled cycle rickshaws. India: motorised black-and-yellow auto-rickshaws.'],
    ['japan', 'pakistan', 'Kei trucks are small, plain and have a short yellow plate; Pakistani lorries are full size and covered in art.'],
  ]);

  attachSources(clues, 'vehicle:', {
    'hong-kong': [wiki('Taxis_of_Hong_Kong', 'Taxis of Hong Kong')],
    thailand: [plonkit('thailand', 'Thailand')],
    mexico: [plonkit('mexico', 'Mexico')],
    argentina: [plonkit('argentina', 'Argentina (taxi map)')],
    philippines: [plonkit('philippines', 'Philippines'), wiki('Jeepney')],
    bangladesh: [wiki('Cycle_rickshaw')],
    india: [wiki('Auto_rickshaw')],
    peru: [wiki('Tuk-tuk')],
    kenya: [wiki('Matatu')],
    japan: [plonkit('japan', 'Japan'), wiki('Kei_truck')],
    pakistan: [wiki('Truck_art_in_Pakistan')],
  });

  const lessons = [
    ...chunkLessons({ topicId: TOPIC_ID, baseId: 'vehicles-taxis', title: 'Taxis', summary: 'Taxi colours tied to a city or country.', clues: taxis, max: 6 }),
    ...chunkLessons({ topicId: TOPIC_ID, baseId: 'vehicles-transport', title: 'Rickshaws, tuk-tuks and minibuses', summary: 'Local public transport that points to a place.', clues: transport, max: 6 }),
    ...chunkLessons({ topicId: TOPIC_ID, baseId: 'vehicles-trucks', title: 'Trucks', summary: 'Working vehicles that are typical of one country.', clues: trucks, max: 6 }),
  ];

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 8,
      title: 'Vehicles & taxis',
      tagline: 'Local transport that gives a country away.',
      why: 'Wherever people live, vehicles appear. Taxi colours, rickshaws, minibuses and trucks are tied to particular countries and are often visible when nothing else is.',
      bestRegions: 'Asia, Africa, Latin America',
      lessons,
    },
  };
}
