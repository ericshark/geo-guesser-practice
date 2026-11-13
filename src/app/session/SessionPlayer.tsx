import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lightbulb, X } from 'lucide-react';
import { CLUE_MAP, type Clue, type RoadVisual } from '../../content/index.ts';
import { RoadSvg } from '../RoadSvg.tsx';
import { PLAYABLE_COUNTRY_MAP } from '../../data/index.ts';
import { nextAction } from '../../engine/curriculum.ts';
import { explain, highlightStimulus } from '../../engine/explain.ts';
import { buildQuestion, type Question } from '../../engine/questionGen.ts';
import { requeueMissed, type SessionPlan } from '../../engine/sessionBuilder.ts';
import type { AnswerResult } from '../../storage/schema.ts';
import { useApp } from '../AppContext.tsx';
import { useDocumentTitle } from '../useDocumentTitle.ts';
import { CountryChips, formatDue, MiniMap } from '../ui.tsx';

interface Outcome {
  clueId: string;
  result: AnswerResult;
}

type Phase = 'study' | 'ask' | 'done';

export function SessionPlayer({ plan, exitTo }: { plan: SessionPlan; exitTo: string }) {
  const { store } = useApp();
  useDocumentTitle(plan.title);
  const [phase, setPhase] = useState<Phase>(
    plan.queue.length === 0 ? 'done' : plan.study.length > 0 ? 'study' : 'ask'
  );
  const [studyIndex, setStudyIndex] = useState(0);
  const [queue, setQueue] = useState(plan.queue);
  const [index, setIndex] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);

  const requeued = useRef(new Set<string>());
  const startedAt = useRef(0);
  const lastStimulus = useRef(new Map<string, number>());
  const finished = useRef(false);

  const begin = useCallback((nextIndex: number, list: string[]) => {
    const clue = CLUE_MAP[list[nextIndex]];
    const q = buildQuestion(clue, Math.random, { avoidStimulusIndex: lastStimulus.current.get(clue.id) });
    lastStimulus.current.set(clue.id, q.stimulusIndex);
    setIndex(nextIndex);
    setQuestion(q);
    setSelected(null);
    setHintShown(false);
    startedAt.current = performance.now();
  }, []);

  // Start the first question straight away when there is nothing to study.
  const started = useRef(false);
  useEffect(() => {
    if (!started.current && phase === 'ask' && question === null && queue.length > 0) {
      started.current = true;
      begin(0, queue);
    }
  }, [phase, question, queue, begin]);

  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    if (plan.scope.kind === 'lesson') await store.completeLesson(plan.scope.lessonId);
    setPhase('done');
  }, [plan.scope, store]);

  const answer = useCallback(
    (optionId: string) => {
      if (!question || selected) return;
      const correct = optionId === question.correctId;
      const result: AnswerResult = correct ? (hintShown ? 'hint' : 'correct') : 'wrong';
      setSelected(optionId);
      setOutcomes((o) => [...o, { clueId: question.clueId, result }]);
      void store.recordAnswer({
        clueId: question.clueId,
        chosenId: optionId,
        result,
        responseTimeMs: performance.now() - startedAt.current,
      });
      if (!correct && !requeued.current.has(question.clueId)) {
        requeued.current.add(question.clueId);
        setQueue((q) => requeueMissed(q, index, question.clueId));
      }
    },
    [question, selected, hintShown, store, index]
  );

  const next = useCallback(() => {
    if (index + 1 >= queue.length) {
      void finish();
    } else {
      begin(index + 1, queue);
    }
  }, [index, queue, begin, finish]);

  const startQuestions = useCallback(() => {
    setPhase('ask');
    started.current = true;
    begin(0, queue);
  }, [begin, queue]);

  // One keyboard handler for the whole player.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (phase === 'study') {
        if (e.key === 'Enter' || e.key === 'ArrowRight') {
          e.preventDefault();
          if (studyIndex + 1 < plan.study.length) setStudyIndex(studyIndex + 1);
          else startQuestions();
        }
        return;
      }
      if (phase !== 'ask' || !question) return;
      if (!selected) {
        const n = Number(e.key);
        if (n >= 1 && n <= question.options.length) answer(question.options[n - 1].id);
        else if (e.key === 'h' || e.key === '?') setHintShown(true);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, studyIndex, plan.study.length, question, selected, answer, next, startQuestions]);

  const total = queue.length;
  const percent =
    phase === 'done' ? 100 : phase === 'study' ? 0 : (index / Math.max(1, total)) * 100;

  return (
    <div className="session">
      <div className="session-top">
        <Link to={exitTo} className="btn btn-ghost" aria-label="Exit session"><X size={20} aria-hidden /></Link>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-label="Session progress">
          <span className="progress-bar-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
          {phase === 'study' ? `Clue ${studyIndex + 1}/${plan.study.length}` : phase === 'ask' ? `${index + 1}/${total}` : ''}
        </span>
      </div>

      {phase === 'study' && (
        <StudyCard
          clue={plan.study[studyIndex]}
          title={plan.title}
          isLast={studyIndex + 1 >= plan.study.length}
          onNext={() => (studyIndex + 1 < plan.study.length ? setStudyIndex(studyIndex + 1) : startQuestions())}
        />
      )}

      {phase === 'ask' && question && (
        <QuestionView
          question={question}
          selected={selected}
          hintShown={hintShown}
          onHint={() => setHintShown(true)}
          onAnswer={answer}
          onNext={next}
          isLast={index + 1 >= queue.length}
        />
      )}

      {phase === 'done' && <Summary plan={plan} outcomes={outcomes} exitTo={exitTo} />}
    </div>
  );
}

