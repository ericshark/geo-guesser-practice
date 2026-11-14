import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { CLUES } from '../../content/index.ts';
import type { WorldRegion } from '../../data/types.ts';
import { dueClues, SESSION_LENGTH, type PracticeRegion } from '../../engine/sessionBuilder.ts';
import { useApp } from '../AppContext.tsx';
import { useDocumentTitle } from '../useDocumentTitle.ts';

const REGIONS: WorldRegion[] = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'];

export function PracticePage() {
  useDocumentTitle('Practice');
  const { progress } = useApp();
  const [region, setRegion] = useState<PracticeRegion>('all');
  const learned = CLUES.filter((c) => progress.clues[c.id]);
  const inScope = learned.filter((c) => region === 'all' || c.regions.includes(region));
  const due = dueClues(progress, new Date()).length;
  const questions = Math.min(SESSION_LENGTH, inScope.length);

  return (
    <div className="stack page-narrow" style={{ margin: '0 auto' }}>
      <header className="stack-sm">
        <h1>Practice</h1>
        <p className="muted">Mixed questions from everything you have learned, with the weakest and most overdue clues first.</p>
      </header>

      <section className="card stack" aria-labelledby="scope-title">
        <div className="stack-sm">
          <h2 id="scope-title">Where?</h2>
          <div className="row wrap" role="group" aria-label="Region">
            <button type="button" className="chip" aria-pressed={region === 'all'} onClick={() => setRegion('all')}>
              Everywhere · {learned.length}
            </button>
            {REGIONS.map((r) => {
              const n = learned.filter((c) => c.regions.includes(r)).length;
              return (
                <button
                  type="button"
                  key={r}
                  className="chip"
                  aria-pressed={region === r}
                  disabled={n === 0}
                  onClick={() => setRegion(r)}
                  style={n === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                >
                  {r} · {n}
                </button>
              );
            })}
          </div>
        </div>

        {learned.length === 0 ? (
          <p className="muted">Complete a lesson first. Practice draws on the clues you have learned.</p>
        ) : (
          <div className="row-between wrap">
            <p className="muted">
              {questions} question{questions === 1 ? '' : 's'} from {inScope.length} learned clue{inScope.length === 1 ? '' : 's'}
            </p>
            <Link
              className="btn btn-primary btn-lg"
              to={`/session/mixed/${encodeURIComponent(region)}`}
              aria-disabled={inScope.length === 0}
            >
              Start practice <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        )}
      </section>

      {due > 0 && (
        <section className="card row-between wrap">
          <div className="stack-sm">
            <h2>{due} clue{due === 1 ? '' : 's'} due for review</h2>
            <p className="muted small">Due clues are always included first in mixed practice.</p>
          </div>
          <Link className="btn" to="/session/review">Review due</Link>
        </section>
      )}
    </div>
  );
}
