import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CoverageSectionView } from './components/CoverageSectionView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { DataManagementModal } from './components/DataManagementModal.tsx';
import { DomainsCurrenciesSectionView } from './components/DomainsCurrenciesSectionView.tsx';
import { FieldGuideView } from './components/FieldGuideView.tsx';
import { DrivingSideSectionView } from './components/DrivingSideSectionView.tsx';
import { LanguagesSectionView } from './components/LanguagesSectionView.tsx';
import type {
  CoverageFocusId,
  DrivingSideFocusId,
  LanguageGroupSelectionId,
  SectionId,
} from './data/index.ts';
import { PracticeEngine } from './engine/practiceEngine.ts';
import {
  createBrowserProgressAdapter,
  type ProgressData,
  ProgressStore,
  type SectionMasteryBreakdown,
} from './storage/index.ts';
import './style.css';

const ROUTE_LABELS = {
  dashboard: 'Dashboard',
  languages: 'Languages',
  'driving-side': 'Driving Side',
  coverage: 'Coverage',
  'domains-currencies': 'Domains & Currencies',
  'field-guide': 'Field Guide',
};

type ActiveRoute = keyof typeof ROUTE_LABELS;

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
  const [initialDrivingFocus, setInitialDrivingFocus] =
    useState<DrivingSideFocusId | null>(null);
  const [initialCoverageFocus, setInitialCoverageFocus] =
    useState<CoverageFocusId | null>(null);
  const [initialSignSkill, setInitialSignSkill] = useState<string>();
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = store.subscribe((nextState) => {
      setProgress(nextState);
    });
    void store.load();
    return unsubscribe;
  }, [store]);

  useEffect(() => {
    document.title = `${ROUTE_LABELS[route]} | GeoGuessr Practice`;
    window.scrollTo(0, 0);
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

  const handleOpenDrivingSide = (focus?: DrivingSideFocusId) => {
    setInitialDrivingFocus(focus ?? null);
    setRoute('driving-side');
  };

  const handleOpenCoverage = (focus?: CoverageFocusId) => {
    setInitialCoverageFocus(focus ?? null);
    setRoute('coverage');
  };

  const handleOpenDomainsCurrencies = (skillId?: string) => {
    setInitialSignSkill(skillId);
    setRoute('domains-currencies');
  };

  const navigation: [ActiveRoute, () => void][] = [
    ['dashboard', () => setRoute('dashboard')],
    ['languages', () => handleOpenLanguages()],
    ['driving-side', () => handleOpenDrivingSide()],
    ['coverage', () => handleOpenCoverage()],
    ['domains-currencies', () => handleOpenDomainsCurrencies()],
    ['field-guide', () => setRoute('field-guide')],
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link visually-hidden">
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setRoute('dashboard')}
            className="flex items-center gap-2.5 text-left font-semibold tracking-tight"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-accent)] text-[0.875rem] font-bold text-white"
            >
              G
            </span>
            GeoGuessr Practice
          </button>
          <nav aria-label="Primary" className="order-last w-full lg:order-none lg:w-auto">
            <ul className="flex flex-wrap items-center gap-1" role="list">
              {navigation.map(([id, open]) => (
                <li key={id}>
                  <button
                    type="button"
                    aria-current={route === id ? 'page' : undefined}
                    onClick={open}
                    className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                      route === id
                        ? 'bg-zinc-500/12 font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-zinc-500/10'
                    }`}
                  >
                    {ROUTE_LABELS[id]}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-[0.75rem] text-[var(--text-secondary)] sm:inline">
              {progress.totalTrials} trials · {progress.streakDays}d streak
            </span>
            <button
              type="button"
              onClick={() => setIsDataModalOpen(true)}
              className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-zinc-500/10"
            >
              Data &amp; Backup
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
            onOpenDrivingSideSection={handleOpenDrivingSide}
            onOpenCoverageSection={handleOpenCoverage}
            onOpenDomainsCurrenciesSection={handleOpenDomainsCurrencies}
            onOpenDataModal={() => setIsDataModalOpen(true)}
          />
        ) : route === 'driving-side' ? (
          <DrivingSideSectionView
            engine={engine}
            progress={progress}
            initialFocus={initialDrivingFocus}
            onBackToDashboard={() => {
              setInitialDrivingFocus(null);
              setRoute('dashboard');
            }}
          />
        ) : route === 'coverage' ? (
          <CoverageSectionView
            engine={engine}
            progress={progress}
            initialFocus={initialCoverageFocus}
            onBackToDashboard={() => {
              setInitialCoverageFocus(null);
              setRoute('dashboard');
            }}
          />
        ) : route === 'domains-currencies' ? (
          <DomainsCurrenciesSectionView
            engine={engine}
            initialSkillId={initialSignSkill}
            onBackToDashboard={() => setRoute('dashboard')}
          />
        ) : route === 'field-guide' ? (
          <FieldGuideView progress={progress} />
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
