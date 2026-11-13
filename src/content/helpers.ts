import type { Clue, Lesson } from './types.ts';

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
