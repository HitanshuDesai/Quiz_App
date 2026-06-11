# Roadmap

The MVP is deliberately small but structured for growth. Suggested order:

## Near term (quality of life)

- **Quiz import/export** — serialize quizzes to JSON files from the dashboard
  (the data model is already plain JSON; this is UI work only).
- **Spreadsheet import** — paste CSV/TSV (question, type, answer, points…) into the
  builder; map columns → `blankQuestion` patches.
- **Sound effects & reveal animations** — buzzer noise, countdown ticks, confetti.
- **Per-question answer statistics for the host** (distribution charts at reveal).
- **Session cleanup** — a dashboard view to delete old sessions (RTDB is generous, but
  tidy is tidy).

## Medium term

- **Audio & video rounds** — `mediaType` already exists and `<audio>` renders; add host
  playback controls (play/pause for everyone) driven by a `state.media` node.
- **Historical statistics & seasonal rankings** — sessions are already persisted; add a
  `history/` summary written at `endGame` and a stats page aggregating wins per player
  name across sessions.
- **AI-generated questions** — a "Generate round" button calling an LLM API from the
  host's browser with a user-supplied API key (keeps the zero-budget promise); output
  maps directly onto the existing question JSON.
- **Custom scoring systems** — extract scoring config (round `settings`) into reusable
  presets; the registry pattern in `quizModel.js` is built for this.
- **More round types** — e.g. elimination, list rounds ("name 5…"), bingo. Each is a
  registry entry + a host/player view (see DEVELOPMENT.md).

## Long term

- **User accounts** (Firebase email/Google auth) — replaces anonymous auth; quizzes
  become truly private per host; players get persistent identities for stats.
- **Multiple hosts / co-hosting** — a `hosts/` list on the session plus rule changes.
- **Scheduled games** — store a start time on the session; lobby shows a countdown.
- **Public quiz sharing / community library** — a `publicQuizzes/` tree with
  copy-to-my-quizzes; moderation implications, so after accounts.
- **Migration valve**: if the friend group outgrows Firebase's free tier (unlikely), the
  sync layer is isolated in `lib/db.js` — swapping in Supabase/PartyKit/self-hosted
  Socket.IO means reimplementing one module, not the app.
