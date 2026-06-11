import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { joinSession, setupPresence, submitAnswer, submitWager, buzz } from '../lib/db';
import {
  useSession, usePlayerIdentity, useServerTimeOffset, useCountdown, serverNow,
} from '../lib/hooks';
import { uid as makeId, normalizeQuiz, roundIsDirected, roundUsesBuzzer } from '../lib/quizModel';
import AnswerInput from '../components/AnswerInput';
import Leaderboard from '../components/Leaderboard';
import Timer from '../components/Timer';
import QuestionMedia from '../components/QuestionMedia';

function JoinForm({ code, session, onJoined }) {
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  const teamMode = session.mode === 'team';
  const teams = Object.entries(session.teams || {});

  async function join(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const playerId = makeId('p');
    await joinSession(code, playerId, name.trim(), teamMode ? teamId || null : null);
    onJoined({ playerId, name: name.trim() });
  }

  return (
    <div className="page narrow center">
      <h1>Join game <span className="room-code inline">{code}</span></h1>
      <form className="card join-card" onSubmit={join}>
        <input
          placeholder="Your display name"
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {teamMode && teams.length > 0 && (
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">Pick a team (host can change it)</option>
            {teams.map(([id, t]) => <option key={id} value={id}>{t.name}</option>)}
          </select>
        )}
        <button className="btn primary big" type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Joining…' : "Let's play!"}
        </button>
      </form>
    </div>
  );
}

function WagerForm({ code, ri, qi, playerId, me, round, myAnswer }) {
  const [amount, setAmount] = useState('');
  const maxSetting = Number(round.settings?.maxWager) || 0;
  const max = maxSetting > 0 ? maxSetting : Math.max(0, Number(me.score) || 0);

  if (myAnswer?.wager !== undefined) {
    return (
      <div className="card center-text">
        <h2>Wager placed: {myAnswer.wager} pts</h2>
        <p className="muted">Waiting for the question…</p>
      </div>
    );
  }
  return (
    <div className="card center-text">
      <h2>💰 Place your wager</h2>
      <p className="muted">Win it if you're right. Lose it if you're wrong. Max: {max} pts.</p>
      <form
        className="answer-form"
        onSubmit={(e) => {
          e.preventDefault();
          const w = Math.min(max, Math.max(0, Number(amount) || 0));
          submitWager(code, ri, qi, playerId, w);
        }}
      >
        <input
          type="number" min={0} max={max} inputMode="numeric"
          value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Points to wager" autoFocus
        />
        <button className="btn primary" type="submit" disabled={amount === ''}>Lock it in</button>
      </form>
    </div>
  );
}

function BuzzerView({ code, session, ri, qi, playerId, question }) {
  const state = session.state;
  const buzzes = session.buzzes?.[ri]?.[qi] || {};
  const myBuzz = buzzes[playerId];
  const lockedOut = Boolean(state.lockedOut?.[playerId]);
  const lockedToOther = state.buzzLockedTo && state.buzzLockedTo !== playerId;
  const canBuzz = state.buzzerOpen && !myBuzz && !lockedOut && !state.buzzLockedTo;
  const iHaveTheFloor = state.buzzLockedTo === playerId;
  const name = session.players?.[playerId]?.name || 'Player';

  let label = 'BUZZ!';
  if (iHaveTheFloor) label = '🎤 You buzzed first — answer!';
  else if (lockedOut) label = 'Locked out for this question';
  else if (myBuzz) label = 'Buzzed — waiting…';
  else if (lockedToOther) label = `${buzzes[state.buzzLockedTo]?.name || 'Someone'} buzzed first`;
  else if (!state.buzzerOpen) label = 'Buzzer closed';

  return (
    <div className="center-text">
      <h2>{question.text}</h2>
      <QuestionMedia question={question} />
      <button
        className={`buzzer ${iHaveTheFloor ? 'mine' : ''}`}
        disabled={!canBuzz}
        onClick={() => buzz(code, ri, qi, playerId, name)}
      >
        {label}
      </button>
      <p className="muted">Answer out loud when the host calls on you.</p>
    </div>
  );
}

