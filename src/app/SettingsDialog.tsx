import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { useApp } from './AppContext.tsx';

const THEME_KEY = 'geoguessr-practice:theme';

function currentTheme(): 'system' | 'light' | 'dark' {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'dark' ? t : 'system';
}

function applyTheme(theme: string) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  try {
    if (root.dataset.theme) localStorage.setItem(THEME_KEY, root.dataset.theme);
    else localStorage.removeItem(THEME_KEY);
  } catch {
    // The document still uses the selected appearance when storage is unavailable.
  }
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { store, progress } = useApp();
  const ref = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const [theme, setTheme] = useState(currentTheme);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
    if (open) {
      setTheme(currentTheme());
      setMessage(null);
      setConfirmReset(false);
    }
  }, [open]);

  const download = () => {
    const blob = new Blob([store.exportBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'geoguessr-academy-progress.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await store.importBackup(await file.text());
    setMessage(
      result.ok
        ? { ok: true, text: `Imported ${result.data.totalAnswers} answers.` }
        : { ok: false, text: `Could not import: ${result.error}` }
    );
    e.target.value = '';
  };

  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onClose={onClose}>
      <div className="stack">
        <h2 id={titleId}>Settings</h2>

        <div className="row-between">
          <label htmlFor="theme">Appearance</label>
          <select
            id="theme"
            className="select"
            value={theme}
            onChange={(e) => {
              setTheme(e.target.value as typeof theme);
              applyTheme(e.target.value);
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="stack-sm">
          <h3>Your data</h3>
          <p className="muted small">
            Progress ({progress.totalAnswers} answers) is stored on this device. Back it up or move it with a file.
          </p>
          <div className="row wrap">
            <button type="button" className="btn" onClick={download}>Download backup</button>
            <label className="btn">
              Import backup
              <input type="file" accept="application/json" onChange={upload} className="visually-hidden" />
            </label>
          </div>
          {message && (
            <p role="status" className={message.ok ? 'small' : 'small'} style={{ color: message.ok ? 'var(--good)' : 'var(--bad)' }}>
              {message.text}
            </p>
          )}
        </div>

        <div className="stack-sm">
          <h3>Reset</h3>
          {confirmReset ? (
            <div className="row wrap">
              <span className="small">Erase all progress? This cannot be undone.</span>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await store.resetAll({ confirmed: true });
                  setConfirmReset(false);
                  setMessage({ ok: true, text: 'Progress reset.' });
                }}
              >
                Erase everything
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          ) : (
            <div>
              <button type="button" className="btn" onClick={() => setConfirmReset(true)}>Reset progress…</button>
            </div>
          )}
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </dialog>
  );
}
