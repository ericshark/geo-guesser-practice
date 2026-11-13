import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import credits from '../../content/mediaCredits.json';
import { useDocumentTitle } from '../useDocumentTitle.ts';

interface Credit {
  title: string;
  author: string;
  licence: string;
  licenceUrl?: string;
  source: string;
}

export function CreditsPage() {
  useDocumentTitle('Photo credits');
  const entries = Object.entries(credits as Record<string, Credit>);
  return (
    <div className="stack page-narrow" style={{ margin: '0 auto' }}>
      <Link to="/reference" className="row muted small"><ChevronLeft size={16} aria-hidden /> Reference</Link>
      <header className="stack-sm">
        <h1>Photo credits</h1>
        <p className="muted">Photos are freely licensed images from Wikimedia Commons, resized for this app. Each links to its source page.</p>
      </header>
      <div className="card card-flush">
        {entries.map(([id, c]) => (
          <div className="path-item" key={id}>
            <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
              <a href={c.source} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{c.title}</a>
              <span className="muted small">{c.author}</span>
            </div>
            {c.licenceUrl ? (
              <a className="chip" href={c.licenceUrl} target="_blank" rel="noreferrer">{c.licence}</a>
            ) : (
              <span className="chip">{c.licence}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
