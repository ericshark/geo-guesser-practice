import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ProgressData } from '../storage/schema.ts';
import { createBrowserProgressAdapter, ProgressStore } from '../storage/progressStore.ts';

interface AppContextValue {
  store: ProgressStore;
  progress: ProgressData;
  /** False until saved progress has been read, so screens never flash an empty state. */
  ready: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  children,
  customStore,
}: {
  children: ReactNode;
  customStore?: ProgressStore;
}) {
  const store = useMemo(
    () => customStore ?? new ProgressStore(createBrowserProgressAdapter()),
    [customStore]
  );
  const [progress, setProgress] = useState<ProgressData>(() => store.getState());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = store.subscribe(setProgress);
    let cancelled = false;
    void store.load().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [store]);

  const value = useMemo(() => ({ store, progress, ready }), [store, progress, ready]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
