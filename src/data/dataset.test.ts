import { describe, it, expect } from 'vitest';
import {
  PLAYABLE_COUNTRIES,
  PLAYABLE_COUNTRY_MAP,
  LANGUAGE_GROUPS,
  LANGUAGES,
  LANGUAGE_MAP,
  getLanguagesForGroupSelection,
  findTellMatchesInSample,
} from './index';
import { isKnownSignLanguage } from './signLanguages';
import { compileTellRegex } from './tells';
import type { LanguageGroupId } from './types';

const REQUIRED_LANGUAGE_GROUPS: Array<{ id: LanguageGroupId; name: string }> = [
  { id: 'east-asian', name: 'East Asian' },
  { id: 'southeast-asian', name: 'Southeast Asian' },
  { id: 'south-asian', name: 'South Asian Scripts' },
  { id: 'romance', name: 'Romance' },
  { id: 'germanic', name: 'Germanic' },
  { id: 'central-slavic-hungarian', name: 'Central European Slavic & Hungarian' },
  { id: 'cyrillic', name: 'Cyrillic' },
  { id: 'baltic-finnic', name: 'Baltic & Finnic' },
  { id: 'mediterranean-middle-east-caucasus', name: 'Mediterranean / Middle East / Caucasus' },
  { id: 'african', name: 'African' },
];

const REQUIRED_TERRITORIES = [
  'hk', // Hong Kong
  'mo', // Macau
  'pr', // Puerto Rico
  'fo', // Faroe Islands
  'vi', // U.S. Virgin Islands
  'bm', // Bermuda
  're', // Réunion
  'cx', // Christmas Island
];

describe('Dataset corrections', () => {
  it('names every sign language and no longer maps countries to proxy languages', () => {
    for (const country of PLAYABLE_COUNTRIES) {
      for (const id of country.signLanguages) {
        expect(isKnownSignLanguage(id), `${country.id} -> ${id}`).toBe(true);
      }
    }
    expect(PLAYABLE_COUNTRY_MAP.al.signLanguages).toEqual(['sq']);
    expect(PLAYABLE_COUNTRY_MAP.ir.signLanguages).toEqual(['fa']);
    expect(PLAYABLE_COUNTRY_MAP.kz.signLanguages).toContain('kk');
  });

  it('uses the euro in Bulgaria and keeps notes professional', () => {
    expect(PLAYABLE_COUNTRY_MAP.bg.currencies[0].code).toBe('EUR');
    for (const c of PLAYABLE_COUNTRIES) expect(c.coverageNote).not.toMatch(/shitcam/i);
  });

  it('matches non-ASCII word boundaries (JavaScript \\b is ASCII only)', () => {
    expect(compileTellRegex('\\bвул\\.').test('вул. Шевченка')).toBe(true);
    expect(compileTellRegex('(ого\\b)', 'u').test('нового')).toBe(true);
    expect(compileTellRegex('\\b(el)\\b', 'u').test('el parque')).toBe(true);
    expect(compileTellRegex('\\b(el)\\b', 'u').test('Rafael')).toBe(false);
  });
});

