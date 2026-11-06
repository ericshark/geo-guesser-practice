import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardView } from './components/DashboardView.tsx';
import { DataManagementModal } from './components/DataManagementModal.tsx';
import { LanguagesSectionView } from './components/LanguagesSectionView.tsx';
import type { LanguageGroupSelectionId, SectionId } from './data/index.ts';
import { PracticeEngine } from './engine/practiceEngine.ts';
import {
  createBrowserProgressAdapter,
  type ProgressData,
  ProgressStore,
  type SectionMasteryBreakdown,
} from './storage/index.ts';
import './style.css';

type ActiveRoute = 'dashboard' | 'languages';

export function App({ customStore }: { customStore?: ProgressStore }) {
  const store = useMemo(
    () => customStore ?? new ProgressStore(createBrowserProgressAdapter()),
    [customStore]
  );
  const engine = useMemo(() => new PracticeEngine(store), [store]);

  const [progress, setProgress] = useState<ProgressData>(() =>
    store.getState()
  );
  const [route, setRoute] = useState<ActiveRoute>('dashboard');
  const [initialLanguageGroup, setInitialLanguageGroup] =
    useState<LanguageGroupSelectionId | null>(null);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = store.subscribe((nextState) => {
      setProgress(nextState);
    });
    void store.load();
    return unsubscribe;
  }, [store]);

  useEffect(() => {
    document.title =
      route === 'languages'
        ? 'Languages Practice | GeoGuessr Practice'
        : 'Dashboard | GeoGuessr Practice';
  }, [route]);

  const sectionBreakdowns: Record<SectionId, SectionMasteryBreakdown> = useMemo(
    () => ({
      languages: store.getSectionMasteryBreakdown('languages'),
      'driving-side': store.getSectionMasteryBreakdown('driving-side'),
      coverage: store.getSectionMasteryBreakdown('coverage'),
      'domains-currencies':
        store.getSectionMasteryBreakdown('domains-currencies'),
    }),
    [progress, store]
  );

  const handleOpenLanguages = (group?: LanguageGroupSelectionId) => {
    setInitialLanguageGroup(group ?? null);
    setRoute('languages');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link visually-hidden">
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => {
                setInitialLanguageGroup(null);
                setRoute('dashboard');
              }}
              className="flex items-center gap-2.5 text-left font-semibold tracking-tight"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-accent)] text-[0.875rem] font-bold text-white"
              >
                G
              </span>
              <span className="text-[1rem]">GeoGuessr Practice</span>
            </button>

            <nav aria-label="Primary">
              <ul className="flex items-center gap-1" role="list">
                <li>
                  <button
                    type="button"
                    aria-current={route === 'dashboard' ? 'page' : undefined}
                    onClick={() => {
                      setInitialLanguageGroup(null);
                      setRoute('dashboard');
                    }}
                    className={`rounded-lg px-3 py-1.5 text-[0.875rem] font-medium transition ${
                      route === 'dashboard'
                        ? 'bg-zinc-500/12 font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-zinc-500/10'
                    }`}
                  >
                    Dashboard
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    aria-current={route === 'languages' ? 'page' : undefined}
                    onClick={() => handleOpenLanguages()}
                    className={`rounded-lg px-3 py-1.5 text-[0.875rem] font-medium transition ${
                      route === 'languages'
                        ? 'bg-zinc-500/12 font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-zinc-500/10'
                    }`}
                  >
                    Languages
                  </button>
                </li>
              </ul>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-[0.75rem] text-[var(--text-secondary)] sm:inline">
              {progress.totalTrials} trials · {progress.streakDays}d streak
            </span>
            <button
              type="button"
              onClick={() => setIsDataModalOpen(true)}
              className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-zinc-500/10"
            >
              Data & Backup
            </button>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
      >
        {route === 'dashboard' ? (
          <DashboardView
            progress={progress}
            sectionBreakdowns={sectionBreakdowns}
            onOpenLanguagesSection={handleOpenLanguages}
            onOpenDataModal={() => setIsDataModalOpen(true)}
          />
        ) : (
          <LanguagesSectionView
            engine={engine}
            progress={progress}
            initialGroup={initialLanguageGroup}
            onBackToDashboard={() => {
              setInitialLanguageGroup(null);
              setRoute('dashboard');
            }}
          />
        )}
      </main>

      <footer className="border-t border-[var(--border-subtle)] py-4 text-center text-[0.75rem] text-[var(--text-secondary)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 sm:px-6">
          <span>
            GeoGuessr Practice · Local-first perceptual learning (ARTS)
          </span>
          <span>
            Shortcuts: <kbd className="font-mono">1</kbd>–
            <kbd className="font-mono">6</kbd> select ·{' '}
            <kbd className="font-mono">Space</kbd> /{' '}
            <kbd className="font-mono">?</kbd> guided breakdown ·{' '}
            <kbd className="font-mono">Enter</kbd> continue ·{' '}
            <kbd className="font-mono">Esc</kbd> back
          </span>
        </div>
      </footer>

      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        store={store}
      />
    </div>
  );
}

const rootElement =
  typeof document !== 'undefined' ? document.getElementById('root') : null;
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
