import { PLAYABLE_COUNTRIES } from './countries.ts';
import { LANGUAGES_EAST_SOUTH_ASIA } from './languages-east-south-asia.ts';
import { LANGUAGES_EUROPE } from './languages-europe.ts';
import { LANGUAGES_CYRILLIC_MED_AFRICA } from './languages-cyrillic-med-africa.ts';
import type {
  LanguageGroupId,
  LanguageGroupSelectionId,
  LanguageGroupSpec,
  LanguageSample,
  LanguageSpec,
  PlayableCountry,
  SectionId,
  TellSpanMatch,
} from './types.ts';

export * from './types.ts';
export { PLAYABLE_COUNTRIES };

export const PLAYABLE_COUNTRY_MAP: Record<string, PlayableCountry> = Object.fromEntries(
  PLAYABLE_COUNTRIES.map((country) => [country.id, country])
);

export const LANGUAGES: LanguageSpec[] = [
  ...LANGUAGES_EAST_SOUTH_ASIA,
  ...LANGUAGES_EUROPE,
  ...LANGUAGES_CYRILLIC_MED_AFRICA,
];

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
    description: 'Tell apart Thai, Lao, Khmer, Vietnamese, Indonesian/Malay, and Filipino/Tagalog.',
    primeSummary:
      'In Brahmic scripts: upright vertical stems with tiny terminal loops = Thai; wider rounded S/W/M curves = Lao; wavy top crowns + stacked subscript legs = Khmer. In Latin scripts: stacked tone marks + đ/ơ/ư = Vietnamese; standalone "ng"/"mga"/"Bawal" = Filipino; unadorned Latin with "Jalan"/"Dilarang" = Indonesian/Malay.',
    languageIds: ['th', 'lo', 'km', 'vi', 'id', 'tl'],
  },
  {
    id: 'south-asian',
    name: 'South Asian Scripts',
    description: 'Separate Hindi (Devanagari), Bengali, Tamil, Telugu, Sinhala, and Gujarati.',
    primeSummary:
      'Check the top headline first: solid bar + boxy verticals = Hindi (Devanagari); solid bar + sharp diagonal triangles (ব/ক/র) = Bengali; Devanagari-like stems WITHOUT a top bar = Gujarati. In southern scripts: square corners + top dots (்) = Tamil; round bowls + ✓ checkmarks = Telugu; ultra-round curls + spiral ෙ (no ✓) = Sinhala.',
    languageIds: ['hi', 'bn', 'ta', 'te', 'si', 'gu'],
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
    description: 'Discriminate German, Dutch, Swedish, Norwegian, Danish, and Icelandic.',
    primeSummary:
      'Capitalized nouns + ß/ä/ö/ü = German; doubled vowels (aa/ee/oo) + ij = Dutch; å + ä + ö + "och" = Swedish; ø + æ + å with hard p/t/k (-gata/-veien) = Norwegian; ø + æ + å with soft b/d/g (-gade/-vej) = Danish; þ (thorn) + ð (eth) + acute vowels = Icelandic.',
    languageIds: ['de', 'nl', 'sv', 'no', 'da', 'is'],
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
    description: 'Distinguish Russian, Ukrainian, Bulgarian, Serbian, Macedonian, Mongolian, and Kyrgyz.',
    primeSummary:
      'Check unique letters: і/ї/є/ґ (no ы) = Ukrainian; mid-word vowel ъ (България, път, no ы) = Bulgarian; ј/љ/њ + ћ/ђ = Serbian; ј/љ/њ + acute ќ/ѓ/ѕ = Macedonian; ө/ү + extreme doubled vowels (аа/өө/үү, no ң) = Mongolian; ө/ү + hooked ң (көчөсү) = Kyrgyz; standard ы/э/ъ (-ого/ул.) = Russian.',
    languageIds: ['ru', 'uk', 'bg', 'sr', 'mk', 'mn', 'ky'],
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
    description: 'Recognize Greek, Turkish, Hebrew, Arabic, Georgian, and Maltese instantly.',
    primeSummary:
      'Distinct scripts: Σ/Ω/Δ/Λ = Greek; unconnected square RTL blocks = Hebrew; connected cursive RTL with الـ = Arabic; rounded unicameral hooks (გ/თ/მ/ქ/წ) = Georgian. Latin scripts: dotless ı / dotted İ / ğ / ş = Turkish; crossed ħ + għ + ċ/ġ/ż + Triq/il- = Maltese.',
    languageIds: ['el', 'tr', 'he', 'ar', 'ka', 'mt'],
  },
  {
    id: 'african',
    name: 'African',
    description: 'Identify Swahili, Afrikaans, Zulu/Xhosa, and Yoruba on African road signage.',
    primeSummary:
      'Connectors wa/ya/kwa + Barabara/Mtaa/Duka = Swahili (KE/UG); "die", "nie ... nie", "vir", ê/ô = Afrikaans (ZA); long prefix words (isi-/ama-/uku-/Kwa-) with hl/dl/xh/nq = Zulu/Xhosa (ZA/SZ); subdots ẹ/ọ/ṣ + tone accents + gb/Ilé = Yoruba (NG).',
    languageIds: ['sw', 'af', 'zu', 'yo'],
  },
];

