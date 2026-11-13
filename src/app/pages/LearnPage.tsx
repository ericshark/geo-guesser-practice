import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { CLUE_MAP, TOPICS } from '../../content/index.ts';
import {
  nextAction,
  overallProgress,
  topConfusions,
  topicProgress,
  weakestTopic,
} from '../../engine/curriculum.ts';
import { dueClues } from '../../engine/sessionBuilder.ts';
import { useApp } from '../AppContext.tsx';
import { useDocumentTitle } from '../useDocumentTitle.ts';
import { MasteryBar, MasteryLegend } from '../ui.tsx';

export function LearnPage() {
  useDocumentTitle('Learn');
  const { progress } = useApp();
  const now = new Date();
  const action = nextAction(progress, now);
  const overall = overallProgress(progress);
  const due = dueClues(progress, now).length;
  const known = overall.counts.familiar + overall.counts.mastered;
  const confusions = topConfusions(progress, 3);
  const weak = weakestTopic(progress, TOPICS);
  const firstRun = progress.totalAnswers === 0;

  return (
    <div className="stack">
      {/* The single best next step. */}
      <section className="card card-accent" aria-labelledby="next-title">
        <div className="row-between wrap">
          <div className="stack-sm">
            <span className="eyebrow">{firstRun ? 'Start here' : 'Up next'}</span>
            {action.kind === 'review' && (
              <>
                <h1 id="next-title">Review {action.count} clue{action.count === 1 ? '' : 's'}</h1>
                <p className="muted">These are due now. Reviewing at the right moment is what makes them stick.</p>
              </>
            )}
            {action.kind === 'lesson' && (
              <>
                <h1 id="next-title">{action.lesson.title}</h1>
                <p className="muted">
                  {action.topic.title} · {action.lesson.summary}
                </p>
              </>
            )}
            {action.kind === 'practice' && (
              <>
                <h1 id="next-title">Mixed practice</h1>
                <p className="muted">You have finished every available lesson. Keep your knowledge sharp.</p>
              </>
            )}
          </div>
          {action.kind === 'review' && (
            <Link className="btn btn-primary btn-lg" to="/session/review">Start review <ArrowRight size={18} aria-hidden /></Link>
          )}
          {action.kind === 'lesson' && (
            <Link className="btn btn-primary btn-lg" to={`/session/lesson/${action.lesson.id}`}>
              {action.started ? 'Continue' : 'Start lesson'} <ArrowRight size={18} aria-hidden />
            </Link>
          )}
          {action.kind === 'practice' && (
            <Link className="btn btn-primary btn-lg" to="/practice">Practice <ArrowRight size={18} aria-hidden /></Link>
          )}
        </div>
      </section>

      {/* Where you stand. */}
      <section className="stack-sm" aria-label="Progress">
        <div className="grid-3 stats">
          <div className="card">
            <div className="stat-value">{known}<span className="muted small"> / {overall.counts.total}</span></div>
            <p className="muted small">clues known</p>
          </div>
          <div className="card">
            <div className="stat-value">{due}</div>
            <p className="muted small">
              due for review{due > 0 && <> · <Link to="/session/review" style={{ textDecoration: 'underline' }}>review</Link></>}
            </p>
          </div>
          <div className="card">
            <div className="stat-value">{progress.streakDays}</div>
            <p className="muted small">day streak</p>
          </div>
        </div>
        <div className="card stack-sm">
          <MasteryBar counts={overall.counts} />
          <MasteryLegend />
        </div>
      </section>

      {(confusions.length > 0 || weak) && (
        <section className="stack-sm" aria-labelledby="needs-title">
          <h2 id="needs-title">Needs work</h2>
          <div className="card card-flush">
            {confusions.map((c) => (
              <div className="path-item" key={`${c.expectedId}-${c.chosenId}`}>
                <div className="stack-sm" style={{ flex: 1 }}>
                  <strong>{CLUE_MAP[c.expectedId].title} ↔ {CLUE_MAP[c.chosenId].title}</strong>
                  <span className="muted small">Mixed up {c.count} times</span>
                </div>
                <Link
                  className="btn"
                  to={`/session/confusion/${encodeURIComponent(c.expectedId)}/${encodeURIComponent(c.chosenId)}`}
                >
                  Drill
                </Link>
              </div>
            ))}
            {weak && weak.score < 0.5 && (
              <div className="path-item">
                <div className="stack-sm" style={{ flex: 1 }}>
                  <strong>{weak.topic.title}</strong>
                  <span className="muted small">Your weakest topic so far</span>
                </div>
                <Link className="btn" to={`/learn/${weak.topic.id}`}>Open</Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* The curriculum. */}
      <section className="stack-sm" aria-labelledby="path-title">
        <h2 id="path-title">Curriculum</h2>
        <div className="card card-flush">
          {TOPICS.map((t) => {
            const p = topicProgress(t, progress);
            const finished = p.lessonsDone === t.lessons.length;
            return (
              <Link className="path-item card-link" to={`/learn/${t.id}`} key={t.id}>
                <span className={`path-num${finished ? ' done' : ''}`}>
                  {finished ? <Check size={16} aria-label="Completed" /> : t.order}
                </span>
                <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
                  <strong>{t.title}</strong>
                  <span className="muted small">{t.tagline}</span>
                  <MasteryBar counts={p.counts} />
                </div>
                <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
                  {p.lessonsDone}/{t.lessons.length} lessons
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
