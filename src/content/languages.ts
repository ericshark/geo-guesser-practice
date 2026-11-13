import { LANGUAGE_GROUPS, LANGUAGE_MAP, matchTells, PLAYABLE_COUNTRY_MAP } from '../data/index.ts';
import type { LanguageSpec, WorldRegion } from '../data/types.ts';
import type { Clue, Lesson, Topic } from './types.ts';
import { chunkLessons } from './helpers.ts';

const TOPIC_ID = 'languages';

/** Languages that show up constantly on GeoGuessr maps (value 3) vs. rare ones (value 1). */
const COMMON = new Set(['es', 'pt', 'fr', 'de', 'ru', 'ja', 'ko', 'th', 'id', 'hi', 'ar', 'tr', 'pl', 'it', 'zh-hans']);
const RARE = new Set(['is', 'mt', 'si', 'yo', 'zu', 'mn', 'ky', 'lo', 'gu', 'te', 'ka']);

function languageClue(language: LanguageSpec, siblings: LanguageSpec[]): Clue {
  const regions = new Set<WorldRegion>();
  for (const id of language.candidateCountryIds) {
    const country = PLAYABLE_COUNTRY_MAP[id];
    if (country) regions.add(country.region);
  }
  const detail = [
    language.contrastNote,
    ...language.tells.slice(0, 2).map((t) => `${t.label}: ${t.explanation}`),
  ].slice(0, 3);

  return {
    id: `lang:${language.id}`,
    topicId: TOPIC_ID,
    lessonId: '',
    title: language.name,
    subtitle: language.nativeName,
    stem: 'Which language is this?',
    spot: language.gestaltNote,
    detail,
    regions: [...regions],
    countryIds: language.candidateCountryIds.filter((id) => PLAYABLE_COUNTRY_MAP[id]),
    choiceGroup: language.groupId,
    confusables: siblings
      .filter((s) => s.id !== language.id)
      .map((s) => ({ clueId: `lang:${s.id}`, howToTell: language.contrastNote })),
    foils: [],
    stimuli: language.samples.map((s) => ({
      text: s.text,
      translation: s.translation,
      kind: s.kind === 'sign' ? ('sign' as const) : ('sentence' as const),
      // Keep only the tells that really occur in this text, so every highlight is verifiable.
      tellIds: matchTells(s.text, language.tells, s.tellIds, true).map((m) => m.tellId),
    })),
    tells: language.tells,
    value: COMMON.has(language.id) ? 3 : RARE.has(language.id) ? 1 : 2,
    confidence: 'high',
  };
}

export function buildLanguages(): { topic: Topic; clues: Clue[] } {
  const clues: Clue[] = [];
  const lessons: Lesson[] = [];

  for (const group of LANGUAGE_GROUPS) {
    const specs = group.languageIds
      .map((id) => LANGUAGE_MAP[id])
      .filter((l): l is LanguageSpec => Boolean(l));
    const groupClues = specs
      .map((l) => languageClue(l, specs))
      .sort((a, b) => b.value - a.value || a.title.localeCompare(b.title));
    lessons.push(
      ...chunkLessons({
        topicId: TOPIC_ID,
        baseId: `lang-${group.id}`,
        title: group.name,
        summary: group.primeSummary,
        clues: groupClues,
        max: 5,
      })
    );
    clues.push(...groupClues);
  }

  return {
    clues,
    topic: {
      id: TOPIC_ID,
      order: 2,
      title: 'Scripts & languages',
      tagline: 'Recognise a language from a few words, and which countries it points to.',
      why: 'A single sign narrows a round to a handful of countries. Telling look-alike languages apart (Czech vs Slovak, Norwegian vs Danish) is where most points are won.',
      bestRegions: 'Europe, Central and Southeast Asia, Africa',
      lessons,
    },
  };
}
