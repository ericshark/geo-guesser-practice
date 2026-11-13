import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Flame, Keyboard, Settings, type LucideIcon } from 'lucide-react';
import {
  DASHBOARD_ICON,
  FIELD_GUIDE_ICON,
  SECTION_META,
  SECTION_ORDER,
} from './components/sectionMeta.ts';
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

function handleAppearanceChange(event: React.ChangeEvent<HTMLSelectElement>) {
  const theme = event.currentTarget.value;
  const root = document.documentElement;
  const storageKey = 'geoguessr-practice:theme';

  if (theme === 'light' || theme === 'dark') {
    root.dataset.theme = theme;
  } else {
    delete root.dataset.theme;
  }

  try {
    if (root.dataset.theme) {
      localStorage.setItem(storageKey, root.dataset.theme);
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch {
    // The document still uses the selected appearance when storage is unavailable.
  }
}

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

  const navigation: Array<{
    id: ActiveRoute;
    label: string;
    icon: LucideIcon;
    color: string;
    open: () => void;
  }> = [
    { id: 'dashboard', label: ROUTE_LABELS.dashboard, icon: DASHBOARD_ICON, color: 'var(--brand-accent)', open: () => setRoute('dashboard') },
    ...SECTION_ORDER.map((sectionId) => ({
      id: sectionId as ActiveRoute,
      label: SECTION_META[sectionId].shortTitle,
      icon: SECTION_META[sectionId].icon,
      color: SECTION_META[sectionId].color,
      open: {
        languages: () => handleOpenLanguages(),
        'driving-side': () => handleOpenDrivingSide(),
        coverage: () => handleOpenCoverage(),
        'domains-currencies': () => handleOpenDomainsCurrencies(),
      }[sectionId],
    })),
    { id: 'field-guide', label: 'Guide', icon: FIELD_GUIDE_ICON, color: 'var(--xp)', open: () => setRoute('field-guide') },
  ];

  const renderNavButton = (
    item: (typeof navigation)[number],
    variant: 'top' | 'bottom'
  ) => {
    const Icon = item.icon;
    const active = route === item.id;
    return (
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={item.open}
        title={ROUTE_LABELS[item.id]}
        className={
          variant === 'top'
            ? `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[0.875rem] font-extrabold transition ${
                active
                  ? 'bg-[var(--surface-elevated)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]'
              }`
            : `flex w-full min-w-0 flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[0.625rem] font-extrabold tracking-tight [&>span]:max-w-full [&>span]:truncate ${
                active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
              }`
        }
      >
        <Icon
          aria-hidden="true"
          className={variant === 'top' ? 'h-[1.125rem] w-[1.125rem]' : 'h-6 w-6'}
          style={{ color: active ? item.color : undefined }}
          strokeWidth={active ? 2.5 : 2}
        />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen flex flex-col pb-20 lg:pb-0">
      <a href="#main-content" className="skip-link visually-hidden">
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-card)_85%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => setRoute('dashboard')}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-left text-[1.0625rem] font-black tracking-tight"
          >
            <img src="/compass.svg" alt="" aria-hidden="true" className="h-8 w-8" />
            <span>
              Geo<span className="text-[var(--brand-accent)]">Practice</span>
            </span>
          </button>

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-1" role="list">
              {navigation.map((item) => (
                <li key={item.id}>{renderNavButton(item, 'top')}</li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <span
              className="chip !text-[0.8125rem] !text-[var(--xp)]"
              title={`${progress.streakDays}-day streak · ${progress.totalTrials} questions answered`}
            >
              <Flame aria-hidden="true" className="h-4 w-4" fill="currentColor" />
              {progress.streakDays}
              <span className="visually-hidden">day streak</span>
            </span>
            <details className="relative">
              <summary
                className="btn btn-ghost btn-sm !px-2 list-none [&::-webkit-details-marker]:hidden"
                aria-label="Settings"
                title="Settings"
              >
                <Settings aria-hidden="true" className="h-5 w-5" />
              </summary>
              <div className="card absolute right-0 z-40 mt-2 w-64 space-y-3 p-4">
                <label className="block space-y-1 text-[0.8125rem] font-bold">
                  <span className="text-[var(--text-secondary)]">Appearance</span>
                  <select
                    defaultValue={
                      typeof document === 'undefined'
                        ? 'system'
                        : document.documentElement.dataset.theme ?? 'system'
                    }
                    onChange={handleAppearanceChange}
                    className="w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-card)] px-2.5 py-2 font-bold"
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.closest('details')?.removeAttribute('open');
                    setIsDataModalOpen(true);
                  }}
                  className="btn btn-secondary btn-sm w-full"
                >
                  Data &amp; Backup
                </button>
                <div className="border-t border-[var(--border-subtle)] pt-3 text-[0.75rem] text-[var(--text-secondary)]">
                  <p className="mb-1.5 flex items-center gap-1.5 font-extrabold text-[var(--text-primary)]">
                    <Keyboard aria-hidden="true" className="h-4 w-4" /> Shortcuts
                  </p>
                  <ul className="space-y-1" role="list">
                    <li><kbd className="key-badge !h-5 !min-w-5 !text-[0.6875rem]">1</kbd>–<kbd className="key-badge !h-5 !min-w-5 !text-[0.6875rem]">6</kbd> pick an answer</li>
                    <li><kbd className="key-badge !h-5 !text-[0.6875rem]">Space</kbd> / <kbd className="key-badge !h-5 !min-w-5 !text-[0.6875rem]">?</kbd> show a hint</li>
                    <li><kbd className="key-badge !h-5 !text-[0.6875rem]">Enter</kbd> continue</li>
                    <li><kbd className="key-badge !h-5 !text-[0.6875rem]">Esc</kbd> go back</li>
                  </ul>
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-card)_92%,transparent)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-6 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1" role="list">
          {navigation.map((item) => (
            <li key={item.id}>{renderNavButton(item, 'bottom')}</li>
          ))}
        </ul>
      </nav>

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

      <footer className="hidden py-5 text-center text-[0.75rem] font-semibold text-[var(--text-secondary)] lg:block">
        GeoGuessr Practice · Your progress stays on this device
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
