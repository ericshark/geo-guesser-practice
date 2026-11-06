import type { TellSpanMatch } from '../data/types.ts';

export interface TextSegment {
  text: string;
  tellMatch?: {
    tellId: string;
    label: string;
    pattern: string;
    colorIndex: number;
  };
}

/**
 * Splits a Sample string into contiguous segments, tagging character spans matched by Tells.
 */
export function buildHighlightedTextSegments(
  text: string,
  tellMatches: TellSpanMatch[]
): TextSegment[] {
  if (!text || tellMatches.length === 0) {
    return [{ text }];
  }

  interface FlatSpan {
    start: number;
    end: number;
    tellId: string;
    label: string;
    pattern: string;
    colorIndex: number;
  }

  const allSpans: FlatSpan[] = [];
  for (const match of tellMatches) {
    for (const span of match.spans) {
      if (span.start >= 0 && span.end <= text.length && span.end > span.start) {
        allSpans.push({
          start: span.start,
          end: span.end,
          tellId: match.tellId,
          label: match.label,
          pattern: match.pattern,
          colorIndex: match.colorIndex,
        });
      }
    }
  }

  if (allSpans.length === 0) {
    return [{ text }];
  }

  // Sort by start index ascending, then by longer span first
  allSpans.sort((a, b) => a.start - b.start || b.end - a.end);

  const nonOverlapping: FlatSpan[] = [];
  let cursor = 0;
  for (const span of allSpans) {
    if (span.start >= cursor) {
      nonOverlapping.push(span);
      cursor = span.end;
    }
  }

  const segments: TextSegment[] = [];
  let pos = 0;
  for (const span of nonOverlapping) {
    if (span.start > pos) {
      segments.push({ text: text.slice(pos, span.start) });
    }
    segments.push({
      text: text.slice(span.start, span.end),
      tellMatch: {
        tellId: span.tellId,
        label: span.label,
        pattern: span.pattern,
        colorIndex: span.colorIndex,
      },
    });
    pos = span.end;
  }

  if (pos < text.length) {
    segments.push({ text: text.slice(pos) });
  }

  return segments;
}
