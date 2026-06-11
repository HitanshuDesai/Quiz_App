# QuizNight — Implementation Plan & Architecture

This document is the design plan for the QuizNight platform: architecture, data model,
page structure, and user flows. The implementation in this repository follows this plan.

---

## 1. Architecture Recommendation

### Constraints recap

| Constraint | Implication |
|---|---|
| Zero budget | Every service must have a sufficient free tier |
| Friends worldwide | Globally available, low-latency real-time sync |
| Deployable from GitHub | Static hosting + CI from the repo |
| One maintainer | No servers to patch, no backend code to babysit |
| Real-time buzzers | Sub-second pub/sub with server-side timestamps |
| Years of reuse | Persistent quiz storage, easy to extend |

### Chosen architecture: Serverless SPA + Firebase Realtime Database

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│  GitHub repository      │ CI/CD  │  GitHub Pages (free)         │
│  React + Vite SPA       ├───────▶│  Static frontend hosting     │
└─────────────────────────┘        └──────────────┬───────────────┘
                                                  │ HTTPS / WebSocket
                                   ┌──────────────▼───────────────┐
                                   │  Firebase (Spark free tier)  │
                                   │  • Realtime Database (sync,  │
                                   │    quizzes, sessions, buzzes)│
                                   │  • Anonymous Auth            │
                                   └──────────────────────────────┘
```

- **Frontend**: React 18 + Vite, plain CSS (dark-first, responsive). Hash-based routing so
  it works on GitHub Pages without server rewrites.
- **Backend**: none. All game logic runs in the clients; the **host's browser is the game
  authority** (advances state, applies scoring). Firebase RTDB is the shared source of truth.
- **Real-time sync**: Firebase Realtime Database — purpose-built for low-latency fan-out,
  WebSocket-based, with `serverTimestamp` for fair buzzer ordering and `onDisconnect`
  hooks for presence.
- **Auth**: Firebase Anonymous Auth (no accounts needed; satisfies security rules).
- **Media**: image questions reference image URLs (Firebase Storage now requires a paid
  plan for new buckets, so the MVP avoids it; any image host works).
- **Hosting/deploy**: GitHub Actions workflow builds and publishes to GitHub Pages on push.

### Why this and not the alternatives

| Option | Verdict |
|---|---|
| Node + Socket.IO server | Best latency control, but needs an always-on server. Free tiers (Render/Fly) sleep, throttle, or expire — bad for a recurring event and a single maintainer. **Rejected.** |
| Supabase Realtime | Good, but free-tier projects **pause after 7 days of inactivity** — fatal for weekly/occasional quiz nights. **Rejected.** |
| Firestore instead of RTDB | Higher latency for rapid small writes (buzzers), daily write quotas easier to hit. RTDB's 100 concurrent connections / 1 GB storage / 10 GB-month transfer easily covers a friend group forever. **RTDB chosen.** |
| PeerJS/WebRTC (P2P) | No persistence, painful NAT traversal, host refresh kills the game. **Rejected.** |

Free-tier headroom: a 20-player quiz night uses well under 1% of the Spark limits.

### Reliability model

- All state lives in RTDB, so **any participant can refresh and resume** — clients
  re-subscribe and re-render from current state.
- Players keep a per-session identity in `localStorage`; rejoining restores name, team,
  and score.
- Presence via `onDisconnect`: hosts see who dropped; the game never blocks on a player.
- Clock skew handled with RTDB's `.info/serverTimeOffset`; buzzes and answers are stamped
  with **server** timestamps, so ordering is fair regardless of player location.

---

## 2. Data Model (Realtime Database)

```
quizzes/
  {quizId}:
    title, description, ownerUid, createdAt, updatedAt, archived
    rounds: [
      { id, name, category, description,
        type,                  # standard | fastest_finger | buzzer | passing |
                               # directed | open_challenge | closest_wins | wager | picture
        settings: { ... },     # per-round-type options (speed bonus, penalties, passes…)
        questions: [
          { id, text,
            type,              # multiple_choice | true_false | free_text |
                               # closest_number | image
            options: [..],     # multiple choice only
            correctAnswer,     # index | bool | string ("a|b" alternates) | number
            points, timeLimit, # seconds, 0 = no limit
            mediaUrl, mediaType }
        ] }
    ]

