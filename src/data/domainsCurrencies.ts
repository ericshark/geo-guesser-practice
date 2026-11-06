import { PLAYABLE_COUNTRIES } from './countries.ts';
import type { CurrencySpec, PlayableCountry } from './types.ts';

export interface DomainsCurrenciesSkill {
  id: string;
  kind: 'domain' | 'currency';
  label: string;
  countries: PlayableCountry[];
  clues: { text: string; marker: string }[];
}

const domainSkills: DomainsCurrenciesSkill[] = PLAYABLE_COUNTRIES.map((country) => ({
  id: `domain:${country.id}`,
  kind: 'domain',
  label: country.tld,
  countries: [country],
  clues: country.tldExamples.map((text) => ({ text, marker: country.tld })),
}));

const currenciesByCode = new Map<string, [PlayableCountry, CurrencySpec][]>();
const currenciesBySymbol = new Map<string, [PlayableCountry, CurrencySpec][]>();
for (const country of PLAYABLE_COUNTRIES) {
  if (country.coverageTier === 'none') continue;
  for (const currency of country.currencies) {
    for (const [key, index] of [
      [currency.code, currenciesByCode],
      [currency.symbol, currenciesBySymbol],
    ] as const) {
      const entries = index.get(key) ?? [];
      entries.push([country, currency]);
      index.set(key, entries);
    }
  }
}

const sharedSymbols = new Set(
  [...currenciesBySymbol].filter(([, entries]) =>
    new Set(entries.map(([, currency]) => currency.code)).size > 1
  ).map(([symbol]) => symbol)
);

const currencySkills: DomainsCurrenciesSkill[] = [
  ...[...sharedSymbols].map((symbol): DomainsCurrenciesSkill => ({
    id: `curr:sign:${symbol}`,
    kind: 'currency',
    label: symbol,
    countries: [...new Set(currenciesBySymbol.get(symbol)!.map(([country]) => country))],
    clues: ['89', '120', '250'].map((price) => ({
      text: symbol === '$' ? `$${price}.00` : `${price} ${symbol}`,
      marker: symbol,
    })),
  })),
  ...Array.from(currenciesByCode, ([code, entries]): DomainsCurrenciesSkill => {
    const clues = entries.flatMap(([, currency]) => {
      const { symbol, exampleSign, alternateSigns = [] } = currency;
      const amount = exampleSign.match(/[\p{N}][\p{N}., ]*/u)?.[0].trim() ?? '120';
      const codeClue = { text: `${amount} ${code}`, marker: code };
      // A bare shared symbol belongs to its own skill. The code distinguishes the individual currencies.
      if (sharedSymbols.has(symbol)) return [codeClue];
      const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const exactMarker = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'u');
      return [
        { text: exactMarker.test(exampleSign) ? exampleSign : `${amount} ${symbol}`, marker: symbol },
        ...alternateSigns.map((sign) => ({ text: sign.exampleSign, marker: sign.symbol })),
        codeClue,
      ];
    });
    // Single-country codes also need different price tags for spaced follow-ups.
    const distinctClues = new Map(clues.map((clue) => [clue.text, clue]));
    for (const amount of ['89', '120', '250']) {
      if (distinctClues.size >= 3) break;
      const text = `${amount} ${code}`;
      distinctClues.set(text, { text, marker: code });
    }
    return {
      id: `curr:${code.toLowerCase()}`,
      kind: 'currency',
      label: code,
      countries: [...new Set(entries.map(([country]) => country))],
      clues: [...distinctClues.values()],
    };
  }),
];

export const DOMAINS_CURRENCIES_SKILLS = domainSkills.flatMap((domain, index) =>
  currencySkills[index] ? [domain, currencySkills[index]] : [domain]
);

export const DOMAINS_CURRENCIES_SKILL_MAP = new Map(
  DOMAINS_CURRENCIES_SKILLS.map((skill) => [skill.id, skill])
);
