import type { TellSpec, WorldRegion } from '../data/types.ts';

/** A schematic road, drawn as SVG (lines are what matters, not realism). */
export interface RoadVisual {
  kind: 'road';
  centre: 'white-dashed' | 'yellow-double' | 'yellow-dashed' | 'yellow-solid' | 'yellow-white' | 'none';
  edge: 'white' | 'yellow' | 'yellow-dashed' | 'white-long-dash' | 'white-short-dash' | 'none';
  /** Urban zigzag lines along the kerb. */
  zigzag?: boolean;
}

/** A front and rear licence plate pair (colours and the side strip; no lettering). */
export interface PlateVisual {
  kind: 'plate';
  front: 'white' | 'yellow' | 'red' | 'black';
  rear: 'white' | 'yellow' | 'red' | 'black';
  strip: 'blue-left' | 'blue-top' | 'flag-right' | 'none';
  /** Short, almost square plates (kei cars, Laos). Plates are long by default. */
  shape?: 'long' | 'short';
  /** Only a rear plate is carried (many US states). */
  frontless?: boolean;
}

/** A roadside bollard, seen from the front. Schematic: the marking is what matters. */
export interface BollardVisual {
  kind: 'bollard';
  body: 'white' | 'yellow' | 'red-white-bands';
  marking:
    | 'none'
    | 'red-diagonal-stripe'
    | 'black-cap-dark-reflector'
    | 'black-lower-orange-stripes'
    | 'red-rect-centre'
    | 'red-rect-off-centre'
    | 'red-rect-in-black-diagonal';
}

/** A road sign reduced to its shape and colours (no pictograms or real text). */
export interface SignVisual {
  kind: 'sign';
  shape: 'triangle' | 'diamond' | 'square-with-triangle' | 'rectangle';
  fill: 'white' | 'yellow' | 'green';
  /** Colour of the border (warning signs) or of the placeholder lettering (direction signs). */
  accent: 'red' | 'black' | 'white';
}

/** A street name plate: colours, outline, shape and how it is mounted. */
export interface StreetSignVisual {
  kind: 'street-sign';
  bg: 'blue' | 'white' | 'green' | 'black';
  border: 'white' | 'blue' | 'black' | 'none';
  shape: 'rect' | 'arrow';
  /** A strip along the bottom (district, postcode or a painted post). */
  band?: 'black' | 'green' | 'blue' | 'red';
  /** Low plate on two short posts. */
  posts?: boolean;
}

/** A kilometre marker or route marker, reduced to its shape and colours. */
export interface KmPostVisual {
  kind: 'km-post';
  shape: 'post' | 'plate';
  body: 'white' | 'blue';
  border?: 'red' | 'black' | 'white' | 'orange';
  /** Semicircle on top of a post. */
  cap?: 'red' | 'yellow';
  /** Dark strip across the top (the road number). */
  topBand?: 'black';
  /** Roman numeral above the Arabic one (hundreds of metres over kilometres). */
  roman?: boolean;
}

/** A vehicle traffic signal head. */
export interface TrafficLightVisual {
  kind: 'traffic-light';
  orientation: 'vertical' | 'horizontal';
  housing: 'black' | 'yellow';
  /** A white outline round the housing. */
  outline?: boolean;
  /** Red square, amber diamond, green circle. */
  shapedLamps?: boolean;
  /** The go lamp is blue-green (Japan). */
  blueGreen?: boolean;
  /** A countdown display above the lamps. */
  countdown?: boolean;
  mount?: 'arm' | 'wires' | 'pole';
}

/** A pedestrian signal head. */
export interface PedSignalVisual {
  kind: 'ped-signal';
  style: 'hat-man' | 'walk-stand' | 'white-man-orange-hand';
}

/** A bundled photo (`public/media/<id>.jpg`); author and licence live in mediaCredits.json. */
export interface PhotoVisual {
  kind: 'photo';
  id: string;
}

/** A roadside utility pole, reduced to the feature that identifies it. */
export interface PoleVisual {
  kind: 'pole';
  style:
    | 'holey-to-ground'
    | 'holey-above-ground'
    | 'yellow-black-stripes'
    | 'white-base'
    | 'ladder'
    | 'red-white-stripes'
    | 'crucifix'
    | 'lattice';
}

export type Visual =
  | RoadVisual
  | PlateVisual
  | BollardVisual
  | SignVisual
  | PhotoVisual
  | PoleVisual
  | StreetSignVisual
  | KmPostVisual
  | TrafficLightVisual
  | PedSignalVisual;

/** One thing the learner is shown in a question (a sign, a web address, a price...). */
export interface Stimulus {
  /** When set, the stimulus is drawn instead of shown as text (`text` is the accessible label). */
  visual?: Visual;
  text: string;
  translation?: string;
  /** Rendering hint: signs get a bordered plate, `mono` is for web addresses and prices. */
  kind?: 'sign' | 'sentence' | 'plain';
  mono?: boolean;
  /** Tell ids (from `Clue.tells`) to highlight in the feedback. */
  tellIds?: string[];
}

/** A wrong answer that is not itself a clue (e.g. a right-hand-traffic country). */
export interface Foil {
  id: string;
  label: string;
  /** Shown in the feedback panel when the learner picks this foil. */
  note: string;
}

export interface Confusable {
  clueId: string;
  howToTell: string;
}

/**
 * The atomic unit of knowledge. Each clue is scheduled, scored and reviewed on its own.
 * A question shows one of the clue's stimuli and asks the learner to pick the clue
 * (via its `title`) out of the other clues in the same `choiceGroup`.
 */
export interface Clue {
  id: string;
  topicId: string;
  lessonId: string;
  /** Answer label shown on option tiles, e.g. "Portuguese" or "Kenya". */
  title: string;
  subtitle?: string;
  /** Question stem, e.g. "Which language is this?" */
  stem: string;
  /** One sentence: what to look for. */
  spot: string;
  /** At most three short supporting points. */
  detail: string[];
  regions: WorldRegion[];
  countryIds: string[];
  /** Clues sharing a choice group are offered as options for each other. */
  choiceGroup: string;
  confusables: Confusable[];
  foils: Foil[];
  stimuli: Stimulus[];
  tells: TellSpec[];
  /** Relative importance for GeoGuessr (3 = learn first). Orders new clues. */
  value: 1 | 2 | 3;
  /** `medium` clues are phrased as tendencies ("usually") rather than rules. */
  confidence: 'high' | 'medium';
  /** Independent references the clue was checked against (clues added or re-checked recently). */
  sources?: Source[];
}

export interface Source {
  title: string;
  url: string;
}

export interface Lesson {
  id: string;
  topicId: string;
  title: string;
  summary: string;
  clueIds: string[];
}

export interface Topic {
  id: string;
  order: number;
  title: string;
  tagline: string;
  /** Why this matters in an actual GeoGuessr round. */
  why: string;
  /** Where this topic is most decisive. */
  bestRegions: string;
  lessons: Lesson[];
}
