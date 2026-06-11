# Deployment Guide (GitHub Pages, free)

The repo ships with a GitHub Actions workflow
([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)) that builds the app
and publishes it to GitHub Pages on every push to `main`.

## One-time repository setup

1. **Enable Pages via Actions**: repo → *Settings → Pages → Build and deployment →
   Source: GitHub Actions*.
2. **Add the Firebase config as Actions secrets**: repo → *Settings → Secrets and
   variables → Actions → New repository secret* for each of:

   | Secret name | Value from Firebase |
   |---|---|
   | `FIREBASE_API_KEY` | `apiKey` |
   | `FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `FIREBASE_DATABASE_URL` | `databaseURL` |
   | `FIREBASE_PROJECT_ID` | `projectId` |
   | `FIREBASE_APP_ID` | `appId` |

   (They aren't truly secret — see SETUP.md — but secrets keep them out of the repo.)

3. **Authorize the domain in Firebase**: *Authentication → Settings → Authorized
   domains → Add* `<your-username>.github.io`.

4. Push to `main`. The site appears at
   `https://<your-username>.github.io/<repo-name>/`.

The workflow sets `BASE_PATH=/<repo-name>/` automatically so assets resolve under the
project path. The app uses hash routing (`/#/play/CODE`), so no SPA-rewrite hacks are
needed and shared join links survive refreshes.

## Custom domain (optional, still free)

Add a `CNAME` in *Settings → Pages*, and set the `BASE_PATH` env in the workflow to `/`.
Remember to add the domain to Firebase authorized domains too.

## Alternative hosts

Netlify / Vercel / Cloudflare Pages all work: build command `npm run build`, output
directory `dist`, and the five `VITE_FIREBASE_*` environment variables. No `BASE_PATH`
needed (they serve from the domain root).

## Costs and limits

Everything fits the free tiers comfortably:

- **GitHub Pages**: free static hosting, 100 GB bandwidth/month soft limit.
- **Firebase Spark plan**: Realtime Database — 100 simultaneous connections, 1 GB
  storage, 10 GB/month download. A 20-player weekly quiz uses a fraction of a percent
  of this. No credit card required, nothing to renew, no servers that fall asleep.
