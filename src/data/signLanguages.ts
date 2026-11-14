import { LANGUAGE_MAP } from './index.ts';

/** Names for languages that appear on signs but have no recognition drill of their own yet. */
const EXTRA_LANGUAGE_NAMES: Record<string, string> = {
  // Languages used on signs that still have no drill of their own.
  dv: 'Dhivehi',
};

/** Human-readable name for a sign-language id, whether or not it has its own drill. */
export function signLanguageName(id: string): string {
  return LANGUAGE_MAP[id]?.name ?? EXTRA_LANGUAGE_NAMES[id] ?? id;
}

export function isKnownSignLanguage(id: string): boolean {
  return Boolean(LANGUAGE_MAP[id] ?? EXTRA_LANGUAGE_NAMES[id]);
}
