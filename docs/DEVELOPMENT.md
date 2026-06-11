# Developer Documentation

## Stack

- **React 18 + Vite** SPA, hash routing (`react-router-dom`), plain CSS
  (`src/styles.css`, dark-first with a light theme).
- **Firebase Realtime Database** for persistence and real-time sync;
  **Anonymous Auth** to satisfy security rules. No backend code.
- The **host's browser is the game authority**: it advances the state machine, closes
  questions when timers expire, and applies scoring. Players only write their own
  answers/buzzes/presence.

## Code map

```
src/
  main.jsx, App.jsx        entry + routes + theme + "not configured" guard
  styles.css               full design system
  lib/
    firebase.js            SDK init from VITE_FIREBASE_* env vars, anonymous sign-in
    quizModel.js           QUESTION_TYPES / ROUND_TYPES registries, factories, defaults
    scoring.js             pure scoring functions + leaderboard standings (no Firebase)
    db.js                  every database read/write: quiz CRUD, sessions, game flow,
                           buzzer, scoring application, overrides
    hooks.js               useSession, useAuthUid, useCountdown (server-clock based),
                           usePlayerIdentity (localStorage), useTheme
  components/              Leaderboard, Timer, AnswerInput, QuestionMedia
  pages/
    Home.jsx               join by code
    HostDashboard.jsx      quiz list: create/edit/duplicate/archive/delete/import/launch
    QuizBuilder.jsx        in-app authoring with debounced autosave
    HostGame.jsx           lobby + live control panel (the host state machine UI)
    PlayerGame.jsx         join form, lobby, all in-game player views
  data/sampleQuizzes.js    importable demo quizzes
```

## Session state machine

`sessions/{code}.state.phase`:

```
lobby (status) → idle → [wager →] open → locked → revealed → idle | roundEnd
                                  ↑ buzzer/pass/direct actions happen while open
roundEnd → idle (next round) | gameEnd → status=ended
```

- `goToQuestion` moves the pointer (`roundIndex`/`questionIndex`) and resets per-question
  state; `startQuestion` opens it with a server-timestamped `startedAt`.
- `revealAnswer` (lib/db.js) computes finals via `scoreQuestion` (lib/scoring.js), writes
  them onto the answers, and applies unapplied deltas to player totals — guarded by the
  per-answer `applied` flag so refreshes/double-clicks can't double-score.
- Host overrides (`overrideAnswerScore`) before reveal set `overridden` (respected by
  the reveal); after reveal they apply the score *difference* transactionally.

## Timing & fairness

- All clients subscribe to `.info/serverTimeOffset`; countdowns and answer `timeMs` are
  computed against the **server clock**, so global players are on equal footing.
- Buzzes are written with `serverTimestamp()` inside a transaction keyed by player id —
  duplicates are impossible and ordering is by server time with a deterministic
  tie-break (player id) for sub-millisecond ties.

## Adding a question type

1. Add an entry to `QUESTION_TYPES` in `lib/quizModel.js`.
2. Add the editor fields in `QuizBuilder.jsx` (most types reuse the generic ones).
3. Add an input renderer case in `components/AnswerInput.jsx`.
4. Add a correctness case to `autoCorrect` in `lib/scoring.js` (return `null` for
   host-judged types).

## Adding a round type

1. Add an entry (label, description, `settings` spec) to `ROUND_TYPES` — the builder
   renders the settings form automatically.
2. Add flow behavior where needed: scoring modifier in `scoreQuestion`, host controls in
   `HostGame.jsx`, player view in `PlayerGame.jsx`. Existing types
   (wager, buzzer, open challenge) are templates for each kind of intervention.

## Conventions & gotchas

- RTDB **drops empty arrays/objects** — always run quiz data through `normalizeQuiz`
  before rendering (already done in pages).
- Sessions hold a **frozen copy of the quiz**, so live games are immune to edits.
- Players are identified by a generated id kept in `localStorage`
  (`quiznight_player_<CODE>`) — that's what makes refresh/reconnect seamless.
- Keep `lib/scoring.js` pure (no Firebase imports): it's the piece most worth unit
  testing as the project grows.

## Testing a game alone

Open the host control panel in one window and several private/incognito windows as
players (each gets its own localStorage identity). `npm run dev` serves on the LAN, so a
phone on the same Wi-Fi can join via your machine's IP.
