import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { App } from './main.tsx';
import { LanguagesSectionView } from './components/LanguagesSectionView.tsx';
import { PracticeEngine } from './engine/practiceEngine.ts';
import { ProgressStore, createInMemoryProgressAdapter } from './storage/index.ts';
import { buildHighlightedTextSegments } from './utils/highlightSpans.ts';

describe('UI & Highlighting Verification', () => {
  it('splits sample text into highlighted Tell spans and plain text segments', () => {
    const sampleText = 'Bahnhofstraße in München';
    const segments = buildHighlightedTextSegments(sampleText, [
      {
        tellId: 'de-eszett',
        pattern: 'ß / ü',
        label: 'Eszett & umlaut',
        explanation: 'German characters',
        isUnique: true,
        colorIndex: 0,
        spans: [
          { start: 11, end: 12, text: 'ß' },
          { start: 18, end: 19, text: 'ü' },
        ],
      },
    ]);

    expect(segments).toEqual([
      { text: 'Bahnhofstra' },
      {
        text: 'ß',
        tellMatch: {
          tellId: 'de-eszett',
          label: 'Eszett & umlaut',
          pattern: 'ß / ü',
          colorIndex: 0,
        },
      },
      { text: 'e in M' },
      {
        text: 'ü',
        tellMatch: {
          tellId: 'de-eszett',
          label: 'Eszett & umlaut',
          pattern: 'ß / ü',
          colorIndex: 0,
        },
      },
      { text: 'nchen' },
    ]);
  });

  it('renders Dashboard with all 4 Sections, Mastery State breakdowns, and Language Group quick launch', async () => {
    const store = new ProgressStore(createInMemoryProgressAdapter());
    await store.load();
    const html = renderToStaticMarkup(React.createElement(App, { customStore: store }));

    expect(html).toContain('Dashboard');
    expect(html).toContain('Languages');
    expect(html).toContain('Driving Side');
    expect(html).toContain('Coverage');
    expect(html).toContain('Domains &amp; Currencies');
    expect(html).toContain('East Asian');
    expect(html).toContain('Central European Slavic &amp; Hungarian');
  });

  it('renders Languages Section Group Picker cleanly', async () => {
    const store = new ProgressStore(createInMemoryProgressAdapter());
    await store.load();
    const engine = new PracticeEngine(store);
    const html = renderToStaticMarkup(
      React.createElement(LanguagesSectionView, {
        engine,
        progress: store.getState(),
        onBackToDashboard: () => {},
      })
    );

    expect(html).toContain('Choose a Confusable Language Group');
    expect(html).toContain('All-Groups Mixed');
    expect(html).toContain('Southeast Asian');
    expect(html).toContain('Baltic &amp; Finnic');
  });
});
