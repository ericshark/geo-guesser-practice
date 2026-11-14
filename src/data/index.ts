import { PLAYABLE_COUNTRIES } from './countries.ts';
import { LANGUAGES_EAST_SOUTH_ASIA } from './languages-east-south-asia.ts';
import { LANGUAGES_EUROPE } from './languages-europe.ts';
import { LANGUAGES_CYRILLIC_MED_AFRICA } from './languages-cyrillic-med-africa.ts';
import { LANGUAGES_MORE } from './languages-more.ts';
import { withExtraSamples } from './languageSamplesExtra.ts';
import type {
  LanguageGroupId,
  LanguageGroupSpec,
  LanguageSpec,
  PlayableCountry,
} from './types.ts';

export * from './types.ts';
export { findTellMatchesInSample, matchTells } from './tells.ts';
export { PLAYABLE_COUNTRIES };

export const PLAYABLE_COUNTRY_MAP: Record<string, PlayableCountry> = Object.fromEntries(
  PLAYABLE_COUNTRIES.map((country) => [country.id, country])
);

export const LANGUAGES: LanguageSpec[] = [
  ...LANGUAGES_EAST_SOUTH_ASIA,
  ...LANGUAGES_EUROPE,
  ...LANGUAGES_CYRILLIC_MED_AFRICA,
  ...LANGUAGES_MORE,
].map(withExtraSamples);

export const LANGUAGE_MAP: Record<string, LanguageSpec> = Object.fromEntries(
  LANGUAGES.map((lang) => [lang.id, lang])
);

