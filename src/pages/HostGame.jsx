import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  startGame, startQuestion, openWageredQuestion, closeQuestion, revealAnswer,
  goToQuestion, showRoundEnd, showGameEnd, endGame, setPaused, adjustScore,
  overrideAnswerScore, directQuestionTo, passQuestion, setBuzzerOpen, resetBuzzer,
  setBuzzLock, judgeBuzz, createTeam, deleteTeam, assignPlayerTeam, removePlayer,
} from '../lib/db';
import { useSession, useAuthUid, useServerTimeOffset, useCountdown } from '../lib/hooks';
import { autoCorrect } from '../lib/scoring';
import { normalizeQuiz, roundIsDirected, roundUsesBuzzer, roundUsesWager, TEAM_COLORS } from '../lib/quizModel';
import Leaderboard from '../components/Leaderboard';
import Timer from '../components/Timer';
import QuestionMedia from '../components/QuestionMedia';

function joinUrl(code) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/play/${code}`;
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn ghost small"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}

function TargetPicker({ session, onPick, onClose, title }) {
  const teamMode = session.mode === 'team';
  const options = teamMode
    ? Object.entries(session.teams || {}).map(([id, t]) => ({ kind: 'team', id, name: t.name }))
    : Object.entries(session.players || {}).map(([id, p]) => ({ kind: 'player', id, name: p.name }));
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="card dialog">
        <h2>{title}</h2>
        <div className="stack">
          {options.map((o) => (
            <button key={o.id} className="btn option" onClick={() => onPick(o)}>{o.name}</button>
          ))}
          {options.length === 0 && <p className="muted">Nobody to choose from yet.</p>}
        </div>
        <button className="btn ghost mt" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function Lobby({ code, session }) {
  const teamMode = session.mode === 'team';
  const [teamName, setTeamName] = useState('');
  const players = Object.entries(session.players || {});

  return (
    <div className="page">
      <div className="card center-text">
        <p className="muted">Players join at</p>
        <p className="join-link">{joinUrl(code)}</p>
        <p className="room-code">{code}</p>
        <div className="row gap center">
          <CopyButton text={joinUrl(code)} label="Copy join link" />
          <CopyButton text={code} label="Copy code" />
        </div>
      </div>

      {teamMode && (
        <div className="card">
          <h2>Teams</h2>
          <form
            className="row gap"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!teamName.trim()) return;
              const used = Object.keys(session.teams || {}).length;
              await createTeam(code, teamName.trim(), TEAM_COLORS[used % TEAM_COLORS.length]);
              setTeamName('');
            }}
          >
            <input className="grow" placeholder="New team name…" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            <button className="btn primary" type="submit">Add team</button>
          </form>
          <div className="row gap wrap mt">
            {Object.entries(session.teams || {}).map(([id, t]) => (
              <span key={id} className="tag" style={{ borderColor: t.color }}>
                <span className="team-dot" style={{ background: t.color }} />{t.name}
                <button className="btn ghost small" onClick={() => deleteTeam(code, id, session.players)}>✕</button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Players ({players.length})</h2>
        {players.length === 0 && <p className="muted">Waiting for players to join…</p>}
        <ul className="player-list">
          {players.map(([pid, p]) => (
            <li key={pid} className="row gap spread">
              <span>
                <span className={`presence ${p.connected ? 'on' : 'off'}`} />
                {p.name}
              </span>
              <span className="row gap">
                {teamMode && (
                  <select
                    value={p.teamId || ''}
                    onChange={(e) => assignPlayerTeam(code, pid, e.target.value || null)}
                  >
                    <option value="">— no team —</option>
                    {Object.entries(session.teams || {}).map(([tid, t]) => (
                      <option key={tid} value={tid}>{t.name}</option>
                    ))}
                  </select>
                )}
                <button className="btn danger ghost small" onClick={() => removePlayer(code, pid)}>Kick</button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button
        className="btn primary big"
        disabled={players.length === 0}
        onClick={() => startGame(code)}
      >
        ▶ Start game
      </button>
    </div>
  );
}

function answerDisplay(question, value) {
  if (value === undefined || value === null) return '—';
  if (question.type === 'multiple_choice') {
    return `${String.fromCharCode(65 + Number(value))}. ${question.options?.[value] ?? ''}`;
  }
  return String(value);
}

function correctAnswerDisplay(question) {
  if (question.type === 'multiple_choice') return answerDisplay(question, question.correctAnswer);
  if (question.type === 'free_text' || question.type === 'image') {
    return String(question.correctAnswer).split('|').join(' / ');
  }
  return String(question.correctAnswer);
}

function AnswersTable({ code, session, round, question, ri, qi, hideAnswers }) {
  const answers = session.answers?.[ri]?.[qi] || {};
  const players = session.players || {};
  const revealed = session.state.phase === 'revealed';
  const [custom, setCustom] = useState({});

  const rows = Object.entries(answers).sort(
    (a, b) => (a[1].submittedAt || 0) - (b[1].submittedAt || 0),
  );

  return (
    <div className="card">
      <h3>Responses ({rows.length}/{Object.keys(players).length})</h3>
      <table className="answers-table">
        <thead>
          <tr>
            <th>Player</th><th>Answer</th>
            {roundUsesWager(round) && <th className="num">Wager</th>}
            <th className="num">Time</th><th>Auto</th><th className="num">Score</th><th>Override</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([pid, a]) => {
            const auto = a.value !== undefined ? autoCorrect(question, a.value) : null;
            const finalScore = a.final ? a.final.score : null;
            const fullPoints = roundUsesWager(round)
              ? Math.max(0, Number(a.wager) || 0)
              : Number(question.points) || 0;
            const wrongScore = roundUsesWager(round)
              ? -fullPoints
              : -Math.max(0, Number(question.negativePoints) || 0);
            return (
              <tr key={pid}>
                <td>{players[pid]?.name || '?'}</td>
                <td className="answer-value">{answerDisplay(question, a.value)}</td>
                {roundUsesWager(round) && <td className="num">{a.wager ?? '—'}</td>}
                <td className="num">{a.timeMs != null ? `${(a.timeMs / 1000).toFixed(1)}s` : '—'}</td>
                <td>{hideAnswers ? '🤫' : auto === true ? '✓' : auto === false ? '✗' : '—'}</td>
                <td className="num">{finalScore != null ? finalScore : revealed ? 0 : '…'}</td>
                <td className="row gap">
                  <button
                    className="btn ghost small"
                    title="Mark correct (full points)"
                    onClick={() => overrideAnswerScore(code, ri, qi, pid, fullPoints, true)}
                  >
                    ✓
                  </button>
                  <button
                    className="btn ghost small"
                    title="Mark wrong"
                    onClick={() => overrideAnswerScore(code, ri, qi, pid, wrongScore, false)}
                  >
                    ✗
                  </button>
                  <input
                    className="score-input"
                    type="number"
                    placeholder="pts"
                    value={custom[pid] ?? ''}
                    onChange={(e) => setCustom({ ...custom, [pid]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && custom[pid] !== '') {
                        overrideAnswerScore(code, ri, qi, pid, Number(custom[pid]), Number(custom[pid]) > 0);
                        setCustom({ ...custom, [pid]: '' });
                      }
                    }}
                  />
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={7} className="muted">No responses yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function BuzzerPanel({ code, session, ri, qi }) {
  const buzzes = session.buzzes?.[ri]?.[qi] || {};
  const state = session.state;
  const ordered = Object.entries(buzzes).sort(
    (a, b) => (a[1].at || 0) - (b[1].at || 0) || a[0].localeCompare(b[0]),
  );
  const round = session.quiz.rounds[ri];
  const lockOnBuzz = round.settings?.lockOnBuzz !== false;
  // The player currently holding the floor: the locked player, or the earliest
  // buzzer who hasn't been locked out after a wrong answer.
  const eligible = ordered.find(([pid]) => !state.lockedOut?.[pid]);
  const activePid = state.buzzLockedTo || eligible?.[0] || null;

  // Auto-lock other players the moment an eligible buzz lands.
  useEffect(() => {
    if (lockOnBuzz && eligible && !state.buzzLockedTo) {
      setBuzzLock(code, eligible[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible?.[0], state.buzzLockedTo]);

  const first = ordered[0];
  return (
    <div className="card buzzer-panel">
      <div className="row spread wrap">
        <h3>🔔 Buzzer {state.buzzerOpen ? <span className="tag live">OPEN</span> : <span className="tag">closed</span>}</h3>
        <div className="row gap">
          <button className="btn ghost small" onClick={() => setBuzzerOpen(code, !state.buzzerOpen)}>
            {state.buzzerOpen ? 'Close buzzer' : 'Open buzzer'}
          </button>
          <button className="btn ghost small" onClick={() => resetBuzzer(code, ri, qi)}>Reset</button>
        </div>
      </div>
      <ol className="buzz-list">
        {ordered.map(([pid, b], i) => (
          <li key={pid} className={pid === state.buzzLockedTo ? 'highlight' : ''}>
            <span>
              <strong>{b.name}</strong>
              {i > 0 && first && <span className="muted"> +{((b.at - first[1].at) / 1000).toFixed(2)}s</span>}
              {state.lockedOut?.[pid] && <span className="tag"> locked out</span>}
            </span>
            {pid === activePid && !state.lockedOut?.[pid] && (
              <span className="row gap">
                <button className="btn primary small" onClick={() => judgeBuzz(code, session, pid, true)}>✓ Correct</button>
                <button className="btn danger small" onClick={() => judgeBuzz(code, session, pid, false)}>✗ Wrong</button>
              </span>
            )}
          </li>
        ))}
        {ordered.length === 0 && <p className="muted">Nobody has buzzed yet.</p>}
      </ol>
    </div>
  );
}

// Live tracker for verbal questions: the host listens to spoken answers and
// marks each player right (+points) or wrong (−negative points) with one tap.
function JudgePanel({ code, session, question, ri, qi }) {
  const points = Number(question.points) || 0;
  const penalty = Math.max(0, Number(question.negativePoints) || 0);
  const directedTo = session.state.directedTo;
  const players = Object.entries(session.players || {}).sort((a, b) =>
    (a[1].name || '').localeCompare(b[1].name || ''),
  );
  const [marked, setMarked] = useState({}); // local note of who you've judged

  function isTarget(pid, p) {
    if (!directedTo) return false;
    return directedTo.kind === 'player' ? directedTo.id === pid : directedTo.id === p.teamId;
  }

  return (
    <div className="card">
      <h3>🎤 Verbal answer tracker</h3>
      <p className="muted small-text">
        Mark who got it right: ✓ awards {points} pts{penalty > 0 ? `, ✗ deducts ${penalty} pts` : ''}.
      </p>
      <ul className="player-list">
        {players.map(([pid, p]) => (
          <li key={pid} className={`row gap spread ${isTarget(pid, p) ? 'judge-target' : ''}`}>
            <span>
              {isTarget(pid, p) && '🎯 '}
              {p.name} <strong className="num">{p.score || 0}</strong>
              {marked[pid] && <span className={marked[pid] === '✓' ? 'result-good' : 'result-bad'}> {marked[pid]}</span>}
            </span>
            <span className="row gap">
              <button
                className="btn primary small"
                onClick={() => {
                  adjustScore(code, pid, points, `verbal correct R${ri + 1}Q${qi + 1}`);
                  setMarked({ ...marked, [pid]: '✓' });
                }}
              >
                ✓ +{points}
              </button>
              <button
                className="btn danger ghost small"
                onClick={() => {
                  if (penalty > 0) adjustScore(code, pid, -penalty, `verbal wrong R${ri + 1}Q${qi + 1}`);
                  setMarked({ ...marked, [pid]: '✗' });
                }}
              >
                ✗ {penalty > 0 ? `−${penalty}` : 'wrong'}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoreAdjuster({ code, session }) {
  const players = Object.entries(session.players || {});
  const [amounts, setAmounts] = useState({});
  return (
    <details className="card">
      <summary>⚖ Adjust scores / bonus / penalty</summary>
      <ul className="player-list">
        {players.map(([pid, p]) => (
          <li key={pid} className="row gap spread">
            <span>{p.name} <strong className="num">{p.score || 0}</strong></span>
            <span className="row gap">
              <input
                className="score-input"
                type="number"
                placeholder="pts"
                value={amounts[pid] ?? ''}
                onChange={(e) => setAmounts({ ...amounts, [pid]: e.target.value })}
              />
              <button
                className="btn ghost small"
                onClick={() => { adjustScore(code, pid, Math.abs(Number(amounts[pid]) || 0), 'bonus'); }}
              >
                ＋ Bonus
              </button>
              <button
                className="btn ghost small"
                onClick={() => { adjustScore(code, pid, -Math.abs(Number(amounts[pid]) || 0), 'penalty'); }}
              >
                － Penalty
              </button>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ActiveGame({ code, session }) {
  const state = session.state;
  const quiz = session.quiz;
  const ri = state.roundIndex;
  const qi = state.questionIndex;
  const round = quiz.rounds[ri];
  const question = round?.questions?.[qi];
  const offset = useServerTimeOffset();
  const remaining = useCountdown(state.startedAt, state.timeLimit, offset, state.phase === 'open');
  const [picking, setPicking] = useState(null); // 'direct' | 'pass'
  const autoActedRef = useRef(null);
  // Presenter mode: the host is screen-sharing this page with the audience, so
  // hide the correct answer until "Show answer to audience" is pressed.
  const [presenter, setPresenter] = useState(() => localStorage.getItem('quiznight_presenter') === '1');
  function togglePresenter() {
    const next = !presenter;
    setPresenter(next);
    localStorage.setItem('quiznight_presenter', next ? '1' : '0');
  }

  const phase = state.phase;
  const isLastQuestion = qi >= (round?.questions?.length || 0) - 1;
  const isLastRound = ri >= quiz.rounds.length - 1;
  const directed = roundIsDirected(round);
  const answers = session.answers?.[ri]?.[qi] || {};
  const hideAnswers = presenter && phase !== 'revealed';

  // Host client is the game authority: close the question when time expires,
  // and auto-resolve open-challenge questions on the first correct answer.
  useEffect(() => {
    if (phase !== 'open' || state.paused) return;
    const key = `${ri}:${qi}`;
    if (remaining === 0 && state.timeLimit > 0 && autoActedRef.current !== key) {
      autoActedRef.current = key;
      closeQuestion(code);
    }
  }, [remaining, phase, state.paused, state.timeLimit, ri, qi, code]);

  useEffect(() => {
    if (phase !== 'open' || round?.type !== 'open_challenge') return;
    const anyCorrect = Object.values(answers).some((a) => autoCorrect(question, a.value) === true);
    const key = `oc${ri}:${qi}`;
    if (anyCorrect && autoActedRef.current !== key) {
      autoActedRef.current = key;
      revealAnswer(code, session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, JSON.stringify(answers)]);

  function nextStep() {
    if (!isLastQuestion) goToQuestion(code, ri, qi + 1);
    else showRoundEnd(code);
  }

  if (phase === 'gameEnd') {
    return (
      <div className="page narrow">
        <Leaderboard session={session} title="🏆 Final standings" />
        {session.status !== 'ended' ? (
          <button className="btn primary big" onClick={() => endGame(code)}>End game for everyone</button>
        ) : (
          <Link className="btn ghost" to="/host">← Back to dashboard</Link>
        )}
      </div>
    );
  }

  if (phase === 'roundEnd') {
    return (
      <div className="page narrow">
        <Leaderboard session={session} title={`Standings after Round ${ri + 1}: ${round.name || ''}`} />
        <ScoreAdjuster code={code} session={session} />
        <button
          className="btn primary big"
          onClick={() => (isLastRound ? showGameEnd(code) : goToQuestion(code, ri + 1, 0))}
        >
          {isLastRound ? '🏆 Show final results' : `▶ Start Round ${ri + 2}: ${quiz.rounds[ri + 1].name || ''}`}
        </button>
      </div>
    );
  }

  if (!question) {
    return <div className="page"><p className="error">This round has no questions. </p>
      <button className="btn primary" onClick={() => showRoundEnd(code)}>Skip to round end</button></div>;
  }

  return (
    <div className="page">
      <div className="row spread wrap host-header">
        <div>
          <span className="tag">{round.name || `Round ${ri + 1}`} · {round.category || round.type}</span>
          <span className="tag">Q {qi + 1}/{round.questions.length}</span>
          <span className={`tag phase-${phase}`}>{phase}</span>
          {state.paused && <span className="tag live">⏸ PAUSED</span>}
        </div>
        <div className="row gap">
          <button
            className={`btn small ${presenter ? 'primary' : 'ghost'}`}
            title="Hides correct answers until you reveal them — turn on when screen-sharing"
            onClick={togglePresenter}
          >
            🖥 Presenter {presenter ? 'ON' : 'off'}
          </button>
          <button className="btn ghost small" onClick={() => setPaused(code, !state.paused)}>
            {state.paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            className="btn danger ghost small"
            onClick={() => { if (window.confirm('End the game for everyone?')) endGame(code); }}
          >
            ■ End game
          </button>
        </div>
      </div>

      <div className="card question-card">
        <h2>{question.text || '(no question text)'}</h2>
        <QuestionMedia question={question} />
        {question.type === 'multiple_choice' && (
          <ol className="host-options" type="A">
            {(question.options || []).map((o, i) => (
              <li key={i} className={!hideAnswers && Number(question.correctAnswer) === i ? 'correct' : ''}>{o}</li>
            ))}
          </ol>
        )}
        {phase === 'revealed' && presenter && (
          <div className="reveal-banner">
            ✓ {correctAnswerDisplay(question) || 'Answered live!'}
          </div>
        )}
        {hideAnswers ? (
          <p>
            <strong>{question.points} pts</strong>
            {Number(question.negativePoints) > 0 && <> · −{question.negativePoints} if wrong</>}
            {question.timeLimit > 0 && <> · ⏱ {question.timeLimit}s</>}
            {' · '}
            <details className="peek">
              <summary>🤫 Peek answer (the audience will see it too!)</summary>
              <span>{correctAnswerDisplay(question)}</span>
            </details>
          </p>
        ) : (
          <p>
            <strong>Answer:</strong> {correctAnswerDisplay(question) || '(host judges live)'} ·{' '}
            <strong>{question.points} pts</strong>
            {Number(question.negativePoints) > 0 && <> · −{question.negativePoints} if wrong</>}
            {question.timeLimit > 0 && <> · ⏱ {question.timeLimit}s</>}
          </p>
        )}
        {state.directedTo && (
          <p className="tag live">→ Directed to: {state.directedTo.name}
            {round.type === 'passing' && ` (passes used: ${state.passesUsed || 0}/${round.settings?.maxPasses ?? '∞'})`}
          </p>
        )}
        {phase === 'open' && <Timer remaining={remaining} total={state.timeLimit} />}
      </div>

      <div className="row gap wrap controls">
        {phase === 'idle' && (
          <>
            {directed && (
              <button className="btn ghost" onClick={() => setPicking('direct')}>
                🎯 {state.directedTo ? `Directed to ${state.directedTo.name} — change` : 'Direct question to…'}
              </button>
            )}
            <button
              className="btn primary big"
              disabled={directed && !state.directedTo}
              onClick={() => startQuestion(code, round, question)}
            >
              ▶ Start question
            </button>
            <button className="btn ghost" onClick={nextStep}>⏭ Skip</button>
          </>
        )}
        {phase === 'wager' && (
          <button className="btn primary big" onClick={() => openWageredQuestion(code, question)}>
            👁 Wagers in — show question
          </button>
        )}
        {phase === 'open' && (
          <>
            {question.type === 'verbal' ? (
              <button className="btn primary big" onClick={() => revealAnswer(code, session)}>
                👁 Show answer to audience
              </button>
            ) : (
              <>
                <button className="btn primary" onClick={() => closeQuestion(code)}>🔒 Close answers</button>
                <button className="btn ghost" onClick={() => revealAnswer(code, session)}>👁 Show answer now</button>
              </>
            )}
            {round.type === 'passing' && (
              <button className="btn ghost" onClick={() => setPicking('pass')}
                disabled={(state.passesUsed || 0) >= (round.settings?.maxPasses ?? Infinity)}>
                ↪ Pass question
              </button>
            )}
          </>
        )}
        {phase === 'locked' && (
          <button className="btn primary big" onClick={() => revealAnswer(code, session)}>
            👁 Show answer to audience
          </button>
        )}
        {phase === 'revealed' && (
          <button className="btn primary big" onClick={nextStep}>
            {isLastQuestion ? '🏁 End round' : '⏭ Next question'}
          </button>
        )}
      </div>

      {roundUsesBuzzer(round) && phase !== 'idle' && (
        <BuzzerPanel code={code} session={session} ri={ri} qi={qi} />
      )}

      {phase === 'wager' && (
        <div className="card">
          <h3>Wagers ({Object.values(answers).filter((a) => a.wager !== undefined).length}/{Object.keys(session.players || {}).length})</h3>
          <ul className="player-list">
            {Object.entries(answers).map(([pid, a]) => (
              <li key={pid}>{session.players?.[pid]?.name}: <strong>{a.wager ?? '…'}</strong></li>
            ))}
          </ul>
        </div>
      )}

      {question.type === 'verbal' && phase !== 'idle' && phase !== 'wager' && (
        <JudgePanel key={`judge-${ri}-${qi}`} code={code} session={session} question={question} ri={ri} qi={qi} />
      )}

      {question.type !== 'verbal' && phase !== 'idle' && phase !== 'wager' && (
        <AnswersTable
          code={code} session={session} round={round} question={question}
          ri={ri} qi={qi} hideAnswers={hideAnswers}
        />
      )}

      <ScoreAdjuster code={code} session={session} />
      <Leaderboard session={session} title="Live standings" />

      {picking && (
        <TargetPicker
          session={session}
          title={picking === 'pass' ? 'Pass question to…' : 'Direct question to…'}
          onClose={() => setPicking(null)}
          onPick={(target) => {
            if (picking === 'pass') passQuestion(code, target);
            else directQuestionTo(code, target);
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

export default function HostGame() {
  const { code } = useParams();
  const session = useSession(code);
  const { uid } = useAuthUid();

  if (session === undefined) return <div className="page"><p className="muted">Loading…</p></div>;
  if (session === null) {
    return (
      <div className="page narrow">
        <p className="error">Game {code} not found.</p>
        <Link className="btn ghost" to="/host">← Back to dashboard</Link>
      </div>
    );
  }

  const normalized = { ...session, quiz: normalizeQuiz(session.quiz) };

  return (
    <div>
      <div className="row center muted small-text">
        Hosting <strong>&nbsp;{normalized.quiz.title}&nbsp;</strong> · room <strong>&nbsp;{code}&nbsp;</strong>
        {uid && session.hostUid && uid !== session.hostUid && ' · ⚠ you are not the original host'}
      </div>
      {session.status === 'lobby'
        ? <Lobby code={code} session={normalized} />
        : <ActiveGame code={code} session={normalized} />}
    </div>
  );
}
