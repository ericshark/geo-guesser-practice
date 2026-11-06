import React, { useEffect, useRef, useState } from 'react';
import {
  DRIVING_SIDE_FOCUS_MAP,
  DRIVING_SIDE_FOCUS_OPTIONS,
  PLAYABLE_COUNTRY_MAP,
  getCountriesForDrivingSideFocus,
  type DrivingSide,
  type DrivingSideFocusId,
  type MapRegionPresetId,
  type TellSpanMatch,
} from '../data/index.ts';
import {
  DRIVING_SIDE_FLUENCY_THRESHOLD_MS,
  type DrivingSideDrillMode,
  type DrivingSideTrialFeedback,
  type GuidedBreakdown,
  type PracticeEngine,
  type PracticeTrial,
} from '../engine/practiceEngine.ts';
import type { ProgressData } from '../storage/index.ts';
import { buildHighlightedTextSegments } from '../utils/highlightSpans.ts';
import { MasteryBadge } from './MasteryBadge.tsx';
import { WorldMapView } from './WorldMapView.tsx';

interface DrivingSideSectionViewProps {
  engine: PracticeEngine;
  progress: ProgressData;
  initialFocus?: DrivingSideFocusId | null;
  onBackToDashboard: () => void;
}

const TELL_HIGHLIGHT_CLASSES = [
  'bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 border-b-2 border-indigo-500 px-1 rounded-xs font-semibold',
  'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-b-2 border-amber-500 px-1 rounded-xs font-semibold',
  'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-b-2 border-rose-500 px-1 rounded-xs font-semibold',
  'bg-teal-500/20 text-teal-800 dark:text-teal-200 border-b-2 border-teal-500 px-1 rounded-xs font-semibold',
];

const DRILL_MODE_OPTIONS: Array<{
  id: DrivingSideDrillMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: 'mixed',
    label: 'Mixed Drills (Adaptive)',
    shortLabel: 'Mixed',
    description:
      'Interleaves Rapid Left/Right Speed Drills, Regional Map Drills, and Multi-Clue Narrowing.',
  },
  {
    id: 'speed-left-right',
    label: 'Left / Right Speed Drills',
    shortLabel: 'Left/Right Speed',
    description:
      'Rapid 2-choice Left-Hand vs Right-Hand Traffic drills (<2.5s fluency target) with tricky border focus.',
  },
  {
    id: 'regional-map',
    label: 'Regional Map Drills',
    shortLabel: 'Regional Map',
    description:
      'Click every left-driving covered country in Europe, Southern & Eastern Africa, South & SE Asia, Oceania, or Americas & Caribbean.',
  },
  {
    id: 'multi-clue-narrowing',
    label: 'Multi-Clue Narrowing',
    shortLabel: 'Multi-Clue',
    description:
      'Combine driving side with a second script or Sign Text clue and select the matching Candidate Countries on the map.',
  },
];

function formatDrivingSideLabel(side: DrivingSide): string {
  return side === 'left'
    ? 'Left-Hand Traffic (LHT)'
    : 'Right-Hand Traffic (RHT)';
}

function renderSignSampleText(
  text: string,
  tells: TellSpanMatch[] | undefined,
  highlightTells: boolean
) {
  if (!highlightTells || !tells || tells.length === 0) {
    return <span>{text}</span>;
  }
  const segments = buildHighlightedTextSegments(text, tells);
  return (
    <>
      {segments.map((seg, idx) => {
        if (!seg.tellMatch) {
          return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
        }
        const cls =
          TELL_HIGHLIGHT_CLASSES[
            seg.tellMatch.colorIndex % TELL_HIGHLIGHT_CLASSES.length
          ];
        return (
          <mark
            key={idx}
            className={cls}
            title={`${seg.tellMatch.pattern} — ${seg.tellMatch.label}`}
          >
            {seg.text}
          </mark>
        );
      })}
    </>
  );
}

