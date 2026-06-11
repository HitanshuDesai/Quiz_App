import {
  ref, get, set, update, remove, push, onValue,
  runTransaction, serverTimestamp, onDisconnect,
} from 'firebase/database';
import { db } from './firebase';
import { normalizeQuiz, uid, roundUsesWager } from './quizModel';
import { scoreQuestion } from './scoring';

// ---------------------------------------------------------------------------
// Quiz CRUD
// ---------------------------------------------------------------------------

export function subscribeQuizzes(cb) {
  return onValue(ref(db, 'quizzes'), (snap) => cb(snap.val() || {}));
}

export async function getQuiz(quizId) {
  const snap = await get(ref(db, `quizzes/${quizId}`));
  return normalizeQuiz(snap.val());
}

export async function createQuiz(quiz) {
  const r = push(ref(db, 'quizzes'));
  await set(r, { ...quiz, createdAt: Date.now(), updatedAt: Date.now() });
  return r.key;
}

export async function saveQuiz(quizId, quiz) {
  await set(ref(db, `quizzes/${quizId}`), { ...quiz, updatedAt: Date.now() });
}

export async function deleteQuiz(quizId) {
  await remove(ref(db, `quizzes/${quizId}`));
}

export async function duplicateQuiz(quizId) {
  const quiz = await getQuiz(quizId);
  if (!quiz) throw new Error('Quiz not found');
  return createQuiz({ ...quiz, title: `${quiz.title} (copy)`, archived: false });
}

