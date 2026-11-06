import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { App } from './main.tsx';
import { CoverageSectionView } from './components/CoverageSectionView.tsx';
import { LanguagesSectionView } from './components/LanguagesSectionView.tsx';
import { WorldMapView } from './components/WorldMapView.tsx';
import {
  COUNTRY_MAP_GEOMETRIES,
  MAP_REGION_PRESETS,
  PLAYABLE_COUNTRIES,
  PLAYABLE_COUNTRY_MAP,
} from './data/index.ts';
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

  it('renders offline vector WorldMapView with all Playable Countries, 8 regional zoom presets, small territory pill markers, and Stage 3 Bridge feedback', async () => {
    // Verify every PlayableCountry has offline vector map geometry
    expect(Object.keys(COUNTRY_MAP_GEOMETRIES)).toHaveLength(
      PLAYABLE_COUNTRIES.length
    );
    for (const country of PLAYABLE_COUNTRIES) {
      const geom = COUNTRY_MAP_GEOMETRIES[country.id];
      expect(geom).toBeDefined();
      expect(geom.svgPath).toContain('M');
      expect(geom.svgPath).toContain('Z');
    }

    // Verify all 8 required regional zoom presets
    expect(MAP_REGION_PRESETS.map((p) => p.label)).toEqual([
      'World',
      'Europe',
      'Asia',
      'South & SE Asia',
      'Africa',
      'Southern & Eastern Africa',
      'Oceania',
      'Americas',
    ]);

    // Verify all required small GeoGuessr territories and microstates have pill markers
    const requiredTerritories = [
      'hk',
      'mo',
      'sg',
      'mt',
      'cy',
      'lu',
      'ad',
      'mc',
      'sm',
      'fo',
      'gi',
      'bm',
      'vi',
      'pr',
      'cw',
      're',
      'cx',
    ];
    for (const code of requiredTerritories) {
      const country = PLAYABLE_COUNTRY_MAP[code];
      const geom = COUNTRY_MAP_GEOMETRIES[code];
      expect(country?.isTerritory).toBe(true);
      expect(geom?.centerSvg).toHaveLength(2);
      expect(geom?.pillOffsetSvg).toHaveLength(2);
    }

    const mapHtml = renderToStaticMarkup(
      React.createElement(WorldMapView, {
        selectedCountryIds: ['sg'],
        onToggleCountry: () => {},
      })
    );
    expect(mapHtml).toContain('South &amp; SE Asia');
    expect(mapHtml).toContain('Southern &amp; Eastern Africa');
    expect(mapHtml).toContain('Christmas Island');
    expect(mapHtml).toContain('Curaçao');
    expect(mapHtml).toContain('Faroe Islands');

    // Verify Stage 3 Bridge trial and emerald/amber/rose evaluation feedback in LanguagesSectionView
    const store = new ProgressStore(createInMemoryProgressAdapter());
    await store.load();
    const engine = new PracticeEngine(store);
    engine.startLanguageSession({
      groupId: 'east-asian',
      skipPrime: true,
      drillMode: 'bridge',
    });

    const bridgeTrial = engine.getCurrentTrial()!;
    expect(bridgeTrial.kind).toBe('country-bridge');

    // Submit partial/imperfect answer including an uncovered country ('cn')
    await engine.submitCountryBridgeAnswer(['sg', 'cn'], 2800);

    const bridgeFeedbackHtml = renderToStaticMarkup(
      React.createElement(LanguagesSectionView, {
        engine,
        progress: store.getState(),
        initialGroup: 'east-asian',
        onBackToDashboard: () => {},
      })
    );

    expect(bridgeFeedbackHtml).toContain('Stage 3 Map Selection Breakdown');
    expect(bridgeFeedbackHtml).toContain('Correct Selections');
    expect(bridgeFeedbackHtml).toContain('Missed Candidate Countries');
    expect(bridgeFeedbackHtml).toContain('Incorrect Clicks');
    expect(bridgeFeedbackHtml).toContain('Uncovered in Street View');
  });

  it('renders CoverageSectionView Focus Picker, active drills, Guided Breakdown, and exact Coverage Tier + Limited regional coverage notes on feedback', async () => {
    const store = new ProgressStore(createInMemoryProgressAdapter());
    await store.load();
    const engine = new PracticeEngine(store);

    // 1. Focus Picker view with all 7 regional focuses and interactive Coverage Tier World Map
    const pickerHtml = renderToStaticMarkup(
      React.createElement(CoverageSectionView, {
        engine,
        progress: store.getState(),
        onBackToDashboard: () => {},
      })
    );
    expect(pickerHtml).toContain('Coverage Practice');
    expect(pickerHtml).toContain('Choose a Regional Focus');
    expect(pickerHtml).toContain('Common Trap Countries');
    expect(pickerHtml).toContain('Interactive Street View Coverage Tier Map');
    expect(pickerHtml).toContain('Lagos'); // Inspected default country 'ng' (Nigeria) regional note

    // 2. Start a Coverage cluster session in Africa, request Guided Breakdown, and render
    engine.startCoverageSession({
      focusId: 'Africa',
      drillMode: 'neighbor-cluster',
    });
    engine.requestGuidedBreakdown();

    const activeClusterHtml = renderToStaticMarkup(
      React.createElement(CoverageSectionView, {
        engine,
        progress: store.getState(),
        initialFocus: 'Africa',
        onBackToDashboard: () => {},
      })
    );
    expect(activeClusterHtml).toContain('Neighboring Cluster Coverage Trap');
    expect(activeClusterHtml).toContain(
      'Guided Breakdown · Assisted Scaffolding'
    );

    // 3. Submit answer and verify exact Coverage Tier on the map and Regional Street View Coverage Notes for Limited countries
    const currentTrial = engine.getCurrentTrial()!;
    const targetCountry = currentTrial.coveragePrompt!.targetCountry;
    await engine.submitCoverageAnswer(`cov:${targetCountry.id}`, 1800);

    const feedbackHtml = renderToStaticMarkup(
      React.createElement(CoverageSectionView, {
        engine,
        progress: store.getState(),
        initialFocus: 'Africa',
        onBackToDashboard: () => {},
      })
    );
    expect(feedbackHtml).toContain('Exact Coverage Tier on the Map');
    expect(feedbackHtml).toContain(
      'Regional Street View Coverage Notes (Limited Coverage)'
    );
  });
});