sessions/
  {ROOMCODE}:                        # 4-letter code, also used in the join link
    quizId, quiz (frozen snapshot), hostUid, mode (individual|team)
    status (lobby|active|ended), createdAt
    teams/{teamId}:    { name, color }
    players/{playerId}: { name, teamId?, score, connected, joinedAt }
    state: { roundIndex, questionIndex,
             phase,              # idle | wager | open | locked | revealed |
                                 # roundEnd | gameEnd
             paused, startedAt, timeLimit,
             buzzLockedTo, lockedOut/{playerId}, directedTo {kind,id,name},
             passesUsed }
    answers/{r}/{q}/{playerId}: { value, wager?, submittedAt, timeMs,
                                  final { correct, score }, applied, overridden }
    buzzes/{r}/{q}/{playerId}:  { at (serverTimestamp), name }
    log/{pushId}: { at, playerId, delta, reason }   # score adjustments audit
```

Design notes:

- **Sessions copy the quiz** at launch, so editing a quiz never corrupts a live game.
- **Scores are applied once at reveal** (guarded by an `applied` flag per answer); host
  overrides after reveal write the *delta* via a transaction — no double counting.
- **Extensibility**: round types and question types are registries
  (`src/lib/quizModel.js`); adding a type means adding a registry entry, an input
  component, and a scoring case — no schema migration, since RTDB is schemaless.

## 3. Page Structure

| Route | Page | Role |
|---|---|---|
| `#/` | Home — join by code, or enter host area | Both |
| `#/play/:code` | Player: join form → lobby → live game | Player |
| `#/host` | Dashboard: quiz list, create/edit/duplicate/delete/archive, import samples, launch | Host |
| `#/host/quiz/:id` | Quiz Builder | Host |
| `#/host/game/:code` | Lobby management + live control panel | Host |

## 4. User Flows

**Host**: Dashboard → create/edit quiz in Builder (rounds → questions, all in-app) →
"Launch" → choose Individual/Team mode → lobby shows room code + shareable link + joined
players (and team assignment in team mode) → Start game → per question: start / watch
live answers & buzzes / close / reveal (auto-scores) / override scores / award bonus /
penalty / pass / skip → round leaderboard → … → final leaderboard → End game.

**Player**: open join link or enter code → enter display name (pick team in team mode) →
lobby → question appears in real time → answer (type-specific input / buzzer / wager) →
see reveal + own result → leaderboards between rounds → final standings. Refresh-safe at
every step.

**Buzzer flow**: host opens buzzer → players smash the big button → server-timestamped,
duplicate-proof; first buzz (optionally) locks others → host sees ordered list with ms
gaps → marks correct (award + reveal) or wrong (optional penalty, optional lockout, others
unlocked) → reset buzzer any time.

## 5. Round-type behaviors (MVP)

| Type | Flow | Scoring |
|---|---|---|
| Standard / Picture | all answer simultaneously | auto by question type, host override |
| Fastest Finger | all answer; time recorded | auto + configurable speed bonus (scaled by remaining time) + first-correct bonus |
| Buzzer | buzz for the right to answer | host marks correct/wrong; configurable lockout, penalty, multiple attempts |
| Open Challenge | all answer; first **correct** wins | auto-closes on first correct submission |
| Closest Wins | all submit numbers, closest wins | auto-resolved at reveal (ties share) |
| Wager | wager phase → question phase | correct +wager, wrong −wager |
| Directed | only the designated player/team may answer | manual or auto |
| Passing | directed + host passes to next eligible participant, pass limit | manual or auto |

Audio rounds: schema already supports `mediaType: "audio"`; player UI ships with a basic
`<audio>` renderer, full treatment on the roadmap.

## 6. Implementation order

1. Scaffold (Vite, routing, theme, Firebase init)
2. Quiz model registries + Quiz Builder + dashboard CRUD
3. Session creation, join, lobby, presence, teams
4. Core loop (standard rounds, timer, reveal, auto-scoring, leaderboards)
5. Buzzer system
6. Remaining round types (wager, closest, open challenge, directed/passing, fastest finger)
7. Host overrides, bonus/penalty, pause/resume, skip, end
8. Sample quizzes, security rules, docs, CI deploy workflow
