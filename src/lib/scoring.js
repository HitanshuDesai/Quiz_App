// Pure scoring logic. Given a question, round, and the set of submitted
// answers, produce a final {correct, score} per player. The host client runs
// this once at reveal time (see lib/db.js revealAnswer).

function normalizeText(s) {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

export function isTextCorrect(value, correctAnswer) {
  const accepted = String(correctAnswer ?? '')
    .split('|')
    .map(normalizeText)
    .filter(Boolean);
  return accepted.includes(normalizeText(value));
}

// Auto-correctness for a single answer; null = cannot auto-score.
export function autoCorrect(question, value) {
  switch (question.type) {
    case 'multiple_choice':
      return Number(value) === Number(question.correctAnswer);
    case 'true_false':
      return String(value) === String(question.correctAnswer);
    case 'free_text':
    case 'image':
      return isTextCorrect(value, question.correctAnswer);
    case 'closest_number':
      // Exact-match only here; closest_wins rounds are resolved across all answers.
      return Number(value) === Number(question.correctAnswer);
    case 'verbal':
      return null; // answered out loud — the host judges it live
    default:
      return null;
  }
}

// answers: { [playerId]: {value, wager, timeMs, submittedAt} }
// Returns { [playerId]: {correct, score} }
export function scoreQuestion(round, question, answers) {
  const result = {};
  const entries = Object.entries(answers || {});
  const points = Number(question.points) || 0;
  const penalty = Math.max(0, Number(question.negativePoints) || 0);

  if (round.type === 'closest_wins' && question.type === 'closest_number') {
    const target = Number(question.correctAnswer);
    let best = Infinity;
    for (const [, a] of entries) {
      const d = Math.abs(Number(a.value) - target);
      if (Number.isFinite(d) && d < best) best = d;
    }
    for (const [pid, a] of entries) {
      const d = Math.abs(Number(a.value) - target);
      const win = Number.isFinite(d) && d === best && best !== Infinity;
      result[pid] = { correct: win, score: win ? points : 0 };
    }
    return result;
  }

  if (round.type === 'wager') {
    for (const [pid, a] of entries) {
      const wager = Math.max(0, Number(a.wager) || 0);
      if (a.value === undefined) {
        // Wagered but never answered: no gain, no loss.
        result[pid] = { correct: false, score: 0 };
        continue;
      }
      const correct = autoCorrect(question, a.value) === true;
      result[pid] = { correct, score: correct ? wager : -wager };
    }
    return result;
  }

  if (round.type === 'open_challenge') {
    // First correct submission takes the points; everyone else gets zero.
    const correctOnes = entries
      .filter(([, a]) => autoCorrect(question, a.value) === true)
      .sort((x, y) => (x[1].submittedAt || 0) - (y[1].submittedAt || 0));
    const winner = correctOnes[0]?.[0];
    for (const [pid, a] of entries) {
      const ac = a.value === undefined ? null : autoCorrect(question, a.value);
      result[pid] = { correct: ac === true, score: pid === winner ? points : ac === false ? -penalty : 0 };
    }
    return result;
  }

  // standard / picture / fastest_finger / directed / passing / buzzer fallback
  const settings = round.settings || {};
  const limitMs = (Number(question.timeLimit) || 0) * 1000;
  const correctByTime = entries
    .filter(([, a]) => autoCorrect(question, a.value) === true)
    .sort((x, y) => (x[1].submittedAt || 0) - (y[1].submittedAt || 0));
  const firstCorrect = correctByTime[0]?.[0];

  for (const [pid, a] of entries) {
    const correct = a.value === undefined ? null : autoCorrect(question, a.value);
    let score = correct === true ? points : correct === false ? -penalty : 0;
    if (correct === true && round.type === 'fastest_finger') {
      const speedMax = Number(settings.speedBonusMax) || 0;
      if (speedMax > 0 && limitMs > 0 && a.timeMs != null) {
        const remaining = Math.max(0, 1 - a.timeMs / limitMs);
        score += Math.round(speedMax * remaining);
      }
      if (pid === firstCorrect) score += Number(settings.firstCorrectBonus) || 0;
    }
    result[pid] = { correct: correct === true, score };
  }
  return result;
}

// Leaderboard helpers -------------------------------------------------------

function withRanks(rows) {
  let prevScore = null;
  let prevRank = 0;
  return rows.map((row, i) => {
    const rank = row.score === prevScore ? prevRank : i + 1;
    prevScore = row.score;
    prevRank = rank;
    return { ...row, rank };
  });
}

export function playerStandings(players) {
  return withRanks(
    Object.entries(players || {})
      .map(([id, p]) => ({ id, ...p, score: Number(p.score) || 0 }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
  );
}

export function teamStandings(players, teams) {
  const totals = {};
  for (const [, p] of Object.entries(players || {})) {
    if (!p.teamId) continue;
    totals[p.teamId] = (totals[p.teamId] || 0) + (Number(p.score) || 0);
  }
  return withRanks(
    Object.entries(teams || {})
      .map(([id, t]) => ({ id, ...t, score: totals[id] || 0 }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
  );
}
