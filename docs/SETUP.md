# Setup Guide

QuizNight needs exactly one external (free) service: a Firebase project. Everything else
runs in the browser.

## 1. Create a Firebase project (~5 minutes, free)

1. Go to <https://console.firebase.google.com> and click **Add project**.
   Any name works (e.g. `quiznight`). Google Analytics can be disabled.
2. **Enable Anonymous Authentication**:
   *Build → Authentication → Get started → Sign-in method → Anonymous → Enable.*
3. **Create a Realtime Database**:
   *Build → Realtime Database → Create database.* Pick the location closest to most of
   your friends. Start in **locked mode**.
4. **Set security rules**: in the Realtime Database → *Rules* tab, paste the contents of
   [`database.rules.json`](../database.rules.json) from this repo and publish.
5. **Register a web app**: *Project settings (gear icon) → Your apps → Web (`</>`)*.
   No hosting needed. Copy the config values shown.

> The rules require sign-in (the app signs everyone in anonymously) and block everything
> outside `quizzes/` and `sessions/`. For a private friend group this is sufficient;
> tighter per-role rules are on the roadmap alongside real accounts.

## 2. Run locally

```bash
git clone <your-repo-url>
cd <repo>
npm install
cp .env.example .env     # then paste your Firebase config values into .env
npm run dev              # → http://localhost:5173
```

The mapping from the Firebase config object to `.env`:

| Firebase config | .env variable |
|---|---|
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `databaseURL` | `VITE_FIREBASE_DATABASE_URL` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |

> `databaseURL` is shown at the top of the Realtime Database page if it isn't in the
> config snippet (it looks like `https://<project>-default-rtdb.<region>.firebasedatabase.app`).

These values are **not secrets** — they ship in the client bundle by design; the database
rules are what protect your data.

## 3. First quiz night

1. Open the app → **I'm the host** → **Import sample quizzes**.
2. Click **Launch** on a sample, pick Individual or Team mode.
3. Share the join link (or the 4-letter room code) with friends.
4. Press **Start game** and run the show from the control panel.

## 4. Deploy it

See [DEPLOYMENT.md](DEPLOYMENT.md) to put it on GitHub Pages for free.
