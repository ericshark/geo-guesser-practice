import { LANGUAGE_MAP } from './index.ts';

/** Names for languages that appear on signs but have no recognition drill of their own yet. */
const EXTRA_LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  sq: 'Albanian',
  ur: 'Urdu',
  fa: 'Persian',
  az: 'Azerbaijani',
  hy: 'Armenian',
  uz: 'Uzbek',
  my: 'Burmese',
  am: 'Amharic',
  ne: 'Nepali',
  dz: 'Dzongkha',
  kk: 'Kazakh',
  kl: 'Greenlandic',
  ms: 'Malay',
};

/** Human-readable name for a sign-language id, whether or not it has its own drill. */
export function signLanguageName(id: string): string {
  return LANGUAGE_MAP[id]?.name ?? EXTRA_LANGUAGE_NAMES[id] ?? id;
}

export function isKnownSignLanguage(id: string): boolean {
  return Boolean(LANGUAGE_MAP[id] ?? EXTRA_LANGUAGE_NAMES[id]);
}
