import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, ChevronLeft } from 'lucide-react';
import { TOPIC_MAP } from '../../content/index.ts';
import { lessonCounts, topicProgress } from '../../engine/curriculum.ts';
import { useApp } from '../AppContext.tsx';
import { useDocumentTitle } from '../useDocumentTitle.ts';
import { MasteryBar, MasteryLegend } from '../ui.tsx';

export function TopicPage() {
  const { topicId = '' } = useParams();
  const { progress } = useApp();
  const navigate = useNavigate();
  const topic = TOPIC_MAP[topicId];
  useDocumentTitle(topic?.title ?? 'Topic');
  if (!topic) return <Navigate to="/" replace />;

  const p = topicProgress(topic, progress);
  const nextLesson = topic.lessons.find((l) => !progress.completedLessons.includes(l.id));
  const target = nextLesson ?? topic.lessons[0];
  const started = target.clueIds.some((id) => progress.clues[id]);

  return (
    <div className="stack page-narrow" style={{ margin: '0 auto' }}>
      <Link to="/" className="row muted small"><ChevronLeft size={16} aria-hidden /> Learn</Link>

      <header className="stack-sm">
        <span className="eyebrow">Topic {topic.order}</span>
        <h1>{topic.title}</h1>
        <p className="muted">{topic.tagline}</p>
      </header>

      <section className="card stack-sm">
        <h2>Why it matters in GeoGuessr</h2>
        <p>{topic.why}</p>
        <p className="muted small"><strong>Most decisive in:</strong> {topic.bestRegions}</p>
      </section>

      <section className="card stack-sm">
        <div className="row-between wrap">
          <h2>Your progress</h2>
          <span className="muted small">{p.counts.total} clues · {p.lessonsDone}/{topic.lessons.length} lessons</span>
        </div>
        <MasteryBar counts={p.counts} />
        <MasteryLegend />
      </section>

      <Link className="btn btn-primary btn-lg" to={`/session/lesson/${target.id}`} style={{ alignSelf: 'flex-start' }}>
        {nextLesson ? (started ? 'Continue' : 'Start') + `: ${target.title}` : `Review: ${target.title}`}
        <ArrowRight size={18} aria-hidden />
      </Link>

      <section className="stack-sm" aria-labelledby="lessons-title">
        <h2 id="lessons-title">Lessons</h2>
        <div className="card card-flush">
          {topic.lessons.map((lesson, i) => {
            const done = progress.completedLessons.includes(lesson.id);
            const counts = lessonCounts(lesson, progress);
            return (
              <button
                type="button"
                key={lesson.id}
                className="lesson-row"
                onClick={() => navigate(`/session/lesson/${lesson.id}`)}
              >
                <span className={`path-num${done ? ' done' : ''}`}>
                  {done ? <Check size={16} aria-label="Completed" /> : i + 1}
                </span>
                <span className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
                  <strong>{lesson.title}</strong>
                  <span className="muted small">{lesson.clueIds.length} clues</span>
                  <MasteryBar counts={counts} />
                </span>
                <ArrowRight size={16} aria-hidden className="muted" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
