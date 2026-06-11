import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getQuiz, saveQuiz } from '../lib/db';
import {
  QUESTION_TYPES, ROUND_TYPES, blankRound, blankQuestion, defaultRoundSettings,
} from '../lib/quizModel';

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function QuestionEditor({ question, onChange, onDelete, index }) {
  const typeInfo = QUESTION_TYPES[question.type];
  const set = (patch) => onChange({ ...question, ...patch });

  function setType(type) {
    const patch = { type };
    if (type === 'multiple_choice') {
      patch.options = question.options?.length ? question.options : ['', '', '', ''];
      patch.correctAnswer = 0;
    } else if (type === 'true_false') {
      patch.correctAnswer = 'true';
    } else if (type === 'closest_number') {
      patch.correctAnswer = '';
    } else {
      patch.correctAnswer = '';
    }
    set(patch);
  }

  return (
    <div className="card question-editor">
      <div className="row spread">
        <strong>Question {index + 1}</strong>
        <button className="btn danger ghost small" onClick={onDelete}>Remove</button>
      </div>

      <Field label="Question text">
        <textarea value={question.text} rows={2} onChange={(e) => set({ text: e.target.value })} />
      </Field>

      <div className="grid-3">
        <Field label="Type">
          <select value={question.type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(QUESTION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Points">
          <input type="number" min={0} value={question.points} onChange={(e) => set({ points: Number(e.target.value) })} />
        </Field>
        <Field label="Time limit (sec, 0 = none)">
          <input type="number" min={0} value={question.timeLimit} onChange={(e) => set({ timeLimit: Number(e.target.value) })} />
        </Field>
      </div>

      {question.type === 'multiple_choice' && (
        <div className="options-editor">
          <span className="field-label">Options (select the correct one)</span>
          {(question.options || []).map((opt, i) => (
            <div className="row gap" key={i}>
              <input
                type="radio"
                name={`correct_${question.id}`}
                checked={Number(question.correctAnswer) === i}
                onChange={() => set({ correctAnswer: i })}
                aria-label={`Option ${i + 1} is correct`}
              />
              <input
                className="grow"
                value={opt}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                onChange={(e) => {
                  const options = [...question.options];
                  options[i] = e.target.value;
                  set({ options });
                }}
              />
              <button
                className="btn ghost small"
                disabled={question.options.length <= 2}
                onClick={() => {
                  const options = question.options.filter((_, j) => j !== i);
                  const correctAnswer = Number(question.correctAnswer) === i ? 0
                    : Number(question.correctAnswer) > i ? Number(question.correctAnswer) - 1
                    : question.correctAnswer;
                  set({ options, correctAnswer });
                }}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="btn ghost small"
            disabled={(question.options || []).length >= 6}
            onClick={() => set({ options: [...(question.options || []), ''] })}
          >
            ＋ Add option
          </button>
        </div>
      )}

      {question.type === 'true_false' && (
        <Field label="Correct answer">
          <select value={String(question.correctAnswer)} onChange={(e) => set({ correctAnswer: e.target.value })}>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </Field>
      )}

      {(question.type === 'free_text' || question.type === 'image') && (
        <Field label={`Correct answer — ${typeInfo.answerHint}`}>
          <input value={question.correctAnswer} onChange={(e) => set({ correctAnswer: e.target.value })} />
        </Field>
      )}

      {question.type === 'closest_number' && (
        <Field label="Correct answer (number)">
          <input type="number" step="any" value={question.correctAnswer} onChange={(e) => set({ correctAnswer: Number(e.target.value) })} />
        </Field>
      )}

      <div className="grid-2">
        <Field label={`Media URL ${typeInfo.requiresMedia ? '(required for image questions)' : '(optional)'}`}>
          <input
            value={question.mediaUrl || ''}
            placeholder="https://…/image.jpg"
            onChange={(e) => set({ mediaUrl: e.target.value })}
          />
        </Field>
        <Field label="Media type">
          <select value={question.mediaType || 'image'} onChange={(e) => set({ mediaType: e.target.value })}>
            <option value="image">Image</option>
            <option value="audio">Audio</option>
          </select>
        </Field>
      </div>
      {question.mediaUrl && question.mediaType === 'image' && (
        <img className="media-preview" src={question.mediaUrl} alt="preview" />
      )}
    </div>
  );
}

function RoundEditor({ round, index, onChange, onDelete, onMove, total }) {
  const typeInfo = ROUND_TYPES[round.type];
  const set = (patch) => onChange({ ...round, ...patch });

  return (
    <div className="card round-editor">
      <div className="row spread wrap">
        <h2>Round {index + 1}: {round.name || 'Untitled'}</h2>
        <div className="row gap">
          <button className="btn ghost small" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
          <button className="btn ghost small" disabled={index === total - 1} onClick={() => onMove(1)}>↓</button>
          <button className="btn danger ghost small" onClick={onDelete}>Remove round</button>
        </div>
      </div>

      <div className="grid-3">
        <Field label="Round name">
          <input value={round.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Category">
          <input value={round.category} placeholder="e.g. Music, History" onChange={(e) => set({ category: e.target.value })} />
        </Field>
        <Field label="Round type">
          <select
            value={round.type}
            onChange={(e) => set({ type: e.target.value, settings: defaultRoundSettings(e.target.value) })}
          >
            {Object.entries(ROUND_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <p className="muted small-text">{typeInfo.description}</p>

      <Field label="Round description (shown to players)">
        <input value={round.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>

      {Object.keys(typeInfo.settings).length > 0 && (
        <div className="settings-box">
          <span className="field-label">Round options</span>
          <div className="grid-2">
            {Object.entries(typeInfo.settings).map(([key, spec]) => (
              <Field key={key} label={spec.label}>
                {spec.type === 'boolean' ? (
                  <select
                    value={String(round.settings?.[key] ?? spec.default)}
                    onChange={(e) => set({ settings: { ...round.settings, [key]: e.target.value === 'true' } })}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    type="number"
                    value={round.settings?.[key] ?? spec.default}
                    onChange={(e) => set({ settings: { ...round.settings, [key]: Number(e.target.value) } })}
                  />
                )}
              </Field>
            ))}
          </div>
        </div>
      )}

      {(round.questions || []).map((q, qi) => (
        <QuestionEditor
          key={q.id}
          question={q}
          index={qi}
          onChange={(nq) => {
            const questions = [...round.questions];
            questions[qi] = nq;
            set({ questions });
          }}
          onDelete={() => set({ questions: round.questions.filter((_, j) => j !== qi) })}
        />
      ))}
      <button
        className="btn ghost"
        onClick={() => set({ questions: [...(round.questions || []), blankQuestion(round.type)] })}
      >
        ＋ Add question
      </button>
    </div>
  );
}

export default function QuizBuilder() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [saveState, setSaveState] = useState('saved'); // saved | dirty | saving
  const saveTimer = useRef(null);
  const pendingRef = useRef(null); // latest unsaved quiz, flushed on unmount

  useEffect(() => {
    getQuiz(quizId).then((q) => {
      if (!q) navigate('/host');
      else setQuiz(q);
    });
  }, [quizId, navigate]);

  useEffect(() => () => {
    clearTimeout(saveTimer.current);
    if (pendingRef.current) saveQuiz(quizId, pendingRef.current);
  }, [quizId]);

  // Debounced autosave: every edit persists ~800ms after the last keystroke.
  function edit(patch) {
    setQuiz((prev) => {
      const next = { ...prev, ...patch };
      pendingRef.current = next;
      setSaveState('dirty');
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaveState('saving');
        pendingRef.current = null;
        await saveQuiz(quizId, next);
        setSaveState('saved');
      }, 800);
      return next;
    });
  }

  if (!quiz) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <div className="row spread wrap">
        <button className="btn ghost" onClick={() => navigate('/host')}>← Back</button>
        <span className={`save-indicator ${saveState}`}>
          {saveState === 'saved' ? '✓ Saved' : saveState === 'saving' ? 'Saving…' : 'Unsaved changes…'}
        </span>
      </div>

      <div className="card">
        <Field label="Quiz title">
          <input className="title-input" value={quiz.title} onChange={(e) => edit({ title: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea rows={2} value={quiz.description} onChange={(e) => edit({ description: e.target.value })} />
        </Field>
      </div>

      {quiz.rounds.map((round, ri) => (
        <RoundEditor
          key={round.id}
          round={round}
          index={ri}
          total={quiz.rounds.length}
          onChange={(nr) => {
            const rounds = [...quiz.rounds];
            rounds[ri] = nr;
            edit({ rounds });
          }}
          onDelete={() => {
            if (quiz.rounds.length === 1) return window.alert('A quiz needs at least one round.');
            if (window.confirm(`Remove round ${ri + 1}?`)) edit({ rounds: quiz.rounds.filter((_, j) => j !== ri) });
          }}
          onMove={(dir) => {
            const rounds = [...quiz.rounds];
            const [moved] = rounds.splice(ri, 1);
            rounds.splice(ri + dir, 0, moved);
            edit({ rounds });
          }}
        />
      ))}

      <button className="btn primary" onClick={() => edit({ rounds: [...quiz.rounds, blankRound()] })}>
        ＋ Add round
      </button>
    </div>
  );
}
