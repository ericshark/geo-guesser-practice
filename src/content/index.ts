import { buildFoundations } from './foundations.ts';
import { buildLanguages } from './languages.ts';
import { buildRoadLines } from './roadLines.ts';
import { buildTextClues } from './textClues.ts';
import type { Clue, Lesson, Topic, UpcomingTopic } from './types.ts';

export * from './types.ts';

const built = [buildFoundations(), buildLanguages(), buildRoadLines(), buildTextClues()];

/** Topics that are playable today, in curriculum order. */
export const TOPICS: Topic[] = built.map((b) => b.topic).sort((a, b) => a.order - b.order);

export const CLUES: Clue[] = built.flatMap((b) => b.clues);

export const CLUE_MAP: Record<string, Clue> = Object.fromEntries(CLUES.map((c) => [c.id, c]));

export const LESSONS: Lesson[] = TOPICS.flatMap((t) => t.lessons);

export const LESSON_MAP: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

export const TOPIC_MAP: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

/** Roadmap topics (see the curriculum plan); shown on the path as "coming soon". */
export const UPCOMING_TOPICS: UpcomingTopic[] = [
  { id: 'road-signs', order: 4, title: 'Road signs', tagline: 'Shapes, colours and symbols that differ by country.' },
  { id: 'bollards', order: 5, title: 'Bollards', tagline: 'Roadside posts, the strongest clue in Europe.' },
  { id: 'plates', order: 6, title: 'Licence plates', tagline: 'Colours, strips and proportions.' },
  { id: 'poles', order: 7, title: 'Utility poles', tagline: 'Pole and crossbar styles by region.' },
  { id: 'car-camera', order: 8, title: 'Google car & camera', tagline: 'Car and camera meta that identifies a country.' },
  { id: 'landscape', order: 9, title: 'Landscape & vegetation', tagline: 'Biomes, soil and signature trees.' },
  { id: 'architecture', order: 10, title: 'Architecture', tagline: 'Roofs, fences and building styles.' },
  { id: 'regions', order: 12, title: 'Big-country regions', tagline: 'Place yourself inside the USA, Canada, Brazil and others.' },
];

export function lessonsForTopic(topicId: string): Lesson[] {
  return TOPIC_MAP[topicId]?.lessons ?? [];
}

export function cluesForLesson(lessonId: string): Clue[] {
  return (LESSON_MAP[lessonId]?.clueIds ?? []).map((id) => CLUE_MAP[id]).filter(Boolean);
}

/** The curriculum position of a lesson across all topics (0-based), used to order "next". */
export function lessonIndex(lessonId: string): number {
  return LESSONS.findIndex((l) => l.id === lessonId);
}
