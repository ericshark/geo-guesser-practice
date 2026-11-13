import React from 'react';
import { findTellMatchesInSample, LANGUAGE_MAP, type LanguageSample, type TellSpanMatch } from '../data/index.ts';
import type { ContrastCardLanguageEntry } from '../engine/practiceEngine.ts';
import { buildHighlightedTextSegments } from '../utils/highlightSpans.ts';
import { MasteryBadge } from './MasteryBadge.tsx';

const TELL_HIGHLIGHT_CLASSES = [
  'bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 border-b-2 border-indigo-500 px-1 rounded-xs font-semibold',
  'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-b-2 border-amber-500 px-1 rounded-xs font-semibold',
  'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-b-2 border-rose-500 px-1 rounded-xs font-semibold',
  'bg-teal-500/20 text-teal-800 dark:text-teal-200 border-b-2 border-teal-500 px-1 rounded-xs font-semibold',
];

export const TELL_BADGE_CLASSES = [
  'border-indigo-500/40 bg-indigo-500/12 text-indigo-800 dark:text-indigo-200',
  'border-amber-500/40 bg-amber-500/12 text-amber-800 dark:text-amber-200',
  'border-rose-500/40 bg-rose-500/12 text-rose-800 dark:text-rose-200',
  'border-teal-500/40 bg-teal-500/12 text-teal-800 dark:text-teal-200',
];

export function LanguageContrastGrid({
  languages,
  headingLevel: Heading = 'h2',
}: {
  languages: ContrastCardLanguageEntry[];
  headingLevel?: 'h2' | 'h3';
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {languages.map((entry) => {
        const langSpec = LANGUAGE_MAP[entry.id];
        const sampleMatches = findTellMatchesInSample(
          entry.exampleSample,
          langSpec
        );
        return (
          <div
            key={entry.id}
            className="card flex flex-col justify-between p-5 space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Heading className="text-[1.1875rem] font-black">
                    {entry.name}{' '}
                    <span className="font-normal text-[var(--text-secondary)]">
                      ({entry.nativeName})
                    </span>
                  </Heading>
                  <p className="text-[0.75rem] font-medium text-[var(--text-secondary)]">
                    Script: {entry.script}
                  </p>
                </div>
                <MasteryBadge state={entry.mastery} />
              </div>

              {/* Key Tells */}
              <div className="space-y-2">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Diagnostic Tells
                </p>
                {entry.tells.map((tell, idx) => (
                  <div
                    key={tell.id}
                    className="rounded-xl bg-[var(--surface-elevated)] p-3 text-[0.8125rem]"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md border px-2 py-0.5 font-mono text-[0.75rem] font-semibold ${
                          TELL_BADGE_CLASSES[idx % TELL_BADGE_CLASSES.length]
                        }`}
                      >
                        {tell.pattern}
                      </span>
                      <span className="font-semibold">{tell.label}</span>
                    </div>
                    <p className="mt-1 text-[0.75rem] text-[var(--text-secondary)]">
                      {tell.explanation}
                    </p>
                  </div>
                ))}
              </div>

              {/* Contrast & Gestalt Note */}
              <div className="rounded-xl bg-[var(--brand-soft)] p-3 text-[0.8125rem]">
                <p>
                  <strong>How to distinguish:</strong> {entry.contrastNote}
                </p>
                <p className="mt-1 text-[var(--text-secondary)]">
                  <strong>Gestalt cue:</strong> {entry.gestaltNote}
                </p>
              </div>

              {/* Highlighted Example Sample */}
              <div className="rounded-xl border-2 border-[var(--border-subtle)] p-3">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Sample ({entry.exampleSample.kind})
                </p>
                <p
                  lang={entry.id}
                  className="mt-1 text-[1rem] font-medium leading-relaxed"
                >
                  <HighlightedSampleText
                    sample={entry.exampleSample}
                    matches={sampleMatches}
                  />
                </p>
                <p className="mt-1 text-[0.75rem] text-[var(--text-secondary)] italic">
                  “{entry.exampleSample.translation}”
                </p>
              </div>
            </div>

            {/* Covered Candidate Countries */}
            <div className="border-t border-[var(--border-subtle)] pt-3">
              <p className="text-[0.75rem] font-semibold text-[var(--text-secondary)]">
                Street View Candidate Countries:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {entry.candidateCountries.map((country) => (
                  <span
                    key={country.id}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-2 py-0.5 text-[0.75rem] font-medium"
                  >
                    <span>{country.name}</span>
                    <span className="text-[0.6875rem] text-[var(--text-secondary)]">
                      ({country.coverageTier}, {country.drivingSide})
                    </span>
                  </span>
                ))}
              </div>
              {entry.uncoveredCountryNotes.length > 0 && (
                <p className="mt-1.5 text-[0.6875rem] text-[var(--text-secondary)]">
                  Note: {entry.uncoveredCountryNotes.join(' ')}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HighlightedSampleText({
  sample,
  matches,
}: {
  sample: LanguageSample;
  matches: TellSpanMatch[];
}) {
  const segments = buildHighlightedTextSegments(sample.text, matches);
  return (
    <>
      {segments.map((seg, idx) =>
        seg.tellMatch ? (
          <mark
            key={idx}
            title={`${seg.tellMatch.label} (${seg.tellMatch.pattern})`}
            className={
              TELL_HIGHLIGHT_CLASSES[
                seg.tellMatch.colorIndex % TELL_HIGHLIGHT_CLASSES.length
              ]
            }
          >
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
}
