// Registries for question types and round types.
// Adding a new type = add an entry here, an input renderer in
// components/AnswerInput.jsx, and (if auto-scored) a case in lib/scoring.js.

let counter = 0;
export function uid(prefix = 'id') {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.random().toString(36).slice(2, 7)}`;
}

export const QUESTION_TYPES = {
  multiple_choice: {
    label: 'Multiple Choice',
    hasOptions: true,
    answerHint: 'Pick the correct option',
    autoScored: true,
  },
  true_false: {
    label: 'True / False',
    hasOptions: false,
    answerHint: 'true or false',
    autoScored: true,
  },
  free_text: {
    label: 'Free Text',
    hasOptions: false,
    answerHint: 'Accepted answers separated by | (e.g. "USA|United States")',
    autoScored: true,
  },
  closest_number: {
    label: 'Closest Number',
    hasOptions: false,
    answerHint: 'The exact numeric answer',
    autoScored: true,
  },
  image: {
    label: 'Image Question',
    hasOptions: false,
    answerHint: 'Accepted answers separated by |',
    autoScored: true,
    requiresMedia: true,
  },
};

// settings: per-round-type host-configurable options rendered by the builder.
export const ROUND_TYPES = {
  standard: {
    label: 'Standard',
    description: 'Everyone answers at the same time. Auto or manual scoring.',
    settings: {},
  },
  fastest_finger: {
    label: 'Fastest Finger First',
    description: 'Everyone answers; speed matters. Correct answers earn time-scaled bonuses.',
    settings: {
      speedBonusMax: { label: 'Max speed bonus (pts, scaled by time left)', type: 'number', default: 5 },
      firstCorrectBonus: { label: 'Bonus for first correct answer', type: 'number', default: 5 },
    },
  },
  buzzer: {
    label: 'Buzzer Round',
    description: 'First buzz wins the right to answer. Host judges answers live.',
    settings: {
      lockOnBuzz: { label: 'Lock other players after first buzz', type: 'boolean', default: true },
      allowPassing: { label: 'Re-open buzzers after a wrong answer', type: 'boolean', default: true },
      wrongPenalty: { label: 'Penalty for a wrong buzz (pts)', type: 'number', default: 0 },
      maxAttemptsPerPlayer: { label: 'Buzz attempts per player per question', type: 'number', default: 1 },
    },
  },
  passing: {
    label: 'Passing Round',
    description: 'Question is directed to one player/team; can be passed on if they miss.',
    settings: {
      maxPasses: { label: 'Maximum passes per question', type: 'number', default: 2 },
    },
  },
  directed: {
    label: 'Directed Questions',
    description: 'Each question is assigned to one player/team. Only they may answer.',
    settings: {},
  },
  open_challenge: {
    label: 'Open Challenge',
    description: 'Everyone may answer; the first correct answer wins and closes the question.',
    settings: {},
  },
  closest_wins: {
    label: 'Closest Wins',
    description: 'Everyone submits a number; the closest answer takes the points.',
    settings: {},
  },
  wager: {
    label: 'Wager Round',
    description: 'Players bet points before seeing the question. Win or lose the wager.',
    settings: {
      maxWager: { label: 'Maximum wager (0 = current score)', type: 'number', default: 0 },
    },
  },
  picture: {
    label: 'Picture Round',
    description: 'Standard round built around images.',
    settings: {},
  },
};

export function defaultRoundSettings(type) {
  const def = ROUND_TYPES[type]?.settings || {};
  const out = {};
  for (const [key, spec] of Object.entries(def)) out[key] = spec.default;
  return out;
}

export function blankQuestion(roundType = 'standard') {
  const type =
    roundType === 'closest_wins' ? 'closest_number'
    : roundType === 'picture' ? 'image'
    : 'multiple_choice';
  return {
    id: uid('q'),
    text: '',
    type,
    options: type === 'multiple_choice' ? ['', '', '', ''] : [],
    correctAnswer: type === 'multiple_choice' ? 0 : '',
    points: 10,
    timeLimit: 30,
    mediaUrl: '',
    mediaType: 'image',
  };
}

export function blankRound() {
  return {
    id: uid('r'),
    name: '',
    category: '',
    description: '',
    type: 'standard',
    settings: {},
    questions: [blankQuestion()],
  };
}

export function blankQuiz(ownerUid) {
  return {
    title: 'Untitled Quiz',
    description: '',
    ownerUid: ownerUid || null,
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rounds: [blankRound()],
  };
}

// RTDB drops empty arrays/objects; re-hydrate so the UI can rely on shape.
export function normalizeQuiz(quiz) {
  if (!quiz) return quiz;
  const rounds = (quiz.rounds || []).map((r) => ({
    settings: {},
    ...r,
    questions: (r.questions || []).map((q) => ({ options: [], ...q })),
  }));
  return { ...quiz, rounds };
}

export const TEAM_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e91e63', '#607d8b'];

export function roundUsesBuzzer(round) {
  return round?.type === 'buzzer';
}
export function roundIsDirected(round) {
  return round?.type === 'directed' || round?.type === 'passing';
}
export function roundUsesWager(round) {
  return round?.type === 'wager';
}
