import type { Clue, Lesson, Source } from './types.ts';

/** Reference builders, so each clue can list the independent sources it was checked against. */
export const plonkit = (slug: string, name: string): Source => ({
  title: `Plonk It: ${name}`,
  url: `https://www.plonkit.net/${slug}`,
});
export const wiki = (page: string, title = page.replace(/_/g, ' ')): Source => ({
  title: `Wikipedia: ${title}`,
  url: `https://en.wikipedia.org/wiki/${page}`,
});
export const geohints = (page: string, title: string): Source => ({
  title: `GeoHints: ${title}`,
  url: `https://geohints.com/meta/${page}`,
});

/** Stamps `sources` onto clues by short id (the id without its topic prefix). */
export function attachSources(clues: Clue[], prefix: string, sources: Record<string, Source[]>): void {
  for (const [shortId, list] of Object.entries(sources)) {
    const clue = clues.find((c) => c.id === `${prefix}${shortId}`);
    if (!clue) throw new Error(`No clue ${prefix}${shortId} to attach sources to`);
    clue.sources = list;
  }
}

/**
 * Declares look-alike pairs. Each tuple is [a, b, howToTellAFromB, howToTellBFromA?]: the note is
 * what the learner should look for when they picked b but the answer was a (and the reverse).
 * Both directions are added, so the relationship is always symmetric.
 */
export function linkConfusables(
  clues: Clue[],
  prefix: string,
  pairs: [string, string, string, string?][]
): void {
  const find = (shortId: string) => {
    const clue = clues.find((c) => c.id === `${prefix}${shortId}`);
    if (!clue) throw new Error(`No clue ${prefix}${shortId} to link`);
    return clue;
  };
  for (const [a, b, noteA, noteB] of pairs) {
    const ca = find(a);
    const cb = find(b);
    ca.confusables.push({ clueId: cb.id, howToTell: noteA });
    cb.confusables.push({ clueId: ca.id, howToTell: noteB ?? noteA });
  }
}

interface ChunkInput {
  topicId: string;
  baseId: string;
  title: string;
  summary: string;
  clues: Clue[];
  max: number;
}

/**
 * Splits clues into lessons of at most `max` clues (a lesson introduces few new clues at once),
 * stamps each clue with its lesson id, and numbers the titles when there is more than one part.
 */
export function chunkLessons({ topicId, baseId, title, summary, clues, max }: ChunkInput): Lesson[] {
  if (clues.length === 0) return [];
  const parts = Math.ceil(clues.length / max);
  // Even split so the last lesson is not a single orphan clue.
  const size = Math.ceil(clues.length / parts);
  const lessons: Lesson[] = [];
  for (let i = 0; i < parts; i += 1) {
    const slice = clues.slice(i * size, (i + 1) * size);
    const id = parts === 1 ? baseId : `${baseId}-${i + 1}`;
    for (const clue of slice) clue.lessonId = id;
    lessons.push({
      id,
      topicId,
      title: parts === 1 ? title : `${title} (${i + 1}/${parts})`,
      summary,
      clueIds: slice.map((c) => c.id),
    });
  }
  return lessons;
}
