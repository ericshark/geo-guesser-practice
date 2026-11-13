import type { TellSpec, WorldRegion } from '../data/types.ts';

/** A schematic road, drawn as SVG (lines are what matters, not realism). */
export interface RoadVisual {
  kind: 'road';
  centre: 'white-dashed' | 'yellow-double' | 'yellow-dashed' | 'none';
  edge: 'white' | 'yellow' | 'white-long-dash' | 'none';
  /** Urban zigzag lines along the kerb. */
  zigzag?: boolean;
}

/** A front and rear licence plate pair (colours and the side strip; no lettering). */
export interface PlateVisual {
  kind: 'plate';
  front: 'white' | 'yellow' | 'red';
  rear: 'white' | 'yellow' | 'red';
  strip: 'blue-left' | 'none';
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

/** A bundled photo (`public/media/<id>.jpg`); author and licence live in mediaCredits.json. */
export interface PhotoVisual {
  kind: 'photo';
  id: string;
}

export type Visual = RoadVisual | PlateVisual | BollardVisual | SignVisual | PhotoVisual;

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

/** Topics on the roadmap that are not built yet; shown as upcoming. */
export interface UpcomingTopic {
  id: string;
  order: number;
  title: string;
  tagline: string;
}
