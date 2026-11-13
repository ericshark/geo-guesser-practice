export type CoverageTier = 'official' | 'limited' | 'none';

export type DrivingSide = 'left' | 'right';

export type WorldRegion = 'Europe' | 'Asia' | 'Oceania' | 'Africa' | 'Americas';

export type LanguageGroupId =
  | 'east-asian'
  | 'southeast-asian'
  | 'south-asian'
  | 'romance'
  | 'germanic'
  | 'central-slavic-hungarian'
  | 'cyrillic'
  | 'baltic-finnic'
  | 'mediterranean-middle-east-caucasus'
  | 'african';

export interface CurrencySpec {
  symbol: string;
  code: string;
  name: string;
  exampleSign: string;
  alternateSigns?: { symbol: string; exampleSign: string }[];
}

export interface PlayableCountry {
  id: string;
  name: string;
  region: WorldRegion;
  subregion: string;
  coverageTier: CoverageTier;
  coverageNote: string;
  drivingSide: DrivingSide;
  drivingNote?: string;
  signLanguages: string[];
  tld: string;
  tldExamples: string[];
  currencies: CurrencySpec[];
  isTerritory?: boolean;
  isTrapCountry?: boolean;
  coordinates: [number, number]; // [lat, lon]
}

export interface TellSpec {
  id: string;
  pattern: string;
  regex?: string;
  label: string;
  explanation: string;
  isUnique: boolean;
}

export type SampleKind = 'sentence' | 'sign';

export interface LanguageSample {
  id: string;
  text: string;
  translation: string;
  kind: SampleKind;
  tellIds: string[];
  structuralClue?: string;
}

export interface LanguageSpec {
  id: string;
  name: string;
  nativeName: string;
  groupId: LanguageGroupId;
  script: string;
  tells: TellSpec[];
  gestaltNote: string;
  contrastNote: string;
  candidateCountryIds: string[];
  uncoveredCountryNotes: string[];
  samples: LanguageSample[];
}

export interface LanguageGroupSpec {
  id: LanguageGroupId;
  name: string;
  description: string;
  primeSummary: string;
  languageIds: string[];
}

export interface TellSpanMatch {
  tellId: string;
  pattern: string;
  label: string;
  explanation: string;
  isUnique: boolean;
  colorIndex: number;
  spans: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}
