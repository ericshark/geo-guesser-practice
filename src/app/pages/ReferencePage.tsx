import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { CLUES, TOPIC_MAP } from '../../content/index.ts';
import { PLAYABLE_COUNTRIES, PLAYABLE_COUNTRY_MAP } from '../../data/index.ts';
import { signLanguageName } from '../../data/signLanguages.ts';
import { masteryOf, MASTERY_LABEL } from '../../engine/mastery.ts';
import { useApp } from '../AppContext.tsx';
import { useDocumentTitle } from '../useDocumentTitle.ts';
import { MiniMap } from '../ui.tsx';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function ReferencePage() {
  useDocumentTitle('Reference');
  const [query, setQuery] = useState('');
  const countries = useMemo(() => {
    const q = fold(query.trim());
    return PLAYABLE_COUNTRIES.filter((c) => !q || fold(c.name).includes(q)).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [query]);

  return (
    <div className="stack page-narrow" style={{ margin: '0 auto' }}>
      <header className="stack-sm">
        <h1>Reference</h1>
        <p className="muted">Everything the app knows about a country, in one place.</p>
      </header>
      <label className="visually-hidden" htmlFor="country-search">Search countries</label>
      <input
        id="country-search"
        className="input"
        type="search"
        placeholder="Search countries"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="card card-flush">
        {countries.map((c) => {
          const n = CLUES.filter((clue) => clue.countryIds.includes(c.id)).length;
          return (
            <Link key={c.id} className="path-item card-link" to={`/reference/${c.id}`}>
              <div className="stack-sm" style={{ flex: 1 }}>
                <strong>{c.name}</strong>
                <span className="muted small">{c.subregion}</span>
              </div>
              <span className="muted small">{n} clue{n === 1 ? '' : 's'}</span>
            </Link>
          );
        })}
        {countries.length === 0 && <p className="muted" style={{ padding: 20 }}>No country matches “{query}”.</p>}
      </div>
      <p className="muted small"><Link to="/credits" style={{ textDecoration: 'underline' }}>Photo credits</Link></p>
    </div>
  );
}

export function CountryPage() {
  const { countryId = '' } = useParams();
  const { progress } = useApp();
  const country = PLAYABLE_COUNTRY_MAP[countryId];
  useDocumentTitle(country?.name ?? 'Reference');
  if (!country) return <Navigate to="/reference" replace />;

  const clues = CLUES.filter((c) => c.countryIds.includes(country.id));
  const languages = country.signLanguages.map(signLanguageName);
  const currency = country.currencies.map((c) => `${c.name} (${c.symbol})`).join(', ');
  const coverage = { official: 'Official coverage', limited: 'Limited coverage', none: 'No official coverage' }[country.coverageTier];

  return (
    <div className="stack page-narrow" style={{ margin: '0 auto' }}>
      <Link to="/reference" className="row muted small"><ChevronLeft size={16} aria-hidden /> Reference</Link>
      <header className="stack-sm">
        <span className="eyebrow">{country.subregion}</span>
        <h1>{country.name}</h1>
      </header>
      <MiniMap countryIds={[country.id]} />

      <section className="card">
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 24px' }}>
          <dt className="muted">Drives on</dt><dd style={{ margin: 0 }}>the {country.drivingSide}{country.drivingNote ? ` · ${country.drivingNote}` : ''}</dd>
          <dt className="muted">Street View</dt><dd style={{ margin: 0 }}>{coverage}</dd>
          <dt className="muted">Web domain</dt><dd style={{ margin: 0 }}>{country.tld}</dd>
          <dt className="muted">Currency</dt><dd style={{ margin: 0 }}>{currency}</dd>
          <dt className="muted">Signs in</dt><dd style={{ margin: 0 }}>{languages.join(', ')}</dd>
        </dl>
      </section>

      <section className="stack-sm">
        <div className="row-between">
          <h2>Clues for {country.name}</h2>
          {clues.length > 0 && (
            <Link className="btn btn-primary" to={`/session/country/${country.id}`}>Practice this country</Link>
          )}
        </div>
        {clues.length === 0 ? (
          <p className="muted">No clues cover this country yet. More topics are on the way.</p>
        ) : (
          <div className="card card-flush">
            {clues.map((clue) => (
              <div className="path-item" key={clue.id}>
                <div className="stack-sm" style={{ flex: 1 }}>
                  <strong>{clue.title}</strong>
                  <span className="muted small">{TOPIC_MAP[clue.topicId].title} · {clue.spot}</span>
                </div>
                <span className="chip"><i className={`dot dot-${masteryOf(progress.clues[clue.id])}`} /> {MASTERY_LABEL[masteryOf(progress.clues[clue.id])]}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
