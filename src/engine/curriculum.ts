import { CLUES, CLUE_MAP, LESSONS, TOPIC_MAP, type Lesson, type Topic } from '../content/index.ts';
import type { ProgressData } from '../storage/schema.ts';
import { countMastery, knowledgeScore, type MasteryCounts } from './mastery.ts';
import { dueClues } from './sessionBuilder.ts';

export interface TopicProgress {
  topic: Topic;
  counts: MasteryCounts;
  /** 0..1 */
  score: number;
  lessonsDone: number;
  started: boolean;
}

export function topicClueIds(topic: Topic): string[] {
  return topic.lessons.flatMap((l) => l.clueIds);
}

export function lessonCounts(lesson: Lesson, progress: ProgressData): MasteryCounts {
  return countMastery(lesson.clueIds, progress.clues);
}

export function topicProgress(topic: Topic, progress: ProgressData): TopicProgress {
  const counts = countMastery(topicClueIds(topic), progress.clues);
  return {
    topic,
    counts,
    score: knowledgeScore(counts),
    lessonsDone: topic.lessons.filter((l) => progress.completedLessons.includes(l.id)).length,
    started: counts.new < counts.total,
  };
}

export function overallProgress(progress: ProgressData): { counts: MasteryCounts; score: number } {
  const counts = countMastery(CLUES.map((c) => c.id), progress.clues);
  return { counts, score: knowledgeScore(counts) };
}

/** First lesson, in curriculum order, that the learner has not finished. */
export function nextLesson(progress: ProgressData): Lesson | null {
  return LESSONS.find((l) => !progress.completedLessons.includes(l.id)) ?? null;
}

export type NextAction =
  | { kind: 'review'; count: number }
  | { kind: 'lesson'; lesson: Lesson; topic: Topic; started: boolean }
  | { kind: 'practice' };

/** The one thing the dashboard recommends: review when a backlog builds, else the next lesson. */
export function nextAction(progress: ProgressData, now: Date): NextAction {
  const due = dueClues(progress, now).length;
  const lesson = nextLesson(progress);
  if (due >= 5 || (due > 0 && !lesson)) return { kind: 'review', count: due };
  if (lesson) {
    const started = lesson.clueIds.some((id) => progress.clues[id]);
    return { kind: 'lesson', lesson, topic: TOPIC_MAP[lesson.topicId], started };
  }
  return { kind: 'practice' };
}

export interface ConfusionPair {
  expectedId: string;
  chosenId: string;
  count: number;
}

/** Most frequent real mix-ups between two clues (foils are never recorded). */
export function topConfusions(progress: ProgressData, limit = 3): ConfusionPair[] {
  const pairs: ConfusionPair[] = [];
  for (const [expectedId, chosen] of Object.entries(progress.confusions)) {
    if (!CLUE_MAP[expectedId]) continue;
    for (const [chosenId, count] of Object.entries(chosen)) {
      if (CLUE_MAP[chosenId] && count >= 2) pairs.push({ expectedId, chosenId, count });
    }
  }
  return pairs.sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Started topic with the lowest knowledge score, if any needs attention. */
export function weakestTopic(progress: ProgressData, topics: Topic[]): TopicProgress | null {
  const started = topics.map((t) => topicProgress(t, progress)).filter((p) => p.started);
  if (started.length === 0) return null;
  return started.sort((a, b) => a.score - b.score)[0];
}
