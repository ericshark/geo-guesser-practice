import { Route, Routes } from 'react-router-dom';
import type { ProgressStore } from '../storage/progressStore.ts';
import { AppProvider } from './AppContext.tsx';
import { SessionLayout, Shell } from './Shell.tsx';
import { LearnPage } from './pages/LearnPage.tsx';
import { PracticePage } from './pages/PracticePage.tsx';
import { CountryPage, ReferencePage } from './pages/ReferencePage.tsx';
import { SessionPage } from './pages/SessionPage.tsx';
import { TopicPage } from './pages/TopicPage.tsx';

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
