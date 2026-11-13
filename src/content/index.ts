import { buildFoundations } from './foundations.ts';
import { buildLanguages } from './languages.ts';
import { buildBollards } from './bollards.ts';
import { buildLandscape } from './landscape.ts';
import { buildRegions } from './regions.ts';
import { buildArchitecture } from './architecture.ts';
import { buildVehicles } from './vehicles.ts';
import { buildPoles } from './poles.ts';
import { buildPlates } from './plates.ts';
import { buildRoadSigns } from './roadSigns.ts';
import { buildRoadLines } from './roadLines.ts';
import { buildTextClues } from './textClues.ts';
import type { Clue, Lesson, Topic, UpcomingTopic } from './types.ts';

export * from './types.ts';

const built = [buildFoundations(), buildLanguages(), buildRoadLines(), buildRoadSigns(), buildBollards(), buildPlates(), buildPoles(), buildVehicles(), buildLandscape(), buildArchitecture(), buildRegions(), buildTextClues()];

/** Topics that are playable today, in curriculum order. */
export const TOPICS: Topic[] = built.map((b) => b.topic).sort((a, b) => a.order - b.order);

export const CLUES: Clue[] = built.flatMap((b) => b.clues);

export const CLUE_MAP: Record<string, Clue> = Object.fromEntries(CLUES.map((c) => [c.id, c]));

export const LESSONS: Lesson[] = TOPICS.flatMap((t) => t.lessons);

export const LESSON_MAP: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

export const TOPIC_MAP: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

/** Roadmap topics (see the curriculum plan); shown on the path as "coming soon". */
export const UPCOMING_TOPICS: UpcomingTopic[] = [
  { id: 'car-camera', order: 14, title: 'Google car & camera', tagline: 'Car and camera meta that identifies a country.' },
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