export const LANGUAGE_GROUPS: LanguageGroupSpec[] = [
  {
    id: 'east-asian',
    name: 'East Asian',
    description: 'Distinguish Japanese, Korean, Simplified Chinese, and Traditional Chinese at a glance.',
    primeSummary:
      'Scan for script geometry first: circles in square syllable blocks (ㅇ/ㅎ) = Korean; curved kana loops (の/は/を) or angular Katakana (ー) mixed with Kanji = Japanese; uniform dense square Hanzi with no kana = Chinese (Simplified in SG/MY vs Traditional in TW/HK/MO).',
    languageIds: ['ja', 'ko', 'zh-hans', 'zh-hant'],
  },
  {
    id: 'southeast-asian',
    name: 'Southeast Asian',
    description: 'Tell apart Thai, Lao, Khmer, Burmese, Vietnamese, Indonesian, Malay, and Filipino/Tagalog.',
    primeSummary:
      'In Brahmic scripts: upright vertical stems with tiny terminal loops = Thai; wider rounded S/W/M curves = Lao; wavy top crowns + stacked subscript legs = Khmer. In Latin scripts: stacked tone marks + đ/ơ/ư = Vietnamese; standalone "ng"/"mga"/"Bawal" = Filipino; unadorned Latin with "Jalan"/"Dilarang" = Indonesian or Malay (kereta/kedai/tandas/sila = Malay; mobil/toko = Indonesian). Round bubble letters with small gaps (က/ဝ/စ) = Burmese.',
    languageIds: ['th', 'lo', 'km', 'my', 'vi', 'id', 'ms', 'tl'],
  },
  {
    id: 'south-asian',
    name: 'South Asian Scripts',
    description: 'Separate Hindi, Nepali, Urdu, Bengali, Tamil, Telugu, Sinhala, Gujarati, and Dzongkha.',
    primeSummary:
      'Check the top headline first: solid bar + boxy verticals = Hindi (Devanagari); solid bar + sharp diagonal triangles (ব/ক/র) = Bengali; Devanagari-like stems WITHOUT a top bar = Gujarati. In southern scripts: square corners + top dots (்) = Tamil; round bowls + ✓ checkmarks = Telugu; ultra-round curls + spiral ෙ (no ✓) = Sinhala. Nepali shares Devanagari but ends sentences in छ and writes सडक without a dot; Urdu is slanted Arabic script with ٹ/ڈ/ڑ; Dzongkha is beaded Tibetan script.',
    languageIds: ['hi', 'ne', 'ur', 'bn', 'ta', 'te', 'si', 'gu', 'dz'],
  },
  {
    id: 'romance',
    name: 'Romance',
    description: 'Spot the exact giveaways separating Portuguese, Spanish, Catalan, French, Italian, and Romanian.',
    primeSummary:
      'Look at nasal/palatal markers and endings: ã/õ/-ção/nh/lh = Portuguese; ñ/¡/¿/-ción = Spanish; l·l/ny/-ció/Carrer = Catalan; eau/aux/œ/Rue = French; doubled consonants (zz/tt/cc) + vowel endings + Via/Piazza = Italian; ă/â/î/ș/ț + -ul = Romanian.',
    languageIds: ['pt', 'es', 'ca', 'fr', 'it', 'ro'],
  },
  {
    id: 'germanic',
    name: 'Germanic',
    description: 'Discriminate German, Dutch, English, Swedish, Norwegian, Danish, Icelandic, and Greenlandic.',
    primeSummary:
      'Capitalized nouns + ß/ä/ö/ü = German; doubled vowels (aa/ee/oo) + ij = Dutch; å + ä + ö + "och" = Swedish; ø + æ + å with hard p/t/k (-gata/-veien) = Norwegian; ø + æ + å with soft b/d/g (-gade/-vej) = Danish; þ (thorn) + ð (eth) + acute vowels = Icelandic; plain unaccented the/of/and = English; lots of q + ll + long words = Greenlandic.',
    languageIds: ['de', 'nl', 'en', 'sv', 'no', 'da', 'is', 'kl'],
  },
  {
    id: 'central-slavic-hungarian',
    name: 'Central European Slavic & Hungarian',
    description: 'Resolve confusions across Polish, Czech, Slovak, Hungarian, Slovenian, and Croatian.',
    primeSummary:
      'Zero carons + ł/ą/ę/sz/cz/rz = Polish; zero carons + double acute ő/ű + sz/gy/utca = Hungarian; ř/ů/ě = Czech; ä/ô/ľ/ĺ/ŕ + -ie = Slovak; ć/đ + ije/Općina = Croatian; only č/š/ž (no ć/đ, no acute vowels) + "in" = Slovenian.',
    languageIds: ['pl', 'cs', 'sk', 'hu', 'sl', 'hr'],
  },
  {
    id: 'cyrillic',
    name: 'Cyrillic',
    description: 'Distinguish Russian, Ukrainian, Bulgarian, Serbian, Macedonian, Kazakh, Mongolian, and Kyrgyz.',
    primeSummary:
      'Check unique letters: і/ї/є/ґ (no ы) = Ukrainian; mid-word vowel ъ (България, път, no ы) = Bulgarian; ј/љ/њ + ћ/ђ = Serbian; ј/љ/њ + acute ќ/ѓ/ѕ = Macedonian; ө/ү + extreme doubled vowels (аа/өө/үү, no ң) = Mongolian; ө/ү + hooked ң (көчөсү) = Kyrgyz; standard ы/э/ъ (-ого/ул.) = Russian; ә/ғ/қ/ұ/һ = Kazakh.',
    languageIds: ['ru', 'uk', 'bg', 'sr', 'mk', 'kk', 'mn', 'ky'],
  },
  {
    id: 'baltic-finnic',
    name: 'Baltic & Finnic',
    description: 'Separate Finnish vs Estonian and Latvian vs Lithuanian.',
    primeSummary:
      'Finnic (doubled vowels aa/ee/ii/oo/uu): ä/ö + -tie/-katu (never õ or ü) = Finnish; õ + ü + tänav/mnt = Estonian. Baltic (single vowels + -s endings): flat macrons ā/ē/ī/ū + cedillas ķ/ļ/ņ + "iela" = Latvian; dotted ė + ogoneks ą/ę/į/ų + "gatvė" = Lithuanian.',
    languageIds: ['fi', 'et', 'lv', 'lt'],
  },
  {
    id: 'mediterranean-middle-east-caucasus',
    name: 'Mediterranean / Middle East / Caucasus',
    description: 'Recognize Greek, Turkish, Hebrew, Arabic, Persian, Georgian, Armenian, Azerbaijani, Uzbek, Albanian, and Maltese.',
    primeSummary:
      'Distinct scripts: Σ/Ω/Δ/Λ = Greek; unconnected square RTL blocks = Hebrew; connected cursive RTL with الـ = Arabic; rounded unicameral hooks (გ/თ/მ/ქ/წ) = Georgian. Latin scripts: dotless ı / dotted İ / ğ / ş = Turkish; crossed ħ + għ + ċ/ġ/ż + Triq/il- = Maltese. Arabic script with پ/چ/ژ/گ and است = Persian; own alphabet with capitals = Armenian; ə = Azerbaijani; oʻ/gʻ = Uzbek; ë + ç + rruga = Albanian.',
    languageIds: ['el', 'tr', 'he', 'ar', 'fa', 'ka', 'hy', 'az', 'uz', 'sq', 'mt'],
  },
  {
    id: 'african',
    name: 'African',
    description: 'Identify Swahili, Afrikaans, Zulu/Xhosa, Yoruba, and Amharic on African road signage.',
    primeSummary:
      'Connectors wa/ya/kwa + Barabara/Mtaa/Duka = Swahili (KE/UG); "die", "nie ... nie", "vir", ê/ô = Afrikaans (ZA); long prefix words (isi-/ama-/uku-/Kwa-) with hl/dl/xh/nq = Zulu/Xhosa (ZA/SZ); subdots ẹ/ọ/ṣ + tone accents + gb/Ilé = Yoruba (NG); boxy syllable characters with small feet (ሀ/ሰ/በ) = Amharic (ET).',
    languageIds: ['sw', 'af', 'zu', 'yo', 'am'],
  },
];

export const LANGUAGE_GROUP_MAP: Record<LanguageGroupId, LanguageGroupSpec> = Object.fromEntries(
  LANGUAGE_GROUPS.map((group) => [group.id, group])
) as Record<LanguageGroupId, LanguageGroupSpec>;

export function getLanguagesForGroupSelection(groupId: LanguageGroupId | 'all-mixed'): LanguageSpec[] {
  if (groupId === 'all-mixed') return LANGUAGES;
  const group = LANGUAGE_GROUP_MAP[groupId];
  return group ? group.languageIds.map((id) => LANGUAGE_MAP[id]).filter(Boolean) : LANGUAGES;
}