describe('Dataset Integrity Seam', () => {
  it('defines canonical Playable Countries including required distinct GeoGuessr territories and all 3 Coverage Tiers', () => {
    expect(PLAYABLE_COUNTRIES.length).toBeGreaterThanOrEqual(95);

    const tiers = new Set(PLAYABLE_COUNTRIES.map((c) => c.coverageTier));
    expect(tiers.has('official')).toBe(true);
    expect(tiers.has('limited')).toBe(true);
    expect(tiers.has('none')).toBe(true);

    for (const territoryId of REQUIRED_TERRITORIES) {
      const territory = PLAYABLE_COUNTRY_MAP[territoryId];
      expect(territory, `Missing territory ${territoryId}`).toBeDefined();
      expect(territory.isTerritory).toBe(true);
      expect(territory.coverageNote.length).toBeGreaterThan(5);
      expect(['left', 'right']).toContain(territory.drivingSide);
      expect(territory.signLanguages.length).toBeGreaterThan(0);
      expect(territory.tld).toMatch(/^\.[a-z]{2,}$/);
      expect(territory.currencies.length).toBeGreaterThan(0);
    }

    // Verify every PlayableCountry has valid fields and non-empty regional notes
    for (const country of PLAYABLE_COUNTRIES) {
      expect(country.id).toBeTruthy();
      expect(country.name).toBeTruthy();
      expect(country.coverageNote.length).toBeGreaterThan(5);
      expect(country.signLanguages.length).toBeGreaterThan(0);
      expect(country.tld).toMatch(/^\.[a-z]{2,}$/);
      expect(country.currencies.length).toBeGreaterThan(0);
      expect(country.coordinates).toHaveLength(2);
    }
  });

  it('defines all 10 Language Groups plus All-Groups Mixed with >= 3 confusable languages each', () => {
    expect(LANGUAGE_GROUPS).toHaveLength(10);

    for (const expectedGroup of REQUIRED_LANGUAGE_GROUPS) {
      const group = LANGUAGE_GROUPS.find((g) => g.id === expectedGroup.id);
      expect(group, `Missing Language Group ${expectedGroup.id}`).toBeDefined();
      expect(group!.name).toBe(expectedGroup.name);
      expect(group!.languageIds.length).toBeGreaterThanOrEqual(3);

      const groupLanguages = getLanguagesForGroupSelection(expectedGroup.id);
      expect(groupLanguages.length).toBe(group!.languageIds.length);
      for (const lang of groupLanguages) {
        expect(lang.groupId).toBe(expectedGroup.id);
      }
    }

    const allMixed = getLanguagesForGroupSelection('all-mixed');
    expect(allMixed.length).toBe(LANGUAGES.length);
    expect(allMixed.length).toBeGreaterThanOrEqual(45);
  });

  it('ensures every language has authentic Sentence and Sign Text Samples, valid Tells with character-span matchers, gestalt fallback clues, and only covered Candidate Countries', () => {
    for (const lang of LANGUAGES) {
      expect(LANGUAGE_MAP[lang.id]).toBe(lang);
      expect(lang.tells.length).toBeGreaterThanOrEqual(2);
      expect(lang.gestaltNote.length).toBeGreaterThan(15);
      expect(lang.contrastNote.length).toBeGreaterThan(10);

      // Must have both sentence and sign samples
      const sentences = lang.samples.filter((s) => s.kind === 'sentence');
      const signs = lang.samples.filter((s) => s.kind === 'sign');
      expect(sentences.length, `${lang.id} needs >= 3 sentence samples`).toBeGreaterThanOrEqual(3);
      expect(signs.length, `${lang.id} needs >= 2 sign samples`).toBeGreaterThanOrEqual(2);

      // Unique sample IDs and non-empty translations
      const sampleIds = new Set(lang.samples.map((s) => s.id));
      expect(sampleIds.size).toBe(lang.samples.length);

      let samplesWithMatchedSpan = 0;
      for (const sample of lang.samples) {
        expect(sample.text.trim().length).toBeGreaterThan(2);
        expect(sample.translation.trim().length).toBeGreaterThan(2);
        const matches = findTellMatchesInSample(sample, lang);
        if (matches.length > 0) {
          samplesWithMatchedSpan++;
          for (const match of matches) {
            expect(match.spans.length).toBeGreaterThan(0);
            for (const span of match.spans) {
              expect(sample.text.slice(span.start, span.end)).toBe(span.text);
            }
          }
        } else {
          // If no character-span tell matched, sample or language must provide structural/gestalt fallback
          expect(Boolean(sample.structuralClue || lang.gestaltNote)).toBe(true);
        }
      }
      expect(
        samplesWithMatchedSpan,
        `${lang.id} must have samples that match explicit Tell character spans`
      ).toBeGreaterThanOrEqual(3);

      // Every candidateCountryId must resolve to a PlayableCountry with coverageTier !== 'none'
      // Languages used only where there is no official coverage list those countries separately.
      expect(lang.candidateCountryIds.length + (lang.uncoveredCountryIds?.length ?? 0)).toBeGreaterThan(0);
      for (const countryId of lang.uncoveredCountryIds ?? []) {
        expect(PLAYABLE_COUNTRY_MAP[countryId]?.coverageTier, `${lang.id} uncovered country ${countryId}`).toBe('none');
      }
      for (const countryId of lang.candidateCountryIds) {
        const country = PLAYABLE_COUNTRY_MAP[countryId];
        expect(country, `Language ${lang.id} references unknown country ${countryId}`).toBeDefined();
        expect(
          country.coverageTier,
          `Language ${lang.id} candidate country ${countryId} has coverageTier === 'none'`
        ).not.toBe('none');
      }
    }
  });
});
