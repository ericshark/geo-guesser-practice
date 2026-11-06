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
    expect(html).toContain('Smart Practice (Weakest Spots)');
    expect(html).toContain('All-Groups Mixed');
    expect(html).toContain('Southeast Asian');
    expect(html).toContain('Baltic &amp; Finnic');
  });

  it('renders Guided Breakdown overlay and Stage 2 Triggered Contrast Card cleanly', async () => {
    const store = new ProgressStore(createInMemoryProgressAdapter());
    await store.load();
    const engine = new PracticeEngine(store);

    engine.startLanguageSession({
      groupId: 'central-slavic-hungarian',
      skipPrime: true,
      drillMode: 'samples',
    });

    // Request Guided Breakdown on the active trial and verify rendered overlay
    engine.requestGuidedBreakdown();
    const breakdownHtml = renderToStaticMarkup(
      React.createElement(LanguagesSectionView, {
        engine,
        progress: store.getState(),
        initialGroup: 'central-slavic-hungarian',
        onBackToDashboard: () => {},
      })
    );

    expect(breakdownHtml).toContain('Guided Breakdown · Assisted Exposure');
    expect(breakdownHtml).toContain('Why Each Distractor Option Is Ruled Out');

    // Now trigger a Stage 2 Contrast Card by confusing two skills twice
    const t1 = engine.getCurrentTrial()!;
    const skillA = t1.skillId;
    const skillB = t1.options.find((o) => o.id !== skillA)!.id;
    await engine.submitAnswer(skillB, 2500);

    const t2 = engine.nextTrial();
    await engine.submitAnswer(t2.skillId, 1100);
    const t3 = engine.nextTrial();
    await engine.submitAnswer(t3.skillId, 1100);

    // Next trial after D=2 spacing is the 1st follow-up for skillA; confuse with skillB a 2nd time
    const t4 = engine.nextTrial();
    expect(t4.skillId).toBe(skillA);
    await engine.submitAnswer(skillB, 2600);

    // Advance into the Stage 2 Triggered Contrast Card
    const contrastTrial = engine.nextTrial();
    expect(contrastTrial.kind).toBe('triggered-contrast');

    const contrastHtml = renderToStaticMarkup(
      React.createElement(LanguagesSectionView, {
        engine,
        progress: store.getState(),
        initialGroup: 'central-slavic-hungarian',
        onBackToDashboard: () => {},
      })
    );

    expect(contrastHtml).toContain('Stage 2 Triggered Contrast Card');
    expect(contrastHtml).toContain('Left Sample');
    expect(contrastHtml).toContain('Right Sample');

    // Verify Dashboard renders Weakest Learning Skills, Top Confusion Pairs, and Smart Practice button
    const dashboardHtml = renderToStaticMarkup(
      React.createElement(App, { customStore: store })
    );
    expect(dashboardHtml).toContain('Smart Practice (Weakest Spots)');
    expect(dashboardHtml).toContain('Weakest Learning Skills');
    expect(dashboardHtml).toContain('Top Confusion Pairs');
    expect(dashboardHtml).toContain('mistaken for');
  });
});
