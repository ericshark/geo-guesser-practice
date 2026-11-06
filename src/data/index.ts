import { PLAYABLE_COUNTRIES } from './countries.ts';
import { LANGUAGES_EAST_SOUTH_ASIA } from './languages-east-south-asia.ts';
import { LANGUAGES_EUROPE } from './languages-europe.ts';
import { LANGUAGES_CYRILLIC_MED_AFRICA } from './languages-cyrillic-med-africa.ts';
import type {
  CoverageFocusId,
  CoverageFocusSpec,
  DrivingSide,
  DrivingSideFocusId,
  DrivingSideFocusSpec,
  LanguageGroupId,
  LanguageGroupSelectionId,
  LanguageGroupSpec,
  LanguageSample,
  LanguageSpec,
  PlayableCountry,
  SectionId,
  TellSpanMatch,
  WorldRegion,
} from './types.ts';

export * from './types.ts';
export * from './worldMapGeometry.ts';
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
  if (selection === 'all-mixed' || selection === 'smart-weakest') {
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
      return PLAYABLE_COUNTRIES.filter(
        (c) => c.coverageTier !== 'none' || c.id === 'gy' || c.id === 'sr'
      ).map((c) => `drive:${c.id}`);
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

export const COVERAGE_FOCUS_OPTIONS: CoverageFocusSpec[] = [
  {
    id: 'world',
    name: 'World',
    shortName: 'World',
    description:
      'All 145 Playable Countries and territories across Official, Limited, and None Street View Coverage Tiers.',
    highlightExamples: ['China (None)', 'Nigeria (Limited)', 'Russia (Limited)', 'Uruguay (Official)'],
  },
  {
    id: 'trap-countries',
    name: 'Common Trap Countries',
    shortName: 'Common Traps',
    description:
      'High-yield trap countries and partial road gaps: China, Egypt, Morocco, Algeria, Belarus, Moldova, Venezuela, Bolivia, Paraguay, Cuba, Iran, Pakistan road gaps, and their covered neighbors.',
    highlightExamples: [
      'China (None)',
      'Egypt / Morocco / Algeria (None)',
      'Belarus & Moldova (None)',
      'Venezuela & Cuba (None)',
      'Bolivia & Pakistan (Limited)',
    ],
  },
  {
    id: 'Europe',
    name: 'Europe',
    shortName: 'Europe',
    description:
      '50 European countries and microstates: contrast broad Official coverage against uncovered Belarus & Moldova and Limited coverage in Russia, Bosnia & Herzegovina, and Cyprus.',
    highlightExamples: ['Belarus (None)', 'Moldova (None)', 'Russia (Limited)', 'Bosnia (Limited)'],
  },
  {
    id: 'Asia',
    name: 'Asia',
    shortName: 'Asia',
    description:
      '37 Asian countries and territories: separate Official coverage (Japan, Taiwan, Thailand, Indonesia, UAE, Oman, Jordan) from Limited (India, Vietnam, Laos, Pakistan, South Korea) and None (Mainland China, Iran, Nepal, Myanmar).',
    highlightExamples: ['China (None)', 'Pakistan (Limited)', 'Vietnam (Limited)', 'Iran (None)'],
  },
  {
    id: 'Africa',
    name: 'Africa',
    shortName: 'Africa',
    description:
      '25 African countries and territories: master the 13 covered countries (South Africa, Botswana, Eswatini, Lesotho, Réunion, Kenya, Uganda, Rwanda, Ghana, Nigeria, Senegal, Tunisia, Madagascar) vs 12 uncovered traps.',
    highlightExamples: ['Egypt (None)', 'Morocco & Algeria (None)', 'Nigeria & Kenya (Limited)', 'Tunisia (Limited)'],
  },
  {
    id: 'Americas',
    name: 'Americas',
    shortName: 'Americas',
    description:
      '27 North, Central, South American & Caribbean countries: contrast Official (US, Mexico, Brazil, Argentina, Chile, Peru, Uruguay) with Limited (Canada, Colombia, Ecuador, Bolivia, Costa Rica, Dominican Republic) and None (Venezuela, Paraguay, Cuba).',
    highlightExamples: ['Venezuela (None)', 'Paraguay vs Uruguay', 'Bolivia (Limited)', 'Cuba (None)'],
  },
  {
    id: 'Oceania',
    name: 'Oceania',
    shortName: 'Oceania',
    description:
      '6 Oceanian countries and territories with Official Street View coverage: Australia, New Zealand, Christmas Island, Guam, Northern Mariana Islands, and American Samoa.',
    highlightExamples: ['Australia (Official)', 'New Zealand (Official)', 'Christmas Island (Official)', 'Guam (Official)'],
  },
];

export const COVERAGE_FOCUS_MAP: Record<CoverageFocusId, CoverageFocusSpec> =
  Object.fromEntries(COVERAGE_FOCUS_OPTIONS.map((f) => [f.id, f])) as Record<
    CoverageFocusId,
    CoverageFocusSpec
  >;

const PRIORITY_TRAP_COUNTRY_IDS = [
  'cn',
  'eg',
  'ma',
  'dz',
  'by',
  'md',
  've',
  'bo',
  'py',
  'uy',
  'cu',
  'ir',
  'pk',
  'ng',
  'ke',
  'sn',
  'ru',
  'vn',
  'in',
  'co',
  'ec',
  'tn',
];

export function getCountriesForCoverageFocus(focusId: CoverageFocusId): PlayableCountry[] {
  let base: PlayableCountry[];
  if (focusId === 'world') {
    base = [...PLAYABLE_COUNTRIES];
  } else if (focusId === 'trap-countries') {
    const trapAndContrastIds = new Set<string>([
      ...PRIORITY_TRAP_COUNTRY_IDS,
      ...PLAYABLE_COUNTRIES.filter((c) => c.isTrapCountry || c.coverageTier === 'none').map(
        (c) => c.id
      ),
    ]);
    base = PLAYABLE_COUNTRIES.filter((c) => trapAndContrastIds.has(c.id));
  } else {
    base = PLAYABLE_COUNTRIES.filter((c) => c.region === focusId);
  }

  // Order so high-yield trap, limited, and contrast countries appear early when unseen, while keeping every country in the focus pool
  const priorityIndex = new Map<string, number>(
    PRIORITY_TRAP_COUNTRY_IDS.map((id, idx) => [id, idx])
  );
  return [...base].sort((a, b) => {
    const pa = priorityIndex.get(a.id) ?? (a.isTrapCountry ? 50 : a.coverageTier === 'limited' ? 60 : 100);
    const pb = priorityIndex.get(b.id) ?? (b.isTrapCountry ? 50 : b.coverageTier === 'limited' ? 60 : 100);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

export const DRIVING_SIDE_FOCUS_OPTIONS: DrivingSideFocusSpec[] = [
  {
    id: 'world',
    name: 'World & Tricky Borders',
    shortName: 'World',
    mapRegionLabel: 'World',
    description:
      'All covered Playable Countries plus key South American border exceptions (Guyana & Suriname), weighted toward tricky left/right borders and island territories.',
    highlightExamples: [
      'Kenya & Uganda (Left) vs Rwanda (Right)',
      'Thailand (Left) vs Cambodia & Laos (Right)',
      'Hong Kong & Macau (Left) vs Taiwan (Right)',
      'Ghana, Nigeria & Senegal (Right)',
    ],
  },
  {
    id: 'tricky-borders',
    name: 'Tricky Left/Right Borders & Exceptions',
    shortName: 'Tricky Borders',
    mapRegionLabel: 'World',
    description:
      'High-yield regional borders and island switches: Thailand vs Cambodia/Laos, Hong Kong/Macau vs Taiwan, Guyana vs neighbors, Kenya/Uganda vs Rwanda, Ghana/Nigeria/Senegal, and U.S. Virgin Islands vs Puerto Rico.',
    highlightExamples: [
      'Thailand (L) vs Cambodia/Laos (R)',
      'HK/Macau (L) vs Taiwan (R)',
      'Guyana/Suriname (L) vs Brazil/Venezuela (R)',
      'Kenya/Uganda (L) vs Rwanda/Ghana/Nigeria (R)',
    ],
  },
  {
    id: 'europe',
    name: 'Europe',
    shortName: 'Europe',
    mapRegionLabel: 'Europe',
    description:
      'Master all 7 left-driving covered European countries and territories (UK, Ireland, Isle of Man, Jersey, Guernsey, Malta, Cyprus) vs right-driving continental Europe and Gibraltar.',
    highlightExamples: [
      'UK & Ireland (Left)',
      'Isle of Man, Jersey & Guernsey (Left)',
      'Malta & Cyprus (Left)',
      'Gibraltar (Right — 1929 switch)',
    ],
  },
  {
    id: 'southern-eastern-africa',
    name: 'Southern & Eastern Africa',
    shortName: 'S & E Africa',
    mapRegionLabel: 'Southern & Eastern Africa',
    description:
      'Click all 6 covered left-driving countries in Southern & Eastern Africa (South Africa, Botswana, Eswatini, Lesotho, Kenya, Uganda) while ruling out right-driving Rwanda, Madagascar, Réunion, and West Africa (Ghana, Nigeria, Senegal).',
    highlightExamples: [
      'Kenya & Uganda (Left)',
      'Rwanda (Right)',
      'South Africa, Botswana, Eswatini, Lesotho (Left)',
      'Ghana, Nigeria & Senegal (Right)',
    ],
  },
  {
    id: 'south-se-asia',
    name: 'South & SE Asia',
    shortName: 'S & SE Asia',
    mapRegionLabel: 'South & SE Asia',
    description:
      'Separate left-driving South Asia (India, Bangladesh, Sri Lanka, Bhutan, Pakistan) and Maritime/Mainland SE Asia (Thailand, Malaysia, Singapore, Indonesia) from right-driving Cambodia, Laos, Vietnam, and the Philippines.',
    highlightExamples: [
      'Thailand, Malaysia, Singapore, Indonesia (Left)',
      'Cambodia, Laos, Vietnam, Philippines (Right)',
      'India, Bangladesh, Sri Lanka, Bhutan (Left)',
      'Japan, Hong Kong, Macau (Left) vs Taiwan (Right)',
    ],
  },
  {
    id: 'oceania',
    name: 'Oceania',
    shortName: 'Oceania',
    mapRegionLabel: 'Oceania',
    description:
      'Contrast left-driving Australasia (Australia, New Zealand, Christmas Island) against right-driving U.S. Pacific territories (Guam, Northern Mariana Islands, American Samoa).',
    highlightExamples: [
      'Australia & New Zealand (Left)',
      'Christmas Island (Left)',
      'Guam & Northern Mariana Islands (Right)',
      'American Samoa (Right)',
    ],
  },
  {
    id: 'americas-caribbean',
    name: 'Americas & Caribbean',
    shortName: 'Americas & Caribbean',
    mapRegionLabel: 'Americas & Caribbean',
    description:
      'Identify left-driving covered Atlantic/Caribbean territories (U.S. Virgin Islands, Bermuda) and South American border exceptions (Guyana, Suriname) against right-driving Puerto Rico, Curaçao, and mainland Americas.',
    highlightExamples: [
      'U.S. Virgin Islands (Left)',
      'Bermuda (Left)',
      'Guyana & Suriname (Left — None coverage)',
      'Puerto Rico & Curaçao (Right)',
    ],
  },
];

export const DRIVING_SIDE_FOCUS_MAP: Record<
  DrivingSideFocusId,
  DrivingSideFocusSpec
> = Object.fromEntries(DRIVING_SIDE_FOCUS_OPTIONS.map((f) => [f.id, f])) as Record<
  DrivingSideFocusId,
  DrivingSideFocusSpec
>;

export const PRIORITY_TRICKY_DRIVING_COUNTRY_IDS: string[] = [
  'ke',
  'rw',
  'ug',
  'gh',
  'ng',
  'sn',
  'th',
  'kh',
  'la',
  'id',
  'my',
  'sg',
  'ph',
  'vn',
  'hk',
  'mo',
  'tw',
  'jp',
  'kr',
  'bd',
  'bt',
  'in',
  'lk',
  'pk',
  'gy',
  'sr',
  'vi',
  'bm',
  'pr',
  'cw',
  'mt',
  'cy',
  'gi',
  'gb',
  'ie',
  'im',
  'je',
  'gg',
  'za',
  'bw',
  'sz',
  'ls',
  're',
  'mg',
  'au',
  'nz',
  'cx',
  'gu',
  'mp',
  'as',
];

export function getCountriesForDrivingSideFocus(
  focusId: DrivingSideFocusId
): PlayableCountry[] {
  const allEligible = PLAYABLE_COUNTRIES.filter(
    (c) => c.coverageTier !== 'none' || c.id === 'gy' || c.id === 'sr'
  );

  let base: PlayableCountry[];
  switch (focusId) {
    case 'world':
      base = allEligible;
      break;
    case 'tricky-borders': {
      const trickySet = new Set(PRIORITY_TRICKY_DRIVING_COUNTRY_IDS);
      base = allEligible.filter((c) => trickySet.has(c.id));
      break;
    }
    case 'europe':
      base = allEligible.filter((c) => c.region === 'Europe');
      break;
    case 'southern-eastern-africa':
      base = allEligible.filter((c) => c.region === 'Africa');
      break;
    case 'south-se-asia':
      base = allEligible.filter(
        (c) =>
          c.subregion === 'South Asia' ||
          c.subregion === 'Southeast Asia' ||
          c.subregion === 'East Asia'
      );
      break;
    case 'oceania':
      base = allEligible.filter((c) => c.region === 'Oceania');
      break;
    case 'americas-caribbean':
      base = allEligible.filter((c) => c.region === 'Americas');
      break;
  }

  const priorityIndex = new Map<string, number>(
    PRIORITY_TRICKY_DRIVING_COUNTRY_IDS.map((id, idx) => [id, idx])
  );

  return [...base].sort((a, b) => {
    const pa =
      priorityIndex.get(a.id) ?? (a.drivingSide === 'left' ? 60 : 100);
    const pb =
      priorityIndex.get(b.id) ?? (b.drivingSide === 'left' ? 60 : 100);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

export function getCountryScripts(country: PlayableCountry): string[] {
  const scripts = new Set<string>();
  for (const langId of country.signLanguages) {
    if (langId === 'en') {
      scripts.add('Latin');
    } else {
      const spec = LANGUAGE_MAP[langId];
      if (spec) {
        scripts.add(spec.script);
        if (spec.script.toLowerCase().includes('latin')) {
          scripts.add('Latin');
        }
        if (spec.script.toLowerCase().includes('cyrillic')) {
          scripts.add('Cyrillic');
        }
      }
    }
  }
  return Array.from(scripts);
}

export interface DrivingSideNarrowingFilter {
  drivingSide: DrivingSide;
  region?: WorldRegion;
  subregion?: string;
  script?: string;
  languageId?: string;
}

export interface DrivingSideNarrowingResult {
  candidateCountries: PlayableCountry[];
  candidateCountryIds: string[];
  uncoveredMatchingCountries: PlayableCountry[];
  uncoveredCountryNotes: string[];
}

export function computeDrivingSideNarrowingCandidates(
  filter: DrivingSideNarrowingFilter
): DrivingSideNarrowingResult {
  const matchingAll = PLAYABLE_COUNTRIES.filter((country) => {
    if (country.drivingSide !== filter.drivingSide) {
      return false;
    }
    if (
      filter.region &&
      country.region.toLowerCase() !== filter.region.toLowerCase()
    ) {
      return false;
    }
    if (
      filter.subregion &&
      country.subregion.toLowerCase() !== filter.subregion.toLowerCase()
    ) {
      return false;
    }
    if (
      filter.languageId &&
      !country.signLanguages.includes(filter.languageId)
    ) {
      return false;
    }
    if (filter.script) {
      const targetScript = filter.script.trim().toLowerCase();
      const countryScripts = getCountryScripts(country).map((s) =>
        s.toLowerCase()
      );
      const matchesScript = countryScripts.some(
        (s) => s === targetScript || s.includes(targetScript)
      );
      if (!matchesScript) {
        return false;
      }
    }
    return true;
  });

  const candidateCountries = matchingAll.filter(
    (c) => c.coverageTier !== 'none'
  );
  const uncoveredMatchingCountries = matchingAll.filter(
    (c) => c.coverageTier === 'none'
  );

  return {
    candidateCountries,
    candidateCountryIds: candidateCountries.map((c) => c.id),
    uncoveredMatchingCountries,
    uncoveredCountryNotes: uncoveredMatchingCountries.map(
      (c) =>
        `${c.name} (${c.drivingSide.toUpperCase()}, None coverage): ${c.drivingNote ?? c.coverageNote}`
    ),
  };
}