export async function setQuizArchived(quizId, archived) {
  await update(ref(db, `quizzes/${quizId}`), { archived, updatedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion

function randomCode(len = 4) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

export async function createSession(quizId, quiz, mode, hostUid) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const r = ref(db, `sessions/${code}`);
    const existing = await get(r);
    if (existing.exists()) continue;
    await set(r, {
      quizId,
      quiz, // frozen snapshot — editing the quiz later won't affect this game
      hostUid,
      mode,
      status: 'lobby',
      createdAt: Date.now(),
      state: { roundIndex: 0, questionIndex: 0, phase: 'idle', paused: false },
    });
    return code;
  }
  throw new Error('Could not allocate a room code, try again');
}

export function subscribeSession(code, cb) {
  return onValue(ref(db, `sessions/${code}`), (snap) => cb(snap.val()));
}

export async function sessionExists(code) {
  const snap = await get(ref(db, `sessions/${code}/status`));
  return snap.exists();
}

export function subscribeServerTimeOffset(cb) {
  return onValue(ref(db, '.info/serverTimeOffset'), (snap) => cb(snap.val() || 0));
}

// ---------------------------------------------------------------------------
// Players (join / presence / teams)
// ---------------------------------------------------------------------------

export async function joinSession(code, playerId, name, teamId) {
  const r = ref(db, `sessions/${code}/players/${playerId}`);
  await runTransaction(r, (current) => ({
    score: 0,
    joinedAt: Date.now(),
    ...(current || {}),
    name,
    teamId: teamId ?? current?.teamId ?? null,
    connected: true,
  }));
}

export function setupPresence(code, playerId) {
  const connRef = ref(db, '.info/connected');
  const meRef = ref(db, `sessions/${code}/players/${playerId}/connected`);
  return onValue(connRef, (snap) => {
    if (snap.val() === true) {
      onDisconnect(meRef).set(false);
      set(meRef, true);
    }
  });
}

export async function removePlayer(code, playerId) {
  await remove(ref(db, `sessions/${code}/players/${playerId}`));
}

export async function createTeam(code, name, color) {
  const r = push(ref(db, `sessions/${code}/teams`));
  await set(r, { name, color });
  return r.key;
}

export async function deleteTeam(code, teamId, players) {
  const updates = { [`teams/${teamId}`]: null };
  for (const [pid, p] of Object.entries(players || {})) {
    if (p.teamId === teamId) updates[`players/${pid}/teamId`] = null;
  }
  await update(ref(db, `sessions/${code}`), updates);
}

export async function assignPlayerTeam(code, playerId, teamId) {
  await set(ref(db, `sessions/${code}/players/${playerId}/teamId`), teamId);
}

// ---------------------------------------------------------------------------
// Host: game flow
// ---------------------------------------------------------------------------

export async function startGame(code) {
  await update(ref(db, `sessions/${code}`), {
    status: 'active',
    state: { roundIndex: 0, questionIndex: 0, phase: 'idle', paused: false },
  });
}

// Opens the question at the current state pointer.
export async function startQuestion(code, round, question) {
  const phase = roundUsesWager(round) ? 'wager' : 'open';
  await update(ref(db, `sessions/${code}/state`), {
    phase,
    startedAt: serverTimestamp(),
    timeLimit: Number(question.timeLimit) || 0,
    buzzerOpen: round.type === 'buzzer',
    buzzLockedTo: null,
    lockedOut: null,
    attempts: null,
    passesUsed: 0,
  });
}

// Wager round: wagers are in, now show the actual question.
export async function openWageredQuestion(code, question) {
  await update(ref(db, `sessions/${code}/state`), {
    phase: 'open',
    startedAt: serverTimestamp(),
    timeLimit: Number(question.timeLimit) || 0,
  });
}

export async function closeQuestion(code) {
  await update(ref(db, `sessions/${code}/state`), { phase: 'locked', buzzerOpen: false });
}

// Computes final scores for every answer, applies unapplied deltas to player
// totals, then flips phase to 'revealed'. Host-side overrides made before the
// reveal (answer.overridden) are preserved.
export async function revealAnswer(code, session) {
  const { roundIndex: ri, questionIndex: qi } = session.state;
  const round = session.quiz.rounds[ri];
  const question = round.questions[qi];
  const answers = session.answers?.[ri]?.[qi] || {};
  const computed = scoreQuestion(round, question, answers);

  const updates = { 'state/phase': 'revealed', 'state/buzzerOpen': false };
  for (const [pid, a] of Object.entries(answers)) {
    const final = a.overridden && a.final ? a.final : (computed[pid] || { correct: false, score: 0 });
    updates[`answers/${ri}/${qi}/${pid}/final`] = final;
    updates[`answers/${ri}/${qi}/${pid}/applied`] = true;
    if (!a.applied && final.score !== 0) {
      await runTransaction(ref(db, `sessions/${code}/players/${pid}/score`),
        (s) => (Number(s) || 0) + final.score);
    }
  }
  await update(ref(db, `sessions/${code}`), updates);
}

// Move the pointer without starting (host sees a preview, then starts).
export async function goToQuestion(code, roundIndex, questionIndex) {
  await update(ref(db, `sessions/${code}/state`), {
    roundIndex,
    questionIndex,
    phase: 'idle',
    buzzerOpen: false,
    buzzLockedTo: null,
    lockedOut: null,
    directedTo: null,
  });
}

export async function showRoundEnd(code) {
  await update(ref(db, `sessions/${code}/state`), { phase: 'roundEnd', buzzerOpen: false });
}

export async function showGameEnd(code) {
  await update(ref(db, `sessions/${code}`), { 'state/phase': 'gameEnd', 'state/buzzerOpen': false });
}

export async function endGame(code) {
  await update(ref(db, `sessions/${code}`), { status: 'ended', 'state/phase': 'gameEnd' });
}

export async function setPaused(code, paused) {
  await set(ref(db, `sessions/${code}/state/paused`), paused);
}

// ---------------------------------------------------------------------------
// Host: scoring controls
// ---------------------------------------------------------------------------

export async function adjustScore(code, playerId, delta, reason) {
  await runTransaction(ref(db, `sessions/${code}/players/${playerId}/score`),
    (s) => (Number(s) || 0) + delta);
  await set(push(ref(db, `sessions/${code}/log`)), {
    at: Date.now(), playerId, delta, reason: reason || 'manual adjustment',
  });
}

// Override one player's result for the current question (pre- or post-reveal).
export async function overrideAnswerScore(code, ri, qi, playerId, score, correct) {
  const aRef = ref(db, `sessions/${code}/answers/${ri}/${qi}/${playerId}`);
  const snap = await get(aRef);
  const a = snap.val();
  if (!a) return;
  const prevApplied = a.applied ? Number(a.final?.score) || 0 : 0;
  const delta = score - prevApplied;
  await update(aRef, { final: { score, correct }, overridden: true, applied: a.applied || false });
  if (a.applied && delta !== 0) {
    await runTransaction(ref(db, `sessions/${code}/players/${playerId}/score`),
      (s) => (Number(s) || 0) + delta);
    await set(push(ref(db, `sessions/${code}/log`)), {
      at: Date.now(), playerId, delta, reason: `score override R${ri + 1}Q${qi + 1}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Directed / passing rounds
// ---------------------------------------------------------------------------

export async function directQuestionTo(code, target) {
  await set(ref(db, `sessions/${code}/state/directedTo`), target); // {kind,id,name} | null
}

export async function passQuestion(code, target) {
  await update(ref(db, `sessions/${code}/state`), { directedTo: target });
  await runTransaction(ref(db, `sessions/${code}/state/passesUsed`), (n) => (Number(n) || 0) + 1);
}

// ---------------------------------------------------------------------------
// Buzzer system
// ---------------------------------------------------------------------------

export async function setBuzzerOpen(code, open) {
  await set(ref(db, `sessions/${code}/state/buzzerOpen`), open);
}

export async function resetBuzzer(code, ri, qi) {
  await update(ref(db, `sessions/${code}`), {
    [`buzzes/${ri}/${qi}`]: null,
    'state/buzzLockedTo': null,
    'state/lockedOut': null,
    'state/attempts': null,
    'state/buzzerOpen': true,
  });
}

// Transaction guarantees one buzz per player per question (no duplicates).
export async function buzz(code, ri, qi, playerId, name) {
  await runTransaction(ref(db, `sessions/${code}/buzzes/${ri}/${qi}/${playerId}`),
    (current) => (current === null ? { at: serverTimestamp(), name } : undefined));
}

export async function setBuzzLock(code, playerId) {
  await set(ref(db, `sessions/${code}/state/buzzLockedTo`), playerId);
}

// Host verdict on the player who buzzed in.
export async function judgeBuzz(code, session, playerId, correct) {
  const { roundIndex: ri, questionIndex: qi } = session.state;
  const round = session.quiz.rounds[ri];
  const question = round.questions[qi];
  const settings = round.settings || {};

  if (correct) {
    await adjustScore(code, playerId, Number(question.points) || 0, `buzzer R${ri + 1}Q${qi + 1}`);
    await update(ref(db, `sessions/${code}/state`), { phase: 'revealed', buzzerOpen: false });
    return;
  }
  const penalty = Number(settings.wrongPenalty) || 0;
  if (penalty > 0) {
    await adjustScore(code, playerId, -penalty, `wrong buzz R${ri + 1}Q${qi + 1}`);
  }
  const attempts = (Number(session.state.attempts?.[playerId]) || 0) + 1;
  const maxAttempts = Number(settings.maxAttemptsPerPlayer) || 1;
  const updates = { [`state/attempts/${playerId}`]: attempts };
  // Lock this player out unless they have attempts left (their buzz entry is
  // cleared so they can buzz again).
  if (attempts >= maxAttempts) {
    updates[`state/lockedOut/${playerId}`] = true;
  } else {
    updates[`buzzes/${ri}/${qi}/${playerId}`] = null;
  }
  if (settings.allowPassing !== false) {
    updates['state/buzzLockedTo'] = null;
    updates['state/buzzerOpen'] = true;
  }
  await update(ref(db, `sessions/${code}`), updates);
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

export async function submitAnswer(code, ri, qi, playerId, value, timeMs) {
  const r = ref(db, `sessions/${code}/answers/${ri}/${qi}/${playerId}`);
  await runTransaction(r, (current) => {
    if (current && current.value !== undefined) return undefined; // no resubmits
    return {
      ...(current || {}),
      value,
      timeMs: timeMs ?? null,
      submittedAt: serverTimestamp(),
    };
  });
}

export async function submitWager(code, ri, qi, playerId, wager) {
  await update(ref(db, `sessions/${code}/answers/${ri}/${qi}/${playerId}`), {
    wager: Math.max(0, Number(wager) || 0),
  });
}

export { uid };