/* ------------------------------------------------------------------ study */

function StudyCard({
  clue,
  title,
  isLast,
  onNext,
}: {
  clue: Clue;
  title: string;
  isLast: boolean;
  onNext: () => void;
}) {
  const samples = clue.stimuli.slice(0, 2);
  const lookalikes = clue.confusables.slice(0, 2).filter((c) => CLUE_MAP[c.clueId]);
  return (
    <div className="stack">
      <div className="stack-sm">
        <span className="eyebrow">{title} · new clue</span>
        <h1>{clue.title}{clue.subtitle ? <span className="muted" style={{ fontWeight: 400 }}> · {clue.subtitle}</span> : null}</h1>
      </div>

      <div className="card study-card">
        <div className="stack-sm">
          <h3>What to look for</h3>
          <p>{clue.confidence === 'medium' ? `Usually: ${clue.spot}` : clue.spot}</p>
          {clue.detail.length > 0 && (
            <ul className="bullets">
              {clue.detail.map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
        </div>

        {clue.stimuli[0]?.visual && (
          <div className="stack-sm">
            <h3>Example</h3>
            <RoadSvg visual={clue.stimuli[0].visual} label={clue.stimuli[0].text} />
            <p className="muted small" style={{ textAlign: 'center' }}>Schematic illustration</p>
          </div>
        )}
        {clue.stimuli.length > 0 && clue.stimuli[0].kind !== 'plain' && (
          <div className="stack-sm">
            <h3>Example{samples.length > 1 ? 's' : ''}</h3>
            {samples.map((s) => (
              <Stimulus key={s.text} clue={clue} text={s.text} translation={s.translation} kind={s.kind} mono={s.mono} tellIds={s.tellIds} highlight />
            ))}
          </div>
        )}
        {clue.stimuli.length > 0 && clue.stimuli[0].kind === 'plain' && clue.stimuli[0].mono && (
          <div className="stack-sm">
            <h3>Example</h3>
            {samples.map((s) => (
              <Stimulus key={s.text} clue={clue} text={s.text} mono kind="plain" />
            ))}
          </div>
        )}

        {clue.countryIds.length > 0 && (
          <div className="stack-sm">
            <h3>Where it applies</h3>
            <MiniMap countryIds={clue.countryIds} />
            <CountryChips ids={clue.countryIds} />
          </div>
        )}

        {lookalikes.length > 0 && (
          <div className="stack-sm">
            <h3>Don’t confuse with</h3>
            <ul className="bullets" style={{ color: 'var(--ink)' }}>
              {lookalikes.map((c) => (
                <li key={c.clueId}><strong>{CLUE_MAP[c.clueId].title}</strong> <span className="muted">· {c.howToTell}</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="session-footer">
        <div className="session-footer-inner">
          <span className="muted small"><span className="kbd">Enter</span> next</span>
          <button type="button" className="btn btn-primary btn-lg" onClick={onNext}>
            {isLast ? 'Start questions' : 'Next clue'} <ArrowRight size={18} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- question */

function Stimulus({
  clue,
  text,
  translation,
  kind,
  mono,
  tellIds,
  highlight,
  visual,
}: {
  visual?: RoadVisual;
  clue: Clue;
  text: string;
  translation?: string;
  kind?: 'sign' | 'sentence' | 'plain';
  mono?: boolean;
  tellIds?: string[];
  highlight?: boolean;
}) {
  if (visual) return <RoadSvg visual={visual} label={text} />;
  const segments = highlight ? highlightStimulus(clue, text, tellIds) : [{ text }];
  return (
    <div className={`stimulus${kind === 'sign' ? ' sign' : ''}${mono ? ' mono' : ''}${kind === 'plain' && !mono ? ' plain' : ''}`}>
      {segments.map((seg, i) =>
        'tellMatch' in seg && seg.tellMatch ? (
          <mark key={i} className="tell" title={seg.tellMatch.label} style={{ color: 'inherit' }}>{seg.text}</mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
      {translation && <div className="translation">{translation}</div>}
    </div>
  );
}

function QuestionView({
  question,
  selected,
  hintShown,
  onHint,
  onAnswer,
  onNext,
  isLast,
}: {
  question: Question;
  selected: string | null;
  hintShown: boolean;
  onHint: () => void;
  onAnswer: (id: string) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const clue = CLUE_MAP[question.clueId];
  const answered = selected !== null;
  const correct = selected === question.correctId;
  const explanation = answered ? explain(question, selected) : null;
  const s = question.stimulus;

  return (
    <div>
      <p className="stem">{question.stem}</p>

      {/* Questions with no stimulus ("which of these drives left?") ask in words only. */}
      {(s.kind !== 'plain' || s.mono || s.visual) && (
        <Stimulus
          visual={s.visual}
          clue={clue}
          text={s.text}
          translation={answered ? s.translation : undefined}
          kind={s.kind}
          mono={s.mono}
          tellIds={s.tellIds}
          highlight={answered}
        />
      )}

      <div className="options" role="group" aria-label="Answers">
        {question.options.map((o, i) => {
          const state = !answered
            ? 'idle'
            : o.id === question.correctId
              ? 'correct'
              : o.id === selected
                ? 'wrong'
                : 'dim';
          return (
            <button
              key={o.id}
              type="button"
              className="option"
              data-state={state}
              disabled={answered}
              onClick={() => onAnswer(o.id)}
            >
              <span className="key" aria-hidden>{i + 1}</span>
              <span>
                <span className="label">{o.label}</span>
                {o.sublabel && <span className="sub"> · {o.sublabel}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {!answered && (
        <div style={{ marginTop: 16 }}>
          {hintShown ? (
            <div className="feedback" role="note">
              <div className="feedback-title">What to look for</div>
              <p className="small">{clue.spot}</p>
              <p className="muted small">Answering with a hint counts as a weaker recall, so this clue comes back sooner.</p>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={onHint}>
              <Lightbulb size={16} aria-hidden /> Show what to look for <span className="kbd">h</span>
            </button>
          )}
        </div>
      )}

      {answered && explanation && (
        <div className={`feedback ${correct ? 'good' : 'bad'}`} role="status" aria-live="polite">
          <div className="feedback-title">{correct ? 'Correct' : 'Not quite'}</div>
          {correct ? (
            <>
              <p className="small" style={{ marginTop: 4 }}>{explanation.right.spot}</p>
              {explanation.right.countryIds.length > 0 && (
                <div style={{ marginTop: 8 }}><CountryChips ids={explanation.right.countryIds} limit={6} /></div>
              )}
            </>
          ) : (
            <>
              {explanation.contrast && <p className="small" style={{ marginTop: 4 }}>{explanation.contrast}</p>}
              <div className="compare">
                <div>
                  <div className="tag right">Correct</div>
                  <strong>{explanation.right.label}</strong>
                  {explanation.right.detail.length > 0 && (
                    <ul className="bullets">{explanation.right.detail.slice(0, 2).map((d) => <li key={d}>{d}</li>)}</ul>
                  )}
                  <div style={{ marginTop: 8 }}><CountryChips ids={explanation.right.countryIds} limit={5} /></div>
                </div>
                {explanation.wrong && (
                  <div>
                    <div className="tag wrong">You chose</div>
                    <strong>{explanation.wrong.label}</strong>
                    <p className="muted small">{explanation.wrong.spot}</p>
                    <div style={{ marginTop: 8 }}><CountryChips ids={explanation.wrong.countryIds} limit={5} /></div>
                  </div>
                )}
              </div>
              {clue.countryIds.length > 0 && (
                <div style={{ marginTop: 12 }}><MiniMap countryIds={clue.countryIds} /></div>
              )}
            </>
          )}
        </div>
      )}

      {answered && (
        <div className="session-footer">
          <div className="session-footer-inner">
            <span className="muted small"><span className="kbd">Enter</span> continue</span>
            <button type="button" className="btn btn-primary btn-lg" onClick={onNext} autoFocus>
              {isLast ? 'Finish' : 'Continue'} <ArrowRight size={18} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- summary */

function Summary({ plan, outcomes, exitTo }: { plan: SessionPlan; outcomes: Outcome[]; exitTo: string }) {
  const { progress } = useApp();
  const now = new Date();

  if (plan.queue.length === 0) {
    return (
      <div className="stack">
        <h1>{plan.title}</h1>
        <p className="muted">{plan.emptyReason ?? 'Nothing to practise yet.'}</p>
        <Link className="btn btn-primary" to={exitTo} style={{ alignSelf: 'flex-start' }}>Back</Link>
      </div>
    );
  }

  const correctUnaided = outcomes.filter((o) => o.result === 'correct').length;
  const toRevisit = [...new Set(outcomes.filter((o) => o.result !== 'correct').map((o) => o.clueId))]
    .filter((id) => {
      // A clue missed once and then answered correctly later in the session is already repaired.
      const last = [...outcomes].reverse().find((o) => o.clueId === id)!;
      return last.result !== 'correct';
    });
  const strengthened = [...new Set(outcomes.filter((o) => o.result === 'correct').map((o) => o.clueId))]
    .filter((id) => !toRevisit.includes(id));

  const touched = [...new Set(outcomes.map((o) => o.clueId))];
  const nextDue = touched
    .map((id) => progress.clues[id])
    .filter(Boolean)
    .map((r) => new Date(r.card.due))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const action = nextAction(progress, now);
  const nextTo =
    action.kind === 'lesson'
      ? { to: `/session/lesson/${action.lesson.id}`, label: `Next: ${action.lesson.title}` }
      : action.kind === 'review'
        ? { to: '/session/review', label: `Review ${action.count} due` }
        : { to: '/practice', label: 'Keep practising' };

  return (
    <div className="stack">
      <header className="stack-sm">
        <span className="eyebrow">{plan.title}</span>
        <h1>{correctUnaided} of {outcomes.length} correct</h1>
      </header>

      {strengthened.length > 0 && (
        <section className="card stack-sm">
          <h2>Strengthened</h2>
          <div className="country-chips">
            {strengthened.map((id) => <span className="chip" key={id}>{CLUE_MAP[id].title}</span>)}
          </div>
        </section>
      )}

      {toRevisit.length > 0 && (
        <section className="card stack-sm">
          <h2>Worth another look</h2>
          <ul className="bullets" style={{ color: 'var(--ink)' }}>
            {toRevisit.map((id) => {
              const clue = CLUE_MAP[id];
              // A single-country clue already names its country in the title and spot.
              const names =
                clue.countryIds.length > 1
                  ? clue.countryIds.slice(0, 3).map((c) => PLAYABLE_COUNTRY_MAP[c]?.name).filter(Boolean).join(', ')
                  : '';
              return (
                <li key={id}>
                  <strong>{clue.title}</strong>
                  <span className="muted"> · {clue.spot}{names ? ` (${names})` : ''}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {nextDue && (
        <p className="muted small">Next review of these clues: {formatDue(nextDue, now)}.</p>
      )}

      <div className="row wrap">
        <Link className="btn btn-primary btn-lg" to={nextTo.to}>{nextTo.label} <ArrowRight size={18} aria-hidden /></Link>
        <Link className="btn btn-lg" to={exitTo}>Done</Link>
      </div>
    </div>
  );
}
