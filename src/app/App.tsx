import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import type { ProgressStore } from '../storage/progressStore.ts';
import { AppProvider } from './AppContext.tsx';
import { SessionLayout, Shell } from './Shell.tsx';
import { LearnPage } from './pages/LearnPage.tsx';
import { PracticePage } from './pages/PracticePage.tsx';
import { TopicPage } from './pages/TopicPage.tsx';

// The map data and session player are large and only needed once a lesson or a country is opened,
// so they load on demand and the dashboard stays light.
const CreditsPage = lazy(() => import('./pages/CreditsPage.tsx').then((m) => ({ default: m.CreditsPage })));
const CountryPage = lazy(() => import('./pages/ReferencePage.tsx').then((m) => ({ default: m.CountryPage })));
const ReferencePage = lazy(() => import('./pages/ReferencePage.tsx').then((m) => ({ default: m.ReferencePage })));
const SessionPage = lazy(() => import('./pages/SessionPage.tsx').then((m) => ({ default: m.SessionPage })));

/** Routes only; the caller supplies the router (browser in the app, memory in tests). */
export function App({ store }: { store?: ProgressStore }) {
  return (
    <AppProvider customStore={store}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<LearnPage />} />
          <Route path="learn/:topicId" element={<TopicPage />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="reference" element={<ReferencePage />} />
          <Route path="reference/:countryId" element={<CountryPage />} />
          <Route path="credits" element={<CreditsPage />} />
          <Route path="*" element={<LearnPage />} />
        </Route>
        <Route element={<SessionLayout />}>
          <Route path="session/lesson/:id" element={<SessionPage kind="lesson" />} />
          <Route path="session/review" element={<SessionPage kind="review" />} />
          <Route path="session/mixed/:region?" element={<SessionPage kind="mixed" />} />
          <Route path="session/confusion/:a/:b" element={<SessionPage kind="confusion" />} />
          <Route path="session/country/:id" element={<SessionPage kind="country" />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}
