import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  subscribeQuizzes, createQuiz, deleteQuiz, duplicateQuiz, setQuizArchived,
  createSession, getQuiz,
} from '../lib/db';
import { blankQuiz, normalizeQuiz } from '../lib/quizModel';
import { useAuthUid } from '../lib/hooks';
import { SAMPLE_QUIZZES } from '../data/sampleQuizzes';

function LaunchDialog({ quiz, onLaunch, onClose }) {
  const [mode, setMode] = useState('individual');
  const [busy, setBusy] = useState(false);
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="card dialog">
        <h2>Launch “{quiz.title}”</h2>
        <p className="muted">Choose how players compete.</p>
        <div className="answer-grid two">
          <button className={`btn option ${mode === 'individual' ? 'selected' : ''}`} onClick={() => setMode('individual')}>
            🧍 Individual
          </button>
          <button className={`btn option ${mode === 'team' ? 'selected' : ''}`} onClick={() => setMode('team')}>
            👥 Teams
          </button>
        </div>
        <div className="row gap mt">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await onLaunch(mode); } finally { setBusy(false); }
            }}
          >
            {busy ? 'Creating room…' : 'Create room'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HostDashboard() {
  const { uid, error: authError } = useAuthUid();
  const [quizzes, setQuizzes] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [launching, setLaunching] = useState(null); // {id, quiz}
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => subscribeQuizzes(setQuizzes), []);

  async function newQuiz() {
    const id = await createQuiz(blankQuiz(uid));
    navigate(`/host/quiz/${id}`);
  }

  async function importSamples() {
    setBusy(true);
    try {
      for (const sample of SAMPLE_QUIZZES) {
        await createQuiz({ ...sample, ownerUid: uid });
      }
    } finally {
      setBusy(false);
    }
  }

  async function launch(quizId, mode) {
    const quiz = await getQuiz(quizId);
    const code = await createSession(quizId, quiz, mode, uid);
    navigate(`/host/game/${code}`);
  }

  const entries = Object.entries(quizzes || {})
    .map(([id, q]) => [id, normalizeQuiz(q)])
    .filter(([, q]) => showArchived || !q.archived)
    .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));

  return (
    <div className="page">
      <div className="row spread">
        <h1>Your quizzes</h1>
        <div className="row gap">
          <button className="btn ghost" onClick={importSamples} disabled={busy || !uid}>
            {busy ? 'Importing…' : '⬇ Import sample quizzes'}
          </button>
          <button className="btn primary" onClick={newQuiz} disabled={!uid}>＋ New quiz</button>
        </div>
      </div>

      {authError && <p className="error">Auth error: {authError}. Enable Anonymous sign-in in Firebase (see docs/SETUP.md).</p>}

      <label className="row gap muted checkbox-row">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived
      </label>

      {quizzes === null && <p className="muted">Loading…</p>}
      {quizzes !== null && entries.length === 0 && (
        <div className="card center-text">
          <p>No quizzes yet. Create one, or import the samples to see how each round type works.</p>
        </div>
      )}

      <div className="quiz-grid">
        {entries.map(([id, quiz]) => {
          const questionCount = quiz.rounds.reduce((n, r) => n + (r.questions?.length || 0), 0);
          return (
            <div key={id} className={`card quiz-card ${quiz.archived ? 'archived' : ''}`}>
              <h3>{quiz.title} {quiz.archived && <span className="tag">archived</span>}</h3>
              {quiz.description && <p className="muted">{quiz.description}</p>}
              <p className="muted small-text">
                {quiz.rounds.length} round{quiz.rounds.length !== 1 && 's'} · {questionCount} question{questionCount !== 1 && 's'}
              </p>
              <div className="row gap wrap">
                <button className="btn primary" onClick={() => setLaunching({ id, quiz })}>▶ Launch</button>
                <button className="btn ghost" onClick={() => navigate(`/host/quiz/${id}`)}>Edit</button>
                <button className="btn ghost" onClick={() => duplicateQuiz(id)}>Duplicate</button>
                <button className="btn ghost" onClick={() => setQuizArchived(id, !quiz.archived)}>
                  {quiz.archived ? 'Unarchive' : 'Archive'}
                </button>
                <button
                  className="btn danger ghost"
                  onClick={() => {
                    if (window.confirm(`Delete "${quiz.title}" permanently?`)) deleteQuiz(id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {launching && (
        <LaunchDialog
          quiz={launching.quiz}
          onClose={() => setLaunching(null)}
          onLaunch={(mode) => launch(launching.id, mode)}
        />
      )}
    </div>
  );
}