export default function PlayerGame() {
  const { code: rawCode } = useParams();
  const code = rawCode.toUpperCase();
  const session = useSession(code);
  const [identity, setIdentity] = usePlayerIdentity(code);
  const offset = useServerTimeOffset();

  const playerId = identity?.playerId;
  const me = playerId ? session?.players?.[playerId] : null;

  useEffect(() => {
    if (!playerId || !session) return undefined;
    return setupPresence(code, playerId);
  }, [code, playerId, Boolean(session)]);

  const state = session?.state;
  const remaining = useCountdown(state?.startedAt, state?.timeLimit, offset, state?.phase === 'open');

  if (session === undefined) return <div className="page"><p className="muted">Connecting…</p></div>;
  if (session === null) return <div className="page narrow"><p className="error">Game {code} not found. Check the room code.</p></div>;

  const normalized = { ...session, quiz: normalizeQuiz(session.quiz) };

  // No identity yet, or host kicked us: show the join form (late joins welcome).
  if (!playerId || (!me && session.status !== 'ended')) {
    return <JoinForm code={code} session={normalized} onJoined={setIdentity} />;
  }

  const ri = state.roundIndex;
  const qi = state.questionIndex;
  const round = normalized.quiz.rounds[ri];
  const question = round?.questions?.[qi];
  const myAnswer = session.answers?.[ri]?.[qi]?.[playerId];
  const phase = state.phase;

  const directedToMe =
    !state.directedTo ||
    (state.directedTo.kind === 'player'
      ? state.directedTo.id === playerId
      : state.directedTo.id === me?.teamId);

  function answer(value) {
    const timeMs = state.startedAt ? Math.max(0, serverNow(offset) - state.startedAt) : null;
    submitAnswer(code, ri, qi, playerId, value, timeMs);
  }

  let body;
  if (session.status === 'ended' || phase === 'gameEnd') {
    body = (
      <>
        <Leaderboard session={normalized} title="🏆 Final standings"
          highlightId={session.mode === 'team' ? me?.teamId : playerId} />
        <p className="center-text muted">Thanks for playing!</p>
      </>
    );
  } else if (session.status === 'lobby') {
    body = (
      <div className="card center-text">
        <h2>You're in, {me?.name}! 🎉</h2>
        <p className="muted">Waiting for the host to start…</p>
        <p>{Object.keys(session.players || {}).length} player(s) in the lobby</p>
        {session.mode === 'team' && (
          <p className="muted">
            Team: {me?.teamId ? normalized.teams?.[me.teamId]?.name || '—' : 'not assigned yet'}
          </p>
        )}
      </div>
    );
  } else if (state.paused) {
    body = (
      <div className="card center-text">
        <h2>⏸ Game paused</h2>
        <p className="muted">The host will resume shortly.</p>
      </div>
    );
  } else if (phase === 'roundEnd') {
    body = (
      <Leaderboard session={normalized} title={`Standings after Round ${ri + 1}`}
        highlightId={session.mode === 'team' ? me?.teamId : playerId} />
    );
  } else if (phase === 'idle' || !question) {
    body = (
      <div className="card center-text">
        <h2>{round?.name || `Round ${ri + 1}`}</h2>
        {round?.category && <p className="tag">{round.category}</p>}
        {round?.description && <p className="muted">{round.description}</p>}
        <p>Get ready for question {qi + 1}…</p>
      </div>
    );
  } else if (phase === 'wager') {
    body = <WagerForm code={code} ri={ri} qi={qi} playerId={playerId} me={me} round={round} myAnswer={myAnswer} />;
  } else if (phase === 'open' && roundUsesBuzzer(round)) {
    body = <BuzzerView code={code} session={normalized} ri={ri} qi={qi} playerId={playerId} question={question} />;
  } else if (phase === 'open') {
    const submitted = myAnswer?.value !== undefined;
    body = (
      <div>
        <Timer remaining={remaining} total={state.timeLimit} />
        <div className="card question-card center-text">
          <h2>{question.text}</h2>
          <QuestionMedia question={question} />
        </div>
        {roundIsDirected(round) && !directedToMe ? (
          <div className="card center-text">
            <p>🎯 This one's for <strong>{state.directedTo?.name}</strong> — sit tight!</p>
          </div>
        ) : submitted ? (
          <div className="card center-text">
            <h3>✓ Answer in: {String(
              question.type === 'multiple_choice'
                ? question.options?.[myAnswer.value] ?? myAnswer.value
                : myAnswer.value,
            )}</h3>
            <p className="muted">Waiting for everyone else…</p>
          </div>
        ) : (
          <AnswerInput question={question} onSubmit={answer} disabled={false} />
        )}
      </div>
    );
  } else if (phase === 'locked') {
    body = (
      <div className="card center-text">
        <h2>🔒 Answers are in</h2>
        <p className="muted">Waiting for the reveal…</p>
      </div>
    );
  } else if (phase === 'revealed') {
    const final = myAnswer?.final;
    const correctText =
      question.type === 'multiple_choice'
        ? question.options?.[question.correctAnswer]
        : String(question.correctAnswer).split('|')[0];
    body = (
      <div className="card center-text">
        <h2>{correctText ? `The answer: ${correctText}` : 'Time for the answer!'}</h2>
        {myAnswer ? (
          <p className={final?.correct ? 'result-good' : 'result-bad'}>
            {final?.correct ? '✓ Correct!' : '✗ Not this time'}
            {final && <strong> {final.score >= 0 ? '+' : ''}{final.score} pts</strong>}
          </p>
        ) : (
          <p className="muted">
            {roundUsesBuzzer(round) || question.type === 'verbal' ? '' : 'No answer submitted'}
          </p>
        )}
        <p>Your score: <strong>{me?.score || 0}</strong></p>
      </div>
    );
  }

  return (
    <div className="page narrow player-page">
      <div className="row spread muted small-text">
        <span>{me?.name}{session.mode === 'team' && me?.teamId ? ` · ${normalized.teams?.[me.teamId]?.name || ''}` : ''}</span>
        <span>Score: <strong>{me?.score || 0}</strong> · Room {code}</span>
      </div>
      {body}
    </div>
  );
}