export function DrivingSideSectionView({
  engine,
  progress,
  initialFocus,
  onBackToDashboard,
}: DrivingSideSectionViewProps) {
  const [selectedFocus, setSelectedFocus] = useState<DrivingSideFocusId | null>(
    initialFocus ?? null
  );
  const [drillMode, setDrillMode] = useState<DrivingSideDrillMode>('mixed');
  const [currentTrial, setCurrentTrial] = useState<PracticeTrial | null>(() =>
    engine.getActiveSection() === 'driving-side'
      ? engine.getCurrentTrial()
      : null
  );
  const [feedback, setFeedback] = useState<DrivingSideTrialFeedback | null>(
    () =>
      engine.getActiveSection() === 'driving-side'
        ? engine.getLastDrivingFeedback()
        : null
  );
  const [guidedBreakdown, setGuidedBreakdown] =
    useState<GuidedBreakdown | null>(() =>
      engine.getActiveSection() === 'driving-side'
        ? engine.getActiveGuidedBreakdown()
        : null
    );
  const [selectedMapCountryIds, setSelectedMapCountryIds] = useState<string[]>(
    []
  );
  const [activeMapPreset, setActiveMapPreset] =
    useState<MapRegionPresetId>('world');
  const [referenceMapPreset, setReferenceMapPreset] =
    useState<MapRegionPresetId>('world');
  const [elapsedMs, setElapsedMs] = useState(0);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const guideSectionRef = useRef<HTMLElement>(null);

  const startFocusSession = (
    focusId: DrivingSideFocusId,
    mode: DrivingSideDrillMode = drillMode
  ) => {
    setSelectedFocus(focusId);
    setDrillMode(mode);
    setFeedback(null);
    setGuidedBreakdown(null);
    setSelectedMapCountryIds([]);
    const first = engine.startDrivingSideSession({ focusId, drillMode: mode });
    setCurrentTrial(first);
    if (first.drivingPrompt) {
      setActiveMapPreset(first.drivingPrompt.suggestedRegionPreset);
    }
    setElapsedMs(0);
  };

  useEffect(() => {
    if (initialFocus) {
      if (
        engine.getActiveSection() === 'driving-side' &&
        engine.getActiveDrivingFocus() === initialFocus &&
        engine.getCurrentTrial()
      ) {
        const existingTrial = engine.getCurrentTrial();
        setSelectedFocus(initialFocus);
        setDrillMode(engine.getDrivingDrillMode());
        setCurrentTrial(existingTrial);
        setFeedback(engine.getLastDrivingFeedback());
        setGuidedBreakdown(engine.getActiveGuidedBreakdown());
        if (existingTrial?.drivingPrompt) {
          setActiveMapPreset(existingTrial.drivingPrompt.suggestedRegionPreset);
        }
      } else {
        startFocusSession(initialFocus, drillMode);
      }
    }
  }, [initialFocus]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [selectedFocus, currentTrial?.trialNumber, currentTrial?.kind]);

  useEffect(() => {
    if (!currentTrial || feedback) {
      return;
    }
    const start = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 100);
    return () => window.clearInterval(timer);
  }, [currentTrial, feedback]);

  const handleSelectDrivingSide = async (side: DrivingSide) => {
    if (!currentTrial || currentTrial.kind !== 'driving-speed' || feedback) {
      return;
    }
    const result = await engine.submitDrivingSideAnswer(`side:${side}`);
    setFeedback(result);
  };

  const handleToggleMapCountry = (countryId: string) => {
    if (feedback) return;
    setSelectedMapCountryIds((prev) =>
      prev.includes(countryId)
        ? prev.filter((id) => id !== countryId)
        : [...prev, countryId]
    );
  };

  const handleSubmitMapSelection = async () => {
    if (
      !currentTrial ||
      (currentTrial.kind !== 'driving-map' &&
        currentTrial.kind !== 'driving-narrowing') ||
      feedback
    ) {
      return;
    }
    const result = await engine.submitDrivingMapAnswer(selectedMapCountryIds);
    setFeedback(result);
  };

  const handleRequestGuidedBreakdown = () => {
    if (!currentTrial || feedback) return;
    const breakdown = engine.requestGuidedBreakdown();
    setGuidedBreakdown(breakdown);
  };

  const handleAdvanceNext = () => {
    setFeedback(null);
    setGuidedBreakdown(null);
    setSelectedMapCountryIds([]);
    setElapsedMs(0);
    const next = engine.nextTrial();
    setCurrentTrial(next);
    if (next.drivingPrompt) {
      setActiveMapPreset(next.drivingPrompt.suggestedRegionPreset);
    }
  };

  const scrollToFieldGuide = () => {
    guideSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === 'Escape') {
        if (selectedFocus) {
          event.preventDefault();
          setSelectedFocus(null);
          setCurrentTrial(null);
          setFeedback(null);
          setGuidedBreakdown(null);
          setSelectedMapCountryIds([]);
        } else {
          event.preventDefault();
          onBackToDashboard();
        }
        return;
      }

      if (!currentTrial) return;

      if (feedback) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleAdvanceNext();
        }
        return;
      }

      if (event.key === '?' || event.key === ' ') {
        event.preventDefault();
        handleRequestGuidedBreakdown();
        return;
      }

      if (currentTrial.kind === 'driving-speed') {
        if (event.key === '1') {
          event.preventDefault();
          void handleSelectDrivingSide('left');
        } else if (event.key === '2') {
          event.preventDefault();
          void handleSelectDrivingSide('right');
        }
      } else if (
        currentTrial.kind === 'driving-map' ||
        currentTrial.kind === 'driving-narrowing'
      ) {
        if (event.key === 'Enter') {
          event.preventDefault();
          void handleSubmitMapSelection();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Render Road Geometry Field Guide (reused in both Picker and Active Session)
  const renderRoadGeometryGuide = () => {
    return (
      <section
        ref={guideSectionRef}
        aria-labelledby="road-geometry-guide-heading"
        data-testid="driving-side-road-geometry-guide"
        className="apple-card p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div className="max-w-3xl space-y-1.5">
            <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--brand-accent)]">
              Road Geometry &amp; Perceptual Clues
            </p>
            <h2
              id="road-geometry-guide-heading"
              className="text-[1.375rem] font-bold tracking-tight sm:text-[1.5rem]"
            >
              How to Spot Driving Side Without Cars
            </h2>
            <p className="text-[0.875rem] text-[var(--text-secondary)]">
              Rural Street View drops often have zero moving traffic. Use these
              five structural road-geometry clues —{' '}
              <strong>road-edge line colors</strong>,{' '}
              <strong>sign orientation</strong>,{' '}
              <strong>roundabout circulation direction</strong>,{' '}
              <strong>parked vehicles</strong>, and{' '}
              <strong>camera-car hood/shadow clues</strong> — to determine
              Left-Hand vs Right-Hand Traffic in under 2.5 seconds.
            </p>
          </div>
          <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-[0.75rem] font-semibold text-indigo-700 dark:text-indigo-300">
            5 Vector Field Diagrams
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Clue 1: Road-Edge & Center Line Colors */}
          <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[1rem] font-semibold">
                1. Road-Edge Line Colors &amp; Stop Bars
              </h3>
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-[0.6875rem] font-semibold text-amber-700 dark:text-amber-300">
                Pavement Markings
              </span>
            </div>
            <figure className="space-y-2">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[#0F172A] p-3">
                <svg
                  viewBox="0 0 420 155"
                  role="img"
                  aria-label="Vector diagram comparing Southern African Left-Hand Traffic yellow outer road-edge lines with Americas Right-Hand Traffic yellow center lines and stop bar position"
                  className="w-full h-auto block"
                >
                  <title>
                    Road-edge line colors and intersection stop bar position for
                    Left-Hand vs Right-Hand Traffic
                  </title>
                  <rect
                    x="10"
                    y="12"
                    width="190"
                    height="130"
                    rx="8"
                    fill="#1E293B"
                  />
                  <text
                    x="105"
                    y="28"
                    textAnchor="middle"
                    fill="#E2E8F0"
                    fontSize="10"
                    fontWeight="700"
                  >
                    LEFT-HAND (ZA / BW / SZ / LS / UK)
                  </text>
                  <rect x="48" y="36" width="114" height="98" fill="#334155" />
                  <line
                    x1="53"
                    y1="36"
                    x2="53"
                    y2="134"
                    stroke="#FACC15"
                    strokeWidth="3.5"
                  />
                  <line
                    x1="157"
                    y1="36"
                    x2="157"
                    y2="134"
                    stroke="#FACC15"
                    strokeWidth="3.5"
                  />
                  <line
                    x1="105"
                    y1="36"
                    x2="105"
                    y2="134"
                    stroke="#F8FAFC"
                    strokeWidth="2.5"
                    strokeDasharray="8 6"
                  />
                  <line
                    x1="55"
                    y1="62"
                    x2="103"
                    y2="62"
                    stroke="#F8FAFC"
                    strokeWidth="4.5"
                  />
                  <path
                    d="M79 112 L79 76 M73 83 L79 75 L85 83"
                    stroke="#38BDF8"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <text
                    x="79"
                    y="126"
                    textAnchor="middle"
                    fill="#38BDF8"
                    fontSize="8.5"
                    fontWeight="700"
                  >
                    Stop bar LEFT
                  </text>
                  <text
                    x="133"
                    y="98"
                    textAnchor="middle"
                    fill="#FACC15"
                    fontSize="8"
                    fontWeight="600"
                  >
                    Yellow edge
                  </text>

                  <rect
                    x="220"
                    y="12"
                    width="190"
                    height="130"
                    rx="8"
                    fill="#1E293B"
                  />
                  <text
                    x="315"
                    y="28"
                    textAnchor="middle"
                    fill="#E2E8F0"
                    fontSize="10"
                    fontWeight="700"
                  >
                    RIGHT-HAND (Americas / TW / PH)
                  </text>
                  <rect x="258" y="36" width="114" height="98" fill="#334155" />
                  <line
                    x1="263"
                    y1="36"
                    x2="263"
                    y2="134"
                    stroke="#F8FAFC"
                    strokeWidth="3"
                  />
                  <line
                    x1="367"
                    y1="36"
                    x2="367"
                    y2="134"
                    stroke="#F8FAFC"
                    strokeWidth="3"
                  />
                  <line
                    x1="313"
                    y1="36"
                    x2="313"
                    y2="134"
                    stroke="#FACC15"
                    strokeWidth="2.2"
                  />
                  <line
                    x1="317"
                    y1="36"
                    x2="317"
                    y2="134"
                    stroke="#FACC15"
                    strokeWidth="2.2"
                  />
                  <line
                    x1="318"
                    y1="62"
                    x2="365"
                    y2="62"
                    stroke="#F8FAFC"
                    strokeWidth="4.5"
                  />
                  <path
                    d="M342 112 L342 76 M336 83 L342 75 L348 83"
                    stroke="#34D399"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <text
                    x="342"
                    y="126"
                    textAnchor="middle"
                    fill="#34D399"
                    fontSize="8.5"
                    fontWeight="700"
                  >
                    Stop bar RIGHT
                  </text>
                  <text
                    x="286"
                    y="98"
                    textAnchor="middle"
                    fill="#FACC15"
                    fontSize="8"
                    fontWeight="600"
                  >
                    Yellow center
                  </text>
                </svg>
              </div>
              <figcaption className="text-[0.8125rem] text-[var(--text-secondary)] leading-relaxed">
                <strong>Stop &amp; Give-Way Bars:</strong> Transverse stop lines
                and dashed give-way lines span only the approaching lane — on the{' '}
                <strong>left half</strong> in Left-Hand Traffic and the{' '}
                <strong>right half</strong> in Right-Hand Traffic. In{' '}
                <strong>Southern Africa (ZA, BW, SZ, LS)</strong>, yellow outer
                shoulder lines pair with a white center line (Left-Hand Traffic),
                whereas in the <strong>Americas, Taiwan, and Philippines</strong>,
                yellow lines divide the center of the road.
              </figcaption>
            </figure>
          </article>

          {/* Clue 2: Sign Orientation & Back-of-Sign Geometry */}
          <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[1rem] font-semibold">
                2. Sign Orientation &amp; Back-of-Sign Geometry
              </h3>
              <span className="rounded-md bg-sky-500/15 px-2 py-0.5 font-mono text-[0.6875rem] font-semibold text-sky-700 dark:text-sky-300">
                Sign Facing Side
              </span>
            </div>
            <figure className="space-y-2">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[#0F172A] p-3">
                <svg
                  viewBox="0 0 420 155"
                  role="img"
                  aria-label="Vector diagram showing road sign front faces mounted on the left shoulder in Left-Hand Traffic versus on the right shoulder in Right-Hand Traffic"
                  className="w-full h-auto block"
                >
                  <title>
                    Road sign orientation and back-of-sign metal bracket geometry
                  </title>
                  <rect
                    x="10"
                    y="12"
                    width="190"
                    height="130"
                    rx="8"
                    fill="#1E293B"
                  />
                  <text
                    x="105"
                    y="28"
                    textAnchor="middle"
                    fill="#E2E8F0"
                    fontSize="10"
                    fontWeight="700"
                  >
                    LEFT-HAND TRAFFIC (LHT)
                  </text>
                  <polygon
                    points="68,134 92,42 118,42 142,134"
                    fill="#334155"
                  />
                  <line
                    x1="105"
                    y1="42"
                    x2="105"
                    y2="134"
                    stroke="#F8FAFC"
                    strokeWidth="2"
                    strokeDasharray="6 5"
                  />
                  <line
                    x1="46"
                    y1="74"
                    x2="46"
                    y2="122"
                    stroke="#94A3B8"
                    strokeWidth="3"
                  />
                  <circle
                    cx="46"
                    cy="64"
                    r="14"
                    fill="#FEF2F2"
                    stroke="#EF4444"
                    strokeWidth="4"
                  />
                  <text
                    x="46"
                    y="68"
                    textAnchor="middle"
                    fill="#0F172A"
                    fontSize="9.5"
                    fontWeight="800"
                  >
                    80
                  </text>
                  <text
                    x="46"
                    y="134"
                    textAnchor="middle"
                    fill="#38BDF8"
                    fontSize="8.5"
                    fontWeight="700"
                  >
                    FRONT on Left
                  </text>
                  <line
                    x1="164"
                    y1="74"
                    x2="164"
                    y2="122"
                    stroke="#94A3B8"
                    strokeWidth="3"
                  />
                  <circle
                    cx="164"
                    cy="64"
                    r="14"
                    fill="#64748B"
                    stroke="#475569"
                    strokeWidth="2.5"
                  />
                  <line
                    x1="154"
                    y1="64"
                    x2="174"
                    y2="64"
                    stroke="#334155"
                    strokeWidth="2.5"
                  />
                  <text
                    x="164"
                    y="134"
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize="8.5"
                    fontWeight="600"
                  >
                    BACK on Right
                  </text>

                  <rect
                    x="220"
                    y="12"
                    width="190"
                    height="130"
                    rx="8"
                    fill="#1E293B"
                  />
                  <text
                    x="315"
                    y="28"
                    textAnchor="middle"
                    fill="#E2E8F0"
                    fontSize="10"
                    fontWeight="700"
                  >
                    RIGHT-HAND TRAFFIC (RHT)
                  </text>
                  <polygon
                    points="278,134 302,42 328,42 352,134"
                    fill="#334155"
                  />
                  <line
                    x1="315"
                    y1="42"
                    x2="315"
                    y2="134"
                    stroke="#F8FAFC"
                    strokeWidth="2"
                    strokeDasharray="6 5"
                  />
                  <line
                    x1="256"
                    y1="74"
                    x2="256"
                    y2="122"
                    stroke="#94A3B8"
                    strokeWidth="3"
                  />
                  <circle
                    cx="256"
                    cy="64"
                    r="14"
                    fill="#64748B"
                    stroke="#475569"
                    strokeWidth="2.5"
                  />
                  <line
                    x1="246"
                    y1="64"
                    x2="266"
                    y2="64"
                    stroke="#334155"
                    strokeWidth="2.5"
                  />
                  <text
                    x="256"
                    y="134"
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize="8.5"
                    fontWeight="600"
                  >
                    BACK on Left
                  </text>
                  <line
                    x1="374"
                    y1="74"
                    x2="374"
                    y2="122"
                    stroke="#94A3B8"
                    strokeWidth="3"
                  />
                  <circle
                    cx="374"
                    cy="64"
                    r="14"
                    fill="#FEF2F2"
                    stroke="#EF4444"
                    strokeWidth="4"
                  />
                  <text
                    x="374"
                    y="68"
                    textAnchor="middle"
                    fill="#0F172A"
                    fontSize="9.5"
                    fontWeight="800"
                  >
                    80
                  </text>
                  <text
                    x="374"
                    y="134"
                    textAnchor="middle"
                    fill="#34D399"
                    fontSize="8.5"
                    fontWeight="700"
                  >
                    FRONT on Right
                  </text>
                </svg>
              </div>
              <figcaption className="text-[0.8125rem] text-[var(--text-secondary)] leading-relaxed">
                <strong>Look Down the Road:</strong> Regulatory speed limits,
                warning triangles, and kilometer markers face approaching
                drivers on their own side. If signs on the{' '}
                <strong>left shoulder</strong> face you while signs on the right
                show bare metal backs/posts, you are in{' '}
                <strong>Left-Hand Traffic</strong>.
              </figcaption>
            </figure>
          </article>

          {/* Clue 3: Roundabout Circulation Direction */}
          <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[1rem] font-semibold">
                3. Roundabout Circulation &amp; Splitter Islands
              </h3>
              <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 font-mono text-[0.6875rem] font-semibold text-indigo-700 dark:text-indigo-300">
                Clockwise vs CCW
              </span>
            </div>
            <figure className="space-y-2">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[#0F172A] p-3">
                <svg
                  viewBox="0 0 420 155"
                  role="img"
                  aria-label="Vector diagram showing Clockwise roundabout circulation and left entry deflection in Left-Hand Traffic versus Counter-Clockwise circulation in Right-Hand Traffic"
                  className="w-full h-auto block"
                >
                  <title>
                    Roundabout circulation direction: Clockwise (Left-Hand) vs
                    Counter-Clockwise (Right-Hand)
                  </title>
                  <rect
                    x="10"
                    y="12"
                    width="190"
                    height="130"
                    rx="8"
                    fill="#1E293B"
                  />
                  <text
                    x="105"
                    y="28"
                    textAnchor="middle"
                    fill="#E2E8F0"
                    fontSize="10"
                    fontWeight="700"
                  >
                    CLOCKWISE = LEFT-HAND
                  </text>
                  <circle
                    cx="105"
                    cy="82"
                    r="38"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="18"
                  />
                  <circle
                    cx="105"
                    cy="82"
                    r="21"
                    fill="#15803D"
                    stroke="#F8FAFC"
                    strokeWidth="2"
                  />
                  <path
                    d="M73 82 A32 32 0 0 1 137 82"
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <polygon points="137,85 132,75 142,75" fill="#38BDF8" />
                  <path
                    d="M137 86 A32 32 0 0 1 73 86"
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <polygon points="73,83 68,93 78,93" fill="#38BDF8" />
                  <text
                    x="105"
                    y="85"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="8.5"
                    fontWeight="700"
                  >
                    CW ↻
                  </text>
                  <text
                    x="105"
                    y="135"
                    textAnchor="middle"
                    fill="#38BDF8"
                    fontSize="8.5"
                    fontWeight="700"
                  >
                    Enter Left · Chevrons point Left
                  </text>

                  <rect
                    x="220"
                    y="12"
                    width="190"
                    height="130"
                    rx="8"
                    fill="#1E293B"
                  />
                  <text
                    x="315"
                    y="28"
                    textAnchor="middle"
                    fill="#E2E8F0"
                    fontSize="10"
                    fontWeight="700"
                  >
                    COUNTER-CLOCKWISE = RIGHT-HAND
                  </text>
                  <circle
                    cx="315"
                    cy="82"
                    r="38"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="18"
                  />
                  <circle
                    cx="315"
                    cy="82"
                    r="21"
                    fill="#15803D"
                    stroke="#F8FAFC"
                    strokeWidth="2"
                  />
                  <path
                    d="M347 82 A32 32 0 0 0 283 82"
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <polygon points="283,85 278,75 288,75" fill="#34D399" />
                  <path
                    d="M283 86 A32 32 0 0 0 347 86"
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <polygon points="347,83 342,93 352,93" fill="#34D399" />
                  <text
                    x="315"
                    y="85"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="8.5"
                    fontWeight="700"
                  >
                    CCW ↺
                  </text>
                  <text
                    x="315"
                    y="135"
                    textAnchor="middle"
                    fill="#34D399"
                    fontSize="8.5"
                    fontWeight="700"
                  >
                    Enter Right · Chevrons point Right
                  </text>
                </svg>
              </div>
              <figcaption className="text-[0.8125rem] text-[var(--text-secondary)] leading-relaxed">
                <strong>Roundabout Signs &amp; Splitter Islands:</strong>{' '}
                Roundabouts circulate <strong>clockwise (↻)</strong> in
                Left-Hand Traffic (entry curves left, central island chevrons
                point left) and <strong>counter-clockwise (↺)</strong> in
                Right-Hand Traffic (entry deflects right, chevrons point right).
              </figcaption>
            </figure>
          </article>

          {/* Clue 4: Parked Vehicles & Curb Facing Direction */}
          <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[1rem] font-semibold">
                4. Parked Vehicles &amp; Rear Plate Colors
              </h3>
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[0.6875rem] font-semibold text-emerald-700 dark:text-emerald-300">
                Curb Alignment
              </span>
            </div>
            <figure className="space-y-2">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[#0F172A] p-3">
                <svg
                  viewBox="0 0 420 155"
                  role="img"
                  aria-label="Vector diagram showing parked cars along the left and right curbs facing with traffic flow in Left-Hand versus Right-Hand Traffic"
                  className="w-full h-auto block"
                >
                  <title>
                    Parked vehicle curb orientation and taillight/headlight
                    direction
                  </title>
                  <rect
                    x="10"
                    y="12"
                    width="190"
                    height="130"
                    rx="8"
                    fill="#1E293B"
                  />
                  <text
                    x="105"
                    y="28"
                    textAnchor="middle"
                    fill="#E2E8F0"
                    fontSize="10"
                    fontWeight="700"
                  >
                    LEFT-HAND PARKED CARS
                  </text>
                  <rect x="45" y="36" width="120" height="96" fill="#334155" />
                  <line
                    x1="105"
                    y1="36"
                    x2="105"
                    y2="132"
                    stroke="#F8FAFC"
                    strokeWidth="2"
                    strokeDasharray="6 5"
                  />
                  <rect
                    x="54"
                    y="56"
                    width="28"
                    height="48"
                    rx="5"
                    fill="#3B82F6"
                    stroke="#E2E8F0"
                    strokeWidth="1.5"
                  />
                  <rect x="56" y="101" width="7" height="4" fill="#EF4444" />
                  <rect x="73" y="101" width="7" height="4" fill="#EF4444" />
                  <rect
                    x="128"
                    y="56"
                    width="28"
                    height="48"
                    rx="5"
                    fill="#64748B"
                    stroke="#E2E8F0"
                    strokeWidth="1.5"
                  />
                  <rect x="130" y="101" width="7" height="4" fill="#FEF08A" />
                  <rect x="147" y="101" width="7" height="4" fill="#FEF08A" />
                  <text
                    x="68"
                    y="122"
                    textAnchor="middle"
                    fill="#FCA5A5"
                    fontSize="8"
                    fontWeight="700"
                  >
                    Rear (Red)
                  </text>
                  <text
                    x="142"
                    y="122"
                    textAnchor="middle"
                    fill="#FEF08A"
                    fontSize="8"
                    fontWeight="700"
                  >
                    Front (White)
                  </text>

                  <rect
                    x="220"
                    y="12"
                    width="190"
                    height="130"
                    rx="8"
                    fill="#1E293B"
                  />
                  <text
                    x="315"
                    y="28"
                    textAnchor="middle"
                    fill="#E2E8F0"
                    fontSize="10"
                    fontWeight="700"
                  >
                    RIGHT-HAND PARKED CARS
                  </text>
                  <rect x="255" y="36" width="120" height="96" fill="#334155" />
                  <line
                    x1="315"
                    y1="36"
                    x2="315"
                    y2="132"
                    stroke="#F8FAFC"
                    strokeWidth="2"
                    strokeDasharray="6 5"
                  />
                  <rect
                    x="264"
                    y="56"
                    width="28"
                    height="48"
                    rx="5"
                    fill="#64748B"
                    stroke="#E2E8F0"
                    strokeWidth="1.5"
                  />
                  <rect x="266" y="101" width="7" height="4" fill="#FEF08A" />
                  <rect x="283" y="101" width="7" height="4" fill="#FEF08A" />
                  <rect
                    x="338"
                    y="56"
                    width="28"
                    height="48"
                    rx="5"
                    fill="#10B981"
                    stroke="#E2E8F0"
                    strokeWidth="1.5"
                  />
                  <rect x="340" y="101" width="7" height="4" fill="#EF4444" />
                  <rect x="357" y="101" width="7" height="4" fill="#EF4444" />
                  <text
                    x="278"
                    y="122"
                    textAnchor="middle"
                    fill="#FEF08A"
                    fontSize="8"
                    fontWeight="700"
                  >
                    Front (White)
                  </text>
                  <text
                    x="352"
                    y="122"
                    textAnchor="middle"
                    fill="#FCA5A5"
                    fontSize="8"
                    fontWeight="700"
                  >
                    Rear (Red)
                  </text>
                </svg>
              </div>
              <figcaption className="text-[0.8125rem] text-[var(--text-secondary)] leading-relaxed">
                <strong>Curbside Parking Direction:</strong> Stationary cars
                parked along the curb almost always face the direction of
                travel. If cars parked on the <strong>left curb</strong> face
                away from you (showing red taillights or UK/Cyprus/Botswana
                yellow rear plates), traffic drives on the{' '}
                <strong>left</strong>.
              </figcaption>
            </figure>
          </article>
        </div>

        {/* Clue 5: Full-Width Camera-Car Lane Offset, Hood/Snorkel & Shadow Geometry */}
        <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-5 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[1rem] font-semibold">
              5. Camera-Car Lane Offset, Hood/Snorkel Clues &amp; Sun Shadow
              Geometry
            </h3>
            <span className="rounded-md bg-rose-500/15 px-2 py-0.5 font-mono text-[0.6875rem] font-semibold text-rose-700 dark:text-rose-300">
              Zero-Signage Rural Backup
            </span>
          </div>
          <figure className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-center">
            <div className="lg:col-span-7 rounded-lg border border-[var(--border-subtle)] bg-[#0F172A] p-3">
              <svg
                viewBox="0 0 460 140"
                role="img"
                aria-label="Vector diagram showing Google Street View camera car lateral lane offset relative to road center and hood/snorkel/shadow projection"
                className="w-full h-auto block"
              >
                <title>
                  Camera-car lane offset, hood/snorkel position, and sun shadow
                  geometry
                </title>
                <rect
                  x="10"
                  y="10"
                  width="212"
                  height="120"
                  rx="8"
                  fill="#1E293B"
                />
                <text
                  x="116"
                  y="26"
                  textAnchor="middle"
                  fill="#E2E8F0"
                  fontSize="9.5"
                  fontWeight="700"
                >
                  CAMERA CAR OFFSET — LEFT-HAND
                </text>
                <rect x="44" y="34" width="144" height="86" fill="#334155" />
                <line
                  x1="116"
                  y1="34"
                  x2="116"
                  y2="120"
                  stroke="#F8FAFC"
                  strokeWidth="2"
                  strokeDasharray="6 5"
                />
                <circle
                  cx="80"
                  cy="82"
                  r="17"
                  fill="#4F46E5"
                  fillOpacity="0.35"
                  stroke="#818CF8"
                  strokeWidth="2"
                />
                <circle cx="80" cy="82" r="5" fill="#38BDF8" />
                <line
                  x1="46"
                  y1="82"
                  x2="62"
                  y2="82"
                  stroke="#38BDF8"
                  strokeWidth="2"
                />
                <line
                  x1="98"
                  y1="82"
                  x2="186"
                  y2="82"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
                <text
                  x="80"
                  y="54"
                  textAnchor="middle"
                  fill="#38BDF8"
                  fontSize="8.5"
                  fontWeight="700"
                >
                  Closer to Left Verge
                </text>
                <text
                  x="148"
                  y="74"
                  textAnchor="middle"
                  fill="#CBD5E1"
                  fontSize="8"
                >
                  Wide right gap
                </text>

                <rect
                  x="238"
                  y="10"
                  width="212"
                  height="120"
                  rx="8"
                  fill="#1E293B"
                />
                <text
                  x="344"
                  y="26"
                  textAnchor="middle"
                  fill="#E2E8F0"
                  fontSize="9.5"
                  fontWeight="700"
                >
                  CAMERA CAR OFFSET — RIGHT-HAND
                </text>
                <rect x="272" y="34" width="144" height="86" fill="#334155" />
                <line
                  x1="344"
                  y1="34"
                  x2="344"
                  y2="120"
                  stroke="#F8FAFC"
                  strokeWidth="2"
                  strokeDasharray="6 5"
                />
                <circle
                  cx="380"
                  cy="82"
                  r="17"
                  fill="#0D9488"
                  fillOpacity="0.35"
                  stroke="#2DD4BF"
                  strokeWidth="2"
                />
                <circle cx="380" cy="82" r="5" fill="#34D399" />
                <line
                  x1="274"
                  y1="82"
                  x2="362"
                  y2="82"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
                <line
                  x1="398"
                  y1="82"
                  x2="414"
                  y2="82"
                  stroke="#34D399"
                  strokeWidth="2"
                />
                <text
                  x="380"
                  y="54"
                  textAnchor="middle"
                  fill="#34D399"
                  fontSize="8.5"
                  fontWeight="700"
                >
                  Closer to Right Verge
                </text>
                <text
                  x="312"
                  y="74"
                  textAnchor="middle"
                  fill="#CBD5E1"
                  fontSize="8"
                >
                  Wide left gap
                </text>
              </svg>
            </div>
            <figcaption className="lg:col-span-5 text-[0.8125rem] text-[var(--text-secondary)] space-y-2 leading-relaxed">
              <p>
                <strong>Look Straight Down (Nadir):</strong> Even on unlined
                dirt tracks, the Google car drives in its own lane —{' '}
                <strong>closer to the left ditch/shoulder</strong> in Left-Hand
                Traffic and <strong>closer to the right shoulder</strong> in
                Right-Hand Traffic.
              </p>
              <p>
                <strong>Car Meta &amp; Sun Shadow:</strong> Combine camera-car
                offset with distinctive vehicle equipment (e.g.,{' '}
                <strong>Kenya’s front snorkel</strong> in Left-Hand Traffic vs{' '}
                <strong>Mongolia’s snorkel + roof rack</strong> in Right-Hand
                Traffic) and sun shadow direction (shadows point{' '}
                <strong>north</strong> in Southern Hemisphere LHT countries like
                Australia, New Zealand, and South Africa).
              </p>
            </figcaption>
          </figure>
        </article>
      </section>
    );
  };

  // Focus Picker View (when no active session focus is running)
  if (!selectedFocus || !currentTrial || !currentTrial.drivingPrompt) {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={onBackToDashboard}
              className="mb-2 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              ← Back to Dashboard
            </button>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-[1.75rem] font-bold tracking-tight sm:text-[2rem]"
            >
              Driving Side Section
            </h1>
            <p className="mt-1 max-w-3xl text-[0.9375rem] text-[var(--text-secondary)]">
              Build instant spatial recall of{' '}
              <strong>Left-Hand vs Right-Hand Traffic</strong> across all{' '}
              <strong>Playable Countries</strong>, master tricky regional border
              flips, intersect driving side with language/script{' '}
              <strong>Tells</strong>, and spot driving side without cars using
              road geometry.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={scrollToFieldGuide}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-2.5 text-[0.875rem] font-semibold transition hover:border-[var(--brand-accent)]"
            >
              Road Geometry Guide ↓
            </button>
            <button
              type="button"
              onClick={() =>
                startFocusSession('tricky-borders', 'speed-left-right')
              }
              className="rounded-xl bg-[var(--brand-accent)] px-4 py-2.5 text-[0.875rem] font-semibold text-white shadow-xs hover:opacity-95"
            >
              Drill Tricky Borders (Speed) →
            </button>
          </div>
        </div>

        {/* Drill Mode Selector */}
        <section
          aria-labelledby="driving-drill-mode-heading"
          className="apple-card p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="driving-drill-mode-heading"
                className="text-[0.9375rem] font-semibold"
              >
                Select Drill Mode
              </h2>
              <p className="text-[0.8125rem] text-[var(--text-secondary)]">
                Choose a specific drill format or run Mixed Adaptive Drills
                scheduled by ARTS (&lt;2.5s speed ceiling).
              </p>
            </div>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Driving Side drill modes"
            >
              {DRILL_MODE_OPTIONS.map((option) => {
                const isActive = drillMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setDrillMode(option.id)}
                    className={`rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition ${
                      isActive
                        ? 'bg-[var(--brand-accent)] text-white font-semibold'
                        : 'border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {option.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-2.5 text-[0.8125rem] text-[var(--text-secondary)]">
            {DRILL_MODE_OPTIONS.find((o) => o.id === drillMode)?.description}
          </p>
        </section>

        {/* Regional & Global Focus Cards */}
        <section
          aria-labelledby="driving-focus-cards-heading"
          className="space-y-4"
        >
          <h2
            id="driving-focus-cards-heading"
            className="text-[1.125rem] font-semibold"
          >
            Choose a Regional or Border Focus
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {DRIVING_SIDE_FOCUS_OPTIONS.map((focusSpec) => {
              const focusCountries = getCountriesForDrivingSideFocus(
                focusSpec.id
              );
              const coveredLeftCount = focusCountries.filter(
                (c) => c.drivingSide === 'left' && c.coverageTier !== 'none'
              ).length;
              const coveredRightCount = focusCountries.filter(
                (c) => c.drivingSide === 'right' && c.coverageTier !== 'none'
              ).length;
              const masteredCount = focusCountries.filter(
                (c) => progress.skills[`drive:${c.id}`]?.mastery === 'mastered'
              ).length;

              return (
                <article
                  key={focusSpec.id}
                  className="apple-card flex flex-col justify-between p-5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[1.0625rem] font-semibold">
                          {focusSpec.name}
                        </h3>
                        <p className="mt-1 text-[0.8125rem] text-[var(--text-secondary)]">
                          {focusSpec.description}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-[var(--border-subtle)] px-2.5 py-0.5 text-[0.75rem] font-medium">
                        {masteredCount}/{focusCountries.length} Mastered
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {focusSpec.highlightExamples.map((ex) => (
                        <span
                          key={ex}
                          className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2 py-0.5 font-mono text-[0.6875rem] text-[var(--text-secondary)]"
                        >
                          {ex}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-[0.75rem]">
                      <span className="rounded-md bg-indigo-500/15 px-2.5 py-1 font-medium text-indigo-700 dark:text-indigo-300">
                        L Left-Hand Covered: {coveredLeftCount}
                      </span>
                      <span className="rounded-md bg-teal-500/15 px-2.5 py-1 font-medium text-teal-700 dark:text-teal-300">
                        R Right-Hand Covered: {coveredRightCount}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-4">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          startFocusSession(focusSpec.id, 'speed-left-right')
                        }
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2.5 py-1 text-[0.75rem] font-medium hover:border-[var(--brand-accent)]"
                      >
                        Speed Drill
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          startFocusSession(focusSpec.id, 'regional-map')
                        }
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2.5 py-1 text-[0.75rem] font-medium hover:border-[var(--brand-accent)]"
                      >
                        Map Drill
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          startFocusSession(
                            focusSpec.id,
                            'multi-clue-narrowing'
                          )
                        }
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2.5 py-1 text-[0.75rem] font-medium hover:border-[var(--brand-accent)]"
                      >
                        Multi-Clue
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => startFocusSession(focusSpec.id, drillMode)}
                      className="rounded-lg bg-[var(--brand-accent)] px-4 py-1.5 text-[0.8125rem] font-semibold text-white hover:opacity-95"
                    >
                      Practice {focusSpec.shortName} →
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Built-in Road Geometry Field Guide */}
        {renderRoadGeometryGuide()}

        {/* Interactive World Driving Side Reference Map */}
        <section
          aria-labelledby="driving-reference-map-heading"
          className="apple-card p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="driving-reference-map-heading"
                className="text-[1.125rem] font-semibold"
              >
                Interactive World Driving Side Reference Map
              </h2>
              <p className="text-[0.8125rem] text-[var(--text-secondary)]">
                Explore Left-Hand Traffic (L) vs Right-Hand Traffic (R) across
                all 145 Playable Countries and GeoGuessr territory pills.
              </p>
            </div>
          </div>

          <WorldMapView
            selectedCountryIds={[]}
            onToggleCountry={() => {}}
            showAllDrivingSides={true}
            activeRegionPreset={referenceMapPreset}
            onRegionPresetChange={setReferenceMapPreset}
            readOnly={true}
            ariaLabel="Reference world map showing Left-Hand and Right-Hand Traffic across all Playable Countries"
          />
        </section>
      </div>
    );
  }

  // Active Session View
  const focusSpec = DRIVING_SIDE_FOCUS_MAP[selectedFocus];
  const prompt = currentTrial.drivingPrompt;
  const targetCountry = prompt.targetCountry;
  const expectedCountryIds = prompt.expectedCountryIds ?? [targetCountry.id];
  const fluencyRatio = Math.min(
    1,
    elapsedMs / DRIVING_SIDE_FLUENCY_THRESHOLD_MS
  );
  const isOverFluencyThreshold = elapsedMs > DRIVING_SIDE_FLUENCY_THRESHOLD_MS;

  return (
    <div className="space-y-6">
      {/* Top Session Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedFocus(null);
              setCurrentTrial(null);
              setFeedback(null);
              setGuidedBreakdown(null);
              setSelectedMapCountryIds([]);
            }}
            className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-zinc-500/10"
          >
            ← All Driving Side Focuses
          </button>
          <div>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-[1.125rem] font-semibold"
            >
              {focusSpec.name}
            </h1>
            <p className="text-[0.75rem] text-[var(--text-secondary)]">
              Mode:{' '}
              {DRILL_MODE_OPTIONS.find((m) => m.id === drillMode)?.shortLabel ??
                'Mixed'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="Switch Driving Side drill mode"
          >
            {DRILL_MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={drillMode === option.id}
                onClick={() => startFocusSession(selectedFocus, option.id)}
                className={`rounded-lg px-2.5 py-1 text-[0.75rem] font-medium transition ${
                  drillMode === option.id
                    ? 'bg-[var(--brand-accent)] text-white font-semibold'
                    : 'border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-secondary)]'
                }`}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={scrollToFieldGuide}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-2.5 py-1 text-[0.75rem] font-medium hover:border-[var(--brand-accent)]"
          >
            Road Geometry Guide ↓
          </button>

          {!feedback && (
            <button
              type="button"
              onClick={handleRequestGuidedBreakdown}
              aria-expanded={Boolean(guidedBreakdown)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-[0.8125rem] font-medium hover:border-[var(--brand-accent)]"
            >
              {guidedBreakdown
                ? 'Guided Breakdown Active'
                : 'Not sure? Show Breakdown (?)'}
            </button>
          )}
        </div>
      </div>

      {/* Main Trial Card */}
      <section
        aria-label="Driving Side Drill Trial"
        className="apple-card p-6 sm:p-8 space-y-6"
      >
        {/* Trial Type Badge & Fluency Timer Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--brand-accent)]/12 px-3 py-1 text-[0.75rem] font-semibold text-[var(--brand-accent)]">
              {currentTrial.kind === 'driving-speed'
                ? 'Left / Right Speed Drill (<2.5s Fluency)'
                : currentTrial.kind === 'driving-map'
                  ? 'Regional Left-Driving Map Drill'
                  : 'Multi-Clue Narrowing Drill'}
            </span>
            <MasteryBadge
              state={
                progress.skills[currentTrial.skillId]?.mastery ?? 'unseen'
              }
              size="xs"
            />
          </div>

          {currentTrial.kind === 'driving-speed' && !feedback && (
            <div className="flex items-center gap-2 text-[0.75rem] font-mono text-[var(--text-secondary)]">
              <span>{(elapsedMs / 1000).toFixed(1)}s / 2.5s ceiling</span>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-500/15">
                <div
                  className={`h-full transition-all duration-100 ${
                    isOverFluencyThreshold ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.round(fluencyRatio * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Prompt Header */}
        <div className="space-y-3">
          <h2 className="text-[1.375rem] font-bold tracking-tight sm:text-[1.625rem]">
            {prompt.promptTitle}
          </h2>
          <p className="text-[0.875rem] text-[var(--text-secondary)]">
            {prompt.promptDescription}
          </p>

          {currentTrial.kind === 'driving-speed' && (
            <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-[var(--text-secondary)]">
              <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2.5 py-0.5 font-mono uppercase">
                ISO: {targetCountry.id}
              </span>
              <span>
                Region: {targetCountry.subregion} ({targetCountry.region})
              </span>
              <span>
                Coverage:{' '}
                <strong className="uppercase">
                  {targetCountry.coverageTier}
                </strong>
              </span>
              {targetCountry.isTerritory && (
                <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[0.75rem] font-medium text-indigo-700 dark:text-indigo-300">
                  Small Territory / Microstate
                </span>
              )}
            </div>
          )}

          {/* Multi-Clue Narrowing Clues & Sign Text Sample */}
          {currentTrial.kind === 'driving-narrowing' && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-4 space-y-3">
              {prompt.narrowingClueSummary && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Combined Clues:
                  </span>
                  <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1 text-[0.8125rem] font-semibold">
                    {prompt.narrowingClueSummary}
                  </span>
                </div>
              )}

              {prompt.signSample && (
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3.5 space-y-1.5">
                  <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Observed Sign Text Sample
                  </p>
                  <p className="font-mono text-[1.25rem] font-bold tracking-wide">
                    {renderSignSampleText(
                      prompt.signSample.text,
                      prompt.matchedTells,
                      Boolean(feedback || guidedBreakdown)
                    )}
                  </p>
                  {(feedback || guidedBreakdown) && prompt.signLanguage && (
                    <p className="text-[0.8125rem] text-[var(--text-secondary)]">
                      Language: <strong>{prompt.signLanguage.name}</strong> — “
                      {prompt.signSample.translation}”
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* On-Demand Guided Breakdown */}
        {guidedBreakdown && !feedback && (
          <aside
            aria-label="Guided Breakdown"
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.875rem] font-semibold text-amber-800 dark:text-amber-300">
                Guided Breakdown · {guidedBreakdown.languageName} (
                {guidedBreakdown.nativeName})
              </p>
              <span className="text-[0.75rem] text-amber-700 dark:text-amber-300">
                Assisted Trial ({guidedBreakdown.queuedFollowUps} follow-ups
                queued)
              </span>
            </div>
            {guidedBreakdown.drivingNote && (
              <p className="text-[0.8125rem]">{guidedBreakdown.drivingNote}</p>
            )}
            {guidedBreakdown.distractorEliminations.length > 0 && (
              <ul className="space-y-1 text-[0.8125rem]">
                {guidedBreakdown.distractorEliminations.map((elim) => (
                  <li key={elim.optionId}>
                    <strong>{elim.languageName}:</strong> {elim.reason}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[0.8125rem] font-medium">
              Candidate Countries:{' '}
              {guidedBreakdown.candidateCountries.map((c) => c.name).join(', ')}
            </p>
          </aside>
        )}

        {/* Speed Drill 2-Button Choice */}
        {currentTrial.kind === 'driving-speed' && !feedback && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(['left', 'right'] as const).map((side, index) => (
              <button
                key={side}
                type="button"
                data-driving-choice={side}
                onClick={() => {
                  void handleSelectDrivingSide(side);
                }}
                className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-4 text-left transition hover:border-[var(--brand-accent)]"
              >
                <div>
                  <span className="text-[1rem] font-semibold">
                    {formatDrivingSideLabel(side)}
                  </span>
                  <p className="mt-1 text-[0.8125rem] text-[var(--text-secondary)]">
                    {side === 'left'
                      ? 'Traffic keeps left · Clockwise roundabouts · Signs face left shoulder'
                      : 'Traffic keeps right · Counter-clockwise roundabouts · Signs face right shoulder'}
                  </p>
                </div>
                <kbd className="rounded-md border border-[var(--border-subtle)] px-2 py-1 font-mono text-[0.75rem]">
                  {index + 1}
                </kbd>
              </button>
            ))}
          </div>
        )}

        {/* Interactive World Map for Regional Map Drills & Multi-Clue Narrowing */}
        {(currentTrial.kind === 'driving-map' ||
          currentTrial.kind === 'driving-narrowing') && (
          <div className="space-y-4">
            <WorldMapView
              selectedCountryIds={selectedMapCountryIds}
              onToggleCountry={handleToggleMapCountry}
              evaluation={feedback?.mapEvaluation ?? null}
              activeRegionPreset={activeMapPreset}
              onRegionPresetChange={setActiveMapPreset}
              readOnly={Boolean(feedback)}
              ariaLabel={prompt.promptTitle}
            />

            {!feedback && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[0.8125rem] text-[var(--text-secondary)]">
                  Selected: <strong>{selectedMapCountryIds.length}</strong>{' '}
                  {selectedMapCountryIds.length === 1 ? 'country' : 'countries'}{' '}
                  (Expected: {expectedCountryIds.length} covered{' '}
                  {expectedCountryIds.length === 1 ? 'country' : 'countries'})
                </span>
                <div className="flex items-center gap-2">
                  {selectedMapCountryIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedMapCountryIds([])}
                      className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[0.8125rem] font-medium"
                    >
                      Clear Selection
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      void handleSubmitMapSelection();
                    }}
                    className="rounded-xl bg-[var(--brand-accent)] px-5 py-2.5 text-[0.875rem] font-semibold text-white shadow-xs hover:opacity-95"
                  >
                    Submit Map Selection (Enter)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Post-Trial Feedback Panel */}
        {feedback && (
          <div
            aria-live="polite"
            className={`rounded-xl border p-5 space-y-4 ${
              feedback.correct
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-rose-500/40 bg-rose-500/10'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[1.125rem] font-bold">
                    {feedback.correct
                      ? feedback.isFluentSpeed
                        ? '✓ Correct & Fluent (<2.5s)'
                        : '✓ Correct'
                      : '✗ Not Quite'}
                  </span>
                  <span className="font-mono text-[0.75rem] text-[var(--text-secondary)]">
                    {(feedback.responseTimeMs / 1000).toFixed(2)}s
                  </span>
                  <MasteryBadge state={feedback.newMastery} size="xs" />
                </div>

                <p className="mt-1.5 text-[0.875rem]">
                  <strong>
                    {feedback.countryName} (
                    {feedback.drivingSide.toUpperCase()}-Hand Traffic):
                  </strong>{' '}
                  {feedback.drivingNote}
                </p>
              </div>

              <button
                type="button"
                onClick={handleAdvanceNext}
                className="rounded-xl bg-[var(--brand-accent)] px-5 py-2.5 text-[0.875rem] font-semibold text-white shadow-xs hover:opacity-95"
              >
                Next Trial (Enter) →
              </button>
            </div>

            {/* Border Contrast Notes */}
            {feedback.borderContrastNotes.length > 0 && (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3.5 space-y-2">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Key Driving-Side &amp; Border Contrasts
                </p>
                <ul className="space-y-1.5 text-[0.8125rem]">
                  {feedback.borderContrastNotes.map((item) => (
                    <li key={item.countryId}>
                      <strong>
                        {item.countryName} ({item.drivingSide.toUpperCase()} ·{' '}
                        {item.coverageTier} coverage):
                      </strong>{' '}
                      {item.drivingNote}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Uncovered Country Trap Notes for Map / Narrowing Drills */}
            {feedback.uncoveredCountryNotes.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-1.5">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Uncovered / Border Exception Notes
                </p>
                <ul className="space-y-1 text-[0.8125rem]">
                  {feedback.uncoveredCountryNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Map Evaluation Summary for Map & Narrowing Drills */}
            {feedback.mapEvaluation && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-[0.8125rem]">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                    ✓ Correct ({feedback.mapEvaluation.correctCountryIds.length})
                  </p>
                  <p className="mt-1 text-[var(--text-secondary)]">
                    {feedback.mapEvaluation.correctCountryIds
                      .map((id) => PLAYABLE_COUNTRY_MAP[id]?.name ?? id)
                      .join(', ') || 'None'}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                  <p className="font-semibold text-amber-700 dark:text-amber-300">
                    ! Missed ({feedback.mapEvaluation.missedCountryIds.length})
                  </p>
                  <p className="mt-1 text-[var(--text-secondary)]">
                    {feedback.mapEvaluation.missedCountryIds
                      .map((id) => PLAYABLE_COUNTRY_MAP[id]?.name ?? id)
                      .join(', ') || 'None'}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                  <p className="font-semibold text-rose-700 dark:text-rose-300">
                    ✗ Incorrect (
                    {feedback.mapEvaluation.incorrectCountryIds.length})
                  </p>
                  <p className="mt-1 text-[var(--text-secondary)]">
                    {feedback.mapEvaluation.incorrectCountryIds
                      .map((id) => PLAYABLE_COUNTRY_MAP[id]?.name ?? id)
                      .join(', ') || 'None'}
                  </p>
                </div>
              </div>
            )}

            {/* Post-Answer Map Reveal for Speed Drills */}
            {currentTrial.kind === 'driving-speed' && (
              <div className="pt-2">
                <WorldMapView
                  selectedCountryIds={[]}
                  onToggleCountry={() => {}}
                  highlightedDrivingCountryIds={
                    feedback.mapHighlightedCountryIds
                  }
                  activeRegionPreset={activeMapPreset}
                  onRegionPresetChange={setActiveMapPreset}
                  readOnly={true}
                  ariaLabel={`Map highlight for ${targetCountry.name}`}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Road Geometry Guide Accessible Below Active Drill */}
      {renderRoadGeometryGuide()}
    </div>
  );
}
