import React, { useEffect, useId, useRef, useState } from 'react';
import type { SectionId } from '../data/types.ts';
import type { ProgressStore } from '../storage/index.ts';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: ProgressStore;
}

export function DataManagementModal({
  isOpen,
  onClose,
  store,
}: DataManagementModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const importTextareaId = useId();
  const fileInputId = useId();

  const [importText, setImportText] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pendingResetTarget, setPendingResetTarget] = useState<
    SectionId | 'all' | null
  >(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleDownloadBackup = () => {
    const json = store.exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geoguessr-practice-progress-v1.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage({
      kind: 'success',
      text: 'Exported versioned progress backup JSON.',
    });
  };

  const handleLoadCurrentIntoEditor = () => {
    setImportText(store.exportBackup());
    setStatusMessage(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportText(text);
    const result = await store.importBackup(text);
    if (result.ok) {
      setStatusMessage({
        kind: 'success',
        text: `Imported backup (${result.data.totalTrials} total trials).`,
      });
    } else {
      setStatusMessage({
        kind: 'error',
        text: `Backup validation failed: ${result.error}`,
      });
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await store.importBackup(importText);
    if (result.ok) {
      setStatusMessage({
        kind: 'success',
        text: `Imported backup successfully (${result.data.totalTrials} total trials).`,
      });
    } else {
      setStatusMessage({
        kind: 'error',
        text: `Backup validation failed: ${result.error}`,
      });
    }
  };

  const handleConfirmReset = async () => {
    if (!pendingResetTarget) return;
    if (pendingResetTarget === 'all') {
      await store.resetAll({ confirmed: true });
      setStatusMessage({
        kind: 'success',
        text: 'All progress and Mastery States have been reset.',
      });
    } else {
      await store.resetSection(pendingResetTarget, { confirmed: true });
      setStatusMessage({
        kind: 'success',
        text: `Reset progress for the ${pendingResetTarget} Section.`,
      });
    }
    setPendingResetTarget(null);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="card m-auto w-[calc(100%-2rem)] max-w-xl p-6 text-[var(--text-primary)] backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h2 id={titleId} className="text-[1.375rem] font-black">
            Progress Persistence & Backup
          </h2>
          <p className="mt-1 text-[0.875rem] text-[var(--text-secondary)]">
            Automatically synced to <code>data/progress.json</code> on disk and
            mirrored in browser <code>IndexedDB</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-sm"
        >
          Close
        </button>
      </div>

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-[0.875rem] ${
            statusMessage.kind === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span aria-hidden="true">
            {statusMessage.kind === 'success' ? '✓' : '⚠'}
          </span>
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="mt-5 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="btn btn-primary btn-sm"
          >
            Download JSON Backup
          </button>
          <button
            type="button"
            onClick={handleLoadCurrentIntoEditor}
            className="btn btn-secondary btn-sm"
          >
            Inspect Current JSON
          </button>
          <div>
            <label
              htmlFor={fileInputId}
              className="btn btn-secondary btn-sm"
            >
              Upload Backup File
            </label>
            <input
              id={fileInputId}
              type="file"
              accept="application/json,.json"
              onChange={handleFileUpload}
              className="visually-hidden"
            />
          </div>
        </div>

        <form onSubmit={handleImportSubmit} className="space-y-2.5">
          <label
            htmlFor={importTextareaId}
            className="block text-[0.875rem] font-medium"
          >
            Import or Paste Backup JSON (Validated with Zod Schema v1)
          </label>
          <textarea
            id={importTextareaId}
            rows={5}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"version": 1, ...}'
            className="w-full rounded-xl border-2 border-[var(--border-strong)] bg-[var(--surface-canvas)] p-3 font-mono text-[0.8125rem]"
          />
          <button
            type="submit"
            disabled={!importText.trim()}
            className="btn btn-secondary btn-sm"
          >
            Validate & Import JSON
          </button>
        </form>

        <div className="border-t border-[var(--border-subtle)] pt-4">
          <h3 className="text-[0.9375rem] font-semibold">
            Reset Training Data
          </h3>
          <p className="mt-0.5 text-[0.8125rem] text-[var(--text-secondary)]">
            Resetting requires explicit confirmation before clearing records.
          </p>

          {!pendingResetTarget ? (
            <div className="mt-3 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setPendingResetTarget('languages')}
                className="btn btn-secondary btn-sm !text-[var(--bad)]"
              >
                Reset Languages Section…
              </button>
              <button
                type="button"
                onClick={() => setPendingResetTarget('all')}
                className="btn btn-secondary btn-sm !text-[var(--bad)]"
              >
                Reset All Progress…
              </button>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3.5">
              <p className="text-[0.875rem] font-medium text-rose-800 dark:text-rose-200">
                Confirm reset for{' '}
                <strong>
                  {pendingResetTarget === 'all'
                    ? 'ALL Sections and trial history'
                    : `the ${pendingResetTarget} Section`}
                </strong>
                ? This action overwrites <code>data/progress.json</code>.
              </p>
              <div className="mt-2.5 flex gap-2.5">
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="btn btn-bad btn-sm"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setPendingResetTarget(null)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
