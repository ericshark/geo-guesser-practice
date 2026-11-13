import type { LanguageSample, LanguageSpec, TellSpanMatch, TellSpec } from './types.ts';

const LETTER = '[\\p{L}\\p{M}\\p{N}]';

/**
 * JavaScript's `\b` only knows ASCII letters, even with the `u` flag, so it never fires next to
 * Cyrillic, accented or non-Latin letters. This rewrites each `\b` into a Unicode-aware boundary:
 * a lookbehind when it opens a word (start of pattern, or after `(` or `|`), a lookahead otherwise.
 */
export function compileTellRegex(source: string, flags = 'gu'): RegExp {
  let out = '';
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === '\\' && source[i + 1] === 'b') {
      const prev = out[out.length - 1];
      out += !prev || prev === '(' || prev === '|' ? `(?<!${LETTER})` : `(?!${LETTER})`;
      i += 1;
    } else if (source[i] === '\\') {
      out += source[i] + (source[i + 1] ?? '');
      i += 1;
    } else {
      out += source[i];
    }
  }
  return new RegExp(out, flags);
}

// Finds the character spans of each tell inside a text. Tells whose ids are in
// `preferredTellIds` come first (they get the first highlight colours), then the rest unless
// `onlyPreferred` is set (used for highlighting a sample: show only the tells it teaches).
export function matchTells(
  text: string,
  tells: TellSpec[],
  preferredTellIds: string[] = [],
  onlyPreferred = false
): TellSpanMatch[] {
  const results: TellSpanMatch[] = [];
  const ordered = [
    ...tells.filter((t) => preferredTellIds.includes(t.id)),
    ...(onlyPreferred ? [] : tells.filter((t) => !preferredTellIds.includes(t.id))),
  ];

  ordered.forEach((tell, idx) => {
    if (!tell.regex) return;
    let regex: RegExp;
    try {
      regex = compileTellRegex(tell.regex);
    } catch {
      return;
    }
    const spans: TellSpanMatch['spans'] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex += 1;
        continue;
      }
      spans.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
    }
    if (spans.length > 0) {
      results.push({
        tellId: tell.id,
        pattern: tell.pattern,
        label: tell.label,
        explanation: tell.explanation,
        isUnique: tell.isUnique,
        colorIndex: idx % 4,
        spans,
      });
    }
  });

  return results;
}

export function findTellMatchesInSample(sample: LanguageSample, language: LanguageSpec): TellSpanMatch[] {
  return matchTells(sample.text, language.tells, sample.tellIds);
}