export const LANGUAGE_GROUP_MAP: Record<LanguageGroupId, LanguageGroupSpec> = Object.fromEntries(
  LANGUAGE_GROUPS.map((group) => [group.id, group])
) as Record<LanguageGroupId, LanguageGroupSpec>;

export function getLanguagesForGroupSelection(
  selection: LanguageGroupSelectionId
): LanguageSpec[] {
  if (selection === 'all-mixed') {
    return LANGUAGES;
  }
  const group = LANGUAGE_GROUP_MAP[selection];
  if (!group) {
    return LANGUAGES;
  }
  return group.languageIds.map((id) => LANGUAGE_MAP[id]).filter(Boolean);
}

export function getCandidateCountriesForLanguage(language: LanguageSpec): PlayableCountry[] {
  return language.candidateCountryIds
    .map((id) => PLAYABLE_COUNTRY_MAP[id])
    .filter((country): country is PlayableCountry => Boolean(country) && country.coverageTier !== 'none');
}

export function findTellMatchesInSample(
  sample: LanguageSample,
  language: LanguageSpec
): TellSpanMatch[] {
  const results: TellSpanMatch[] = [];
  // Prioritize tells explicitly listed in sample.tellIds, then any other tells on the language
  const orderedTells = [
    ...language.tells.filter((t) => sample.tellIds.includes(t.id)),
    ...language.tells.filter((t) => !sample.tellIds.includes(t.id)),
  ];

  orderedTells.forEach((tell, idx) => {
    if (!tell.regex) return;
    const regex = new RegExp(tell.regex, 'gu');
    const spans: Array<{ start: number; end: number; text: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sample.text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
      });
    }
    if (spans.length > 0) {
      results.push({
        tellId: tell.id,
        pattern: tell.pattern,
        label: tell.label,
        explanation: tell.explanation,
        isUnique: tell.isUnique,
        colorIndex: idx % 4,
        spans,
      });
    }
  });

  return results;
}

export function getAllSkillIdsForSection(section: SectionId): string[] {
  switch (section) {
    case 'languages':
      return LANGUAGES.map((lang) => `lang:${lang.id}`);
    case 'driving-side':
      return PLAYABLE_COUNTRIES.filter((c) => c.coverageTier !== 'none').map(
        (c) => `drive:${c.id}`
      );
    case 'coverage':
      return PLAYABLE_COUNTRIES.map((c) => `cov:${c.id}`);
    case 'domains-currencies': {
      const covered = PLAYABLE_COUNTRIES.filter((c) => c.coverageTier !== 'none');
      const domainSkills = covered.map((c) => `domain:${c.id}`);
      const currencyCodes = Array.from(
        new Set(covered.flatMap((c) => c.currencies.map((curr) => curr.code.toLowerCase())))
      );
      const currencySkills = currencyCodes.map((code) => `curr:${code}`);
      return [...domainSkills, ...currencySkills];
    }
  }
}
