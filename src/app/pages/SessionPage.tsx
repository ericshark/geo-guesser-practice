import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { CLUE_MAP, LESSON_MAP } from '../../content/index.ts';
import { PLAYABLE_COUNTRY_MAP } from '../../data/index.ts';
import {
  buildSession,
  type PracticeRegion,
  type SessionPlan,
  type SessionScope,
} from '../../engine/sessionBuilder.ts';
import type { ProgressData } from '../../storage/schema.ts';
import { useApp } from '../AppContext.tsx';
import { SessionPlayer } from '../session/SessionPlayer.tsx';

const REGIONS = new Set(['Europe', 'Asia', 'Africa', 'Americas', 'Oceania']);

export type SessionKind = 'lesson' | 'review' | 'mixed' | 'confusion' | 'country';

function scopeFor(kind: SessionKind, params: Record<string, string | undefined>): { scope: SessionScope; exitTo: string } | null {
  switch (kind) {
    case 'lesson': {
      const lesson = params.id ? LESSON_MAP[params.id] : undefined;
      return lesson ? { scope: { kind: 'lesson', lessonId: lesson.id }, exitTo: `/learn/${lesson.topicId}` } : null;
    }
    case 'review':
      return { scope: { kind: 'review' }, exitTo: '/' };
    case 'mixed': {
      const region = params.region ?? 'all';
      if (region !== 'all' && !REGIONS.has(region)) return null;
      return { scope: { kind: 'mixed', region: region as PracticeRegion }, exitTo: '/practice' };
    }
    case 'confusion': {
      const a = params.a && CLUE_MAP[params.a];
      const b = params.b && CLUE_MAP[params.b];
      if (!a || !b) return null;
      return {
        scope: { kind: 'confusion', clueIds: [a.id, b.id], label: `${a.title} and ${b.title}` },
        exitTo: '/',
      };
    }
    case 'country': {
      const country = params.id ? PLAYABLE_COUNTRY_MAP[params.id] : undefined;
      return country
        ? { scope: { kind: 'country', countryId: country.id, label: country.name }, exitTo: `/reference/${country.id}` }
        : null;
    }
  }
}

export function SessionPage({ kind }: { kind: SessionKind }) {
  const params = useParams();
  const { progress } = useApp();
  const resolved = scopeFor(kind, params);
  if (!resolved) return <Navigate to="/" replace />;
  return <PlannedSession scope={resolved.scope} exitTo={resolved.exitTo} progress={progress} />;
}

/** The plan is built once, so the questions do not reshuffle as progress updates mid-session. */
function PlannedSession({ scope, exitTo, progress }: { scope: SessionScope; exitTo: string; progress: ProgressData }) {
  const [plan] = useState<SessionPlan>(() => buildSession(scope, progress));
  return <SessionPlayer plan={plan} exitTo={exitTo} />;
}
