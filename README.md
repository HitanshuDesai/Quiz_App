# 🎯 QuizNight

A reusable, real-time multiplayer quiz platform for hosting quiz nights with friends
anywhere in the world. Create quizzes in the app (no code edits, ever), launch a room,
share a link, and run the show from a live host control panel — buzzers included.

**Zero running costs**: a static React app (GitHub Pages) + Firebase's free tier.
No servers to maintain.

## Features

- **In-app quiz builder** — rounds, categories, per-question type/points/time
  limit/media; quizzes persist forever and can be edited, duplicated, archived.
- **Question types**: multiple choice, true/false, free text (with alternate accepted
  answers), closest number, image questions. Registry-based — easy to extend.
- **Round formats**: standard, fastest finger first (speed bonuses), **buzzer rounds**
  (server-timestamped, duplicate-proof, fair ordering), open challenge (first correct
  wins), closest wins, wager rounds, picture rounds, directed questions and passing
  rounds. Audio-ready data model.
- **Individual or team mode** with team creation, assignment, and team leaderboards.
- **Live host control panel**: start/pause/resume/end, skip, close, reveal, see every
  response in real time, override any score, bonus points, penalties, pass questions,
  open/close/reset buzzers.
- **Player experience**: join by 4-letter code or link, no accounts, works great on
  phones, survives refreshes and reconnects, live leaderboards.
- Modern responsive UI with dark mode (default) and light mode.

## Quick start

```bash
npm install
cp .env.example .env   # fill in your free Firebase project's config
npm run dev
```

Full walkthrough (Firebase setup takes ~5 minutes): **[docs/SETUP.md](docs/SETUP.md)**

Then open the app → *I'm the host* → *Import sample quizzes* → *Launch*.

## Documentation

| Doc | What's in it |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Architecture decision & rationale, data model, flows |
| [docs/SETUP.md](docs/SETUP.md) | Firebase + local setup, first quiz night |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Free deployment to GitHub Pages via Actions |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Code map, state machine, how to add round/question types |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Future enhancements (AI questions, stats, accounts…) |

## How it works (one paragraph)

The app is a static SPA; Firebase Realtime Database is the shared source of truth. The
host's browser acts as the game authority — it advances the question state machine,
closes timers, and applies scoring — while players write only their own answers and
buzzes. Buzzes and answers carry **server** timestamps and all countdowns run against
the server clock, so play is fair across continents. Sessions snapshot the quiz at
launch, players keep a local identity for seamless reconnects, and everything persists,
so the platform is ready again next week.

## License

MIT — do whatever makes your quiz nights better.
