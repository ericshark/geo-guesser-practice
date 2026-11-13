import { Suspense, useEffect, useId, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Compass, Settings } from 'lucide-react';
import { useApp } from './AppContext.tsx';
import { SettingsDialog } from './SettingsDialog.tsx';

const NAV = [
  { to: '/', label: 'Learn', end: true },
  { to: '/practice', label: 'Practice', end: false },
  { to: '/reference', label: 'Reference', end: false },
];

export function Shell() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { ready } = useApp();
  const location = useLocation();
  const mainId = useId();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      <a className="skip-link" href={`#${mainId}`}>Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand" aria-label="GeoGuessr Academy, home">
            <Compass size={20} aria-hidden />
            <span>GeoGuessr Academy</span>
          </NavLink>
          <nav className="nav" aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>{item.label}</NavLink>
            ))}
          </nav>
          <button type="button" className="btn btn-ghost" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <Settings size={18} aria-hidden />
          </button>
        </div>
      </header>
      <main id={mainId} className="page">
        {ready ? (
          <Suspense fallback={<p className="muted" role="status">Loading…</p>}>
            <Outlet />
          </Suspense>
        ) : (
          <p className="muted" role="status">Loading your progress…</p>
        )}
      </main>
      <nav className="tabbar" aria-label="Main">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>{item.label}</NavLink>
        ))}
      </nav>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

/** Session screens replace the whole shell with a focused, distraction-free layout. */
export function SessionLayout() {
  const { ready } = useApp();
  return (
    <main>
      {ready ? (
        <Suspense fallback={<p className="muted session" role="status">Loading…</p>}>
          <Outlet />
        </Suspense>
      ) : (
        <p className="muted session" role="status">Loading…</p>
      )}
    </main>
  );
}
