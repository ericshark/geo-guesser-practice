import { BookOpen, Camera, CarFront, Coins, House, Languages, type LucideIcon } from 'lucide-react';
import type { SectionId } from '../data/index.ts';

export interface SectionMeta {
  id: SectionId;
  title: string;
  shortTitle: string;
  tagline: string;
  icon: LucideIcon;
  /** CSS color token for this Section's identity color. */
  color: string;
  exampleClue: string;
}

/** Visual identity and friendly copy for each Section. */
export const SECTION_META: Record<SectionId, SectionMeta> = {
  languages: {
    id: 'languages',
    title: 'Languages',
    shortTitle: 'Languages',
    tagline: 'Read a sign, name the language.',
    icon: Languages,
    color: 'var(--sec-languages)',
    exampleClue: 'ß → German',
  },
  'driving-side': {
    id: 'driving-side',
    title: 'Driving Side',
    shortTitle: 'Driving',
    tagline: 'Left or right? Know it instantly.',
    icon: CarFront,
    color: 'var(--sec-driving)',
    exampleClue: 'Kenya → Left',
  },
  coverage: {
    id: 'coverage',
    title: 'Coverage',
    shortTitle: 'Coverage',
    tagline: 'Which countries can you actually land in?',
    icon: Camera,
    color: 'var(--sec-coverage)',
    exampleClue: 'Belarus → None',
  },
  'domains-currencies': {
    id: 'domains-currencies',
    title: 'Domains & Currencies',
    shortTitle: 'Domains',
    tagline: 'Spot .hr, zł and ฿ on shop signs.',
    icon: Coins,
    color: 'var(--sec-domains)',
    exampleClue: 'zł → Poland',
  },
};

export const SECTION_ORDER: SectionId[] = ['languages', 'driving-side', 'coverage', 'domains-currencies'];

export const DASHBOARD_ICON = House;
export const FIELD_GUIDE_ICON = BookOpen;
