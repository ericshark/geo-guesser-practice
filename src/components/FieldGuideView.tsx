import { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { DOMAINS_CURRENCIES_SKILL_MAP } from '../data/domainsCurrencies.ts';
import {
  getLanguagesForGroupSelection,
  LANGUAGE_GROUPS,
  LANGUAGE_MAP,
  PLAYABLE_COUNTRIES,
  type PlayableCountry,
} from '../data/index.ts';
import { getLanguageGroupContrastCard } from '../engine/practiceEngine.ts';
import type { ProgressData } from '../storage/index.ts';
import { LanguageContrastGrid } from './LanguageContrastGrid.tsx';
import { MasteryBadge } from './MasteryBadge.tsx';

const languageNames = new Intl.DisplayNames('en', { type: 'language' });
const signageLanguageName = (id: string) => LANGUAGE_MAP[id]?.name ?? languageNames.of(id) ?? id;

const normalize = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const countries = [...PLAYABLE_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
const countryEntries = countries.map((country) => ({
  id: country.id,
  name: country.name,
  searchText: normalize([
    country.name, country.region, country.subregion, country.tld, country.coverageTier,
    ...country.signLanguages.map(signageLanguageName),
    ...country.currencies.flatMap(({ name, symbol, code, alternateSigns }) => [
      name, symbol, code, ...(alternateSigns ?? []).map((sign) => sign.symbol),
    ]),
  ].join(' ')),
}));
const groupEntries = LANGUAGE_GROUPS.map((group) => ({
  id: group.id,
  name: group.name,
  searchText: normalize([
    group.name,
    ...getLanguagesForGroupSelection(group.id).flatMap((language) => [
      language.name, language.nativeName, language.script,
      ...language.tells.flatMap(({ pattern, label }) => [pattern, label]),
    ]),
  ].join(' ')),
}));

export function FieldGuideView({ progress }: { progress: ProgressData }) {
  const [category, setCategory] = useState<'countries' | 'groups'>('countries');
  const [query, setQuery] = useState('');
  const [countryId, setCountryId] = useState('');
  const [groupId, setGroupId] = useState('');
  const terms = normalize(query.trim()).split(/\s+/);
  const matchesQuery = ({ searchText }: { searchText: string }) =>
    terms.every((term) => searchText.includes(term));
  const matchingCountries = countryEntries.filter(matchesQuery);
  const matchingGroups = groupEntries.filter(matchesQuery);
  const entries = category === 'countries' ? matchingCountries : matchingGroups;
  const selectedId = category === 'countries' ? countryId : groupId;
  const activeId = entries.find(({ id }) => id === selectedId)?.id ?? entries[0]?.id;
  const country = category === 'countries' ? countries.find(({ id }) => id === activeId) : undefined;
  const group = category === 'groups' ? LANGUAGE_GROUPS.find(({ id }) => id === activeId) : undefined;
  const contrast = group && getLanguageGroupContrastCard(group.id, progress, 'sign');

  return (
    <div className="space-y-5">
      <section className="space-y-5">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--xp)] text-white">
            <BookOpen aria-hidden="true" className="h-7 w-7" strokeWidth={2.5} />
          </span>
          <div>
            <h1 className="text-[1.75rem] font-black sm:text-[2.125rem]">Field Guide</h1>
            <p className="mt-1 text-[1rem] text-[var(--text-secondary)]">
              Look up any Playable Country, or compare the Tells in a Language Group.
            </p>
          </div>
        </div>
        <label className="relative block">
          <span className="visually-hidden">Search the Field Guide</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a country, .ccTLD, currency, language, or Tell"
            className="w-full rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] py-3.5 pl-12 pr-4 text-[1rem] font-semibold shadow-[var(--shadow-card)] focus:border-[var(--brand-accent)] focus:outline-none"
          />
        </label>
        <div role="group" aria-label="Reference type" className="grid grid-cols-2 gap-2 sm:max-w-md">
          <button
            type="button"
            aria-pressed={category === 'countries'}
            data-state={category === 'countries' ? 'selected' : 'idle'}
            onClick={() => setCategory('countries')}
            className="answer-tile !min-h-0 !justify-center !py-2.5 !text-[0.9375rem]"
          >
            Countries ({matchingCountries.length})
          </button>
          <button
            type="button"
            aria-pressed={category === 'groups'}
            data-state={category === 'groups' ? 'selected' : 'idle'}
            onClick={() => setCategory('groups')}
            className="answer-tile !min-h-0 !justify-center !py-2.5 !text-[0.9375rem]"
          >
            Language Groups ({matchingGroups.length})
          </button>
        </div>
      </section>

      {entries.length === 0 ? (
        <p role="status" className="card p-6 text-center font-bold">No matching {category === 'countries' ? 'Playable Countries' : 'Language Groups'}.</p>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(12rem,1fr)_minmax(0,3fr)]">
          <label className="card block space-y-2 p-4">
            <span className="text-[0.875rem] font-extrabold">{category === 'countries' ? 'Playable Country' : 'Language Group'}</span>
            <select
              value={activeId}
              onChange={(event) => {
                if (category === 'countries') setCountryId(event.target.value);
                else setGroupId(event.target.value);
              }}
              className="w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] p-2.5 font-bold"
            >
              {entries.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          {country && <CountryReference country={country} progress={progress} />}
          {contrast && (
            <section className="min-w-0 space-y-4">
              <div className="card space-y-2 p-5">
                <p className="text-[0.8125rem] font-extrabold uppercase tracking-wider text-[var(--brand-accent)]">Contrast Card</p>
                <h2 className="text-[1.375rem] font-black">{contrast.groupName}</h2>
                <p>{contrast.description}</p>
                <p className="text-sm text-[var(--text-secondary)]">{contrast.primeSummary}</p>
              </div>
              <LanguageContrastGrid languages={contrast.languages} headingLevel="h3" />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function CountryReference({ country, progress }: { country: PlayableCountry; progress: ProgressData }) {
  return (
    <article className="card min-w-0 space-y-5 p-5 sm:p-6">
      <header>
        <p className="text-[0.8125rem] font-bold text-[var(--text-secondary)]">{country.region} · {country.subregion}</p>
        <h2 className="text-[1.75rem] font-black">{country.name}</h2>
      </header>
      <dl className="grid gap-3 sm:grid-cols-2 [&>div]:rounded-2xl [&>div]:bg-[var(--surface-elevated)] [&>div]:p-4 [&_dt]:font-extrabold">
        <div>
          <dt className="font-semibold">Coverage Tier</dt>
          <dd className="flex flex-wrap items-center gap-2 capitalize">
            {country.coverageTier}
            <MasteryBadge state={progress.skills[`cov:${country.id}`]?.mastery ?? 'unseen'} />
          </dd>
          <dd className="mt-1 text-sm text-[var(--text-secondary)]">{country.coverageNote}</dd>
        </div>
        <div>
          <dt className="font-semibold">Driving Side</dt>
          <dd className="flex flex-wrap items-center gap-2 capitalize">
            {country.drivingSide}
            <MasteryBadge state={progress.skills[`drive:${country.id}`]?.mastery ?? 'unseen'} />
          </dd>
          {country.drivingNote && <dd className="mt-1 text-sm text-[var(--text-secondary)]">{country.drivingNote}</dd>}
        </div>
        <div>
          <dt className="font-semibold">Country-code domain</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <code>{country.tld}</code>
            <MasteryBadge state={progress.skills[`domain:${country.id}`]?.mastery ?? 'unseen'} />
          </dd>
          <dd className="mt-1 break-words font-mono text-sm text-[var(--text-secondary)]">{country.tldExamples.join(' · ')}</dd>
        </div>
        <div>
          <dt className="font-semibold">Currency</dt>
          {country.currencies.map(({ code, name, symbol, exampleSign }) => {
            const sharedSkill = DOMAINS_CURRENCIES_SKILL_MAP.get(`curr:sign:${symbol}`);
            return (
              <dd key={code} className="mt-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{name} ({code}{symbol === code ? '' : ` · ${symbol}`})</span>
                  <MasteryBadge state={progress.skills[`curr:${code.toLowerCase()}`]?.mastery ?? 'unseen'} />
                </div>
                {sharedSkill?.countries.includes(country) && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>Shared sign {symbol}</span>
                    <MasteryBadge state={progress.skills[sharedSkill.id]?.mastery ?? 'unseen'} />
                  </div>
                )}
                <p dir="auto" className="font-mono text-sm text-[var(--text-secondary)]">{exampleSign}</p>
              </dd>
            );
          })}
        </div>
      </dl>
      <section className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
        <h3 className="font-semibold">Signage languages &amp; Tells</h3>
        <ul className="space-y-2">
          {country.signLanguages.map((id) => {
            const language = LANGUAGE_MAP[id];
            return (
              <li key={id} className="rounded-2xl bg-[var(--surface-elevated)] px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{signageLanguageName(id)}</strong>
                  {language && <MasteryBadge state={progress.skills[`lang:${id}`]?.mastery ?? 'unseen'} />}
                </div>
                {language && (
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
                    {language.tells.map(({ id: tellId, pattern, explanation }) => (
                      <li key={tellId}><strong>{pattern}</strong> · {explanation}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </article>
  );
}
