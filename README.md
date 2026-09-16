# GymForge Ultimate V2 — Lean Bulk HQ

A mobile-first gym PWA for a 6-day PPL lean-bulk workflow. It works locally first, can sync with Firebase, and now includes an AI Food Scanner + Smart Nutrition Coach.

## What is included

- 6-day Push / Pull / Legs ×2 workout tracker
- Per-set kg / reps / completed tracking
- Session timer + rest timer
- Bengali lean-bulk meal reference
- Manual food + macro logging
- **AI Food Scanner**: photo + total weight → estimated calories / protein / carbs / fat / fiber
- AI result review/edit before saving
- **Smart Nutrition Coach**: remaining calories/macros + easy Bengali/Indian food suggestions
- Browser nutrition alerts when permission is enabled and the app is open/loaded
- Weight trend, body measurements and PR board
- Sleep / water / readiness tracking
- Notes
- Trainer Mode: client roster + quick plan assignment
- JSON backup/import
- PWA install/offline shell
- Firebase Email/Password Authentication + Firestore sync adapter
- GitHub Pages deployment workflow

## Your defaults

The app starts with:

- Weight: 57 kg
- Height: 174 cm
- Goal: Lean bulk
- First target: 60 kg
- Calories: 2450 kcal/day
- Protein: 105 g/day
- Carbs: 330 g/day
- Fat: 65 g/day

Change these anytime in Settings.

## AI Food Scanner connection

The website does **not** contain your Gemini API key.

Frontend endpoint is configured in:

`ai-config.js`

Current endpoint:

`https://gymforge-ai.arpanalaps64.workers.dev`

The Cloudflare Worker keeps the Gemini key in a Worker Secret named:

`GEMINI_API_KEY`

A backup copy of the Worker source is included as:

`cloudflare-worker.js`

Do not put the Gemini API key in GitHub, `app.js`, `ai-config.js`, or `cloudflare-worker.js`.

## Replace the current GitHub version

If you already have the `GymForge-Ultimate` repository:

1. Download and extract the V2 ZIP.
2. Open your existing GitHub repository.
3. Replace the old root files with the files from this folder.
4. Make sure these important files are present at repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `ai-config.js`
   - `firebase-config.js`
   - `manifest.webmanifest`
   - `sw.js`
5. Commit the changes.
6. Wait around 1–3 minutes and hard-refresh the GitHub Pages site.

Because the PWA uses a Service Worker, an old version can occasionally remain cached. If that happens, refresh twice or clear the site cache once.

## Firebase (optional until you want cloud sync)

1. Create a Firebase project.
2. Add a Web App.
3. Copy its web config into `firebase-config.js`.
4. Enable **Authentication → Email/Password**.
5. Create Firestore.
6. Publish the included `firestore.rules`.

The Firebase web config is not a private secret. Security comes from Authentication + Firestore Rules. Never upload service-account JSON or private server keys.

## Local run

Because the app uses JavaScript modules, use a local server rather than opening `index.html` directly.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Important note about AI nutrition

Food-photo nutrition values are estimates. Oil, gravy, exact ingredients and hidden portions cannot be measured perfectly from an image. The app always lets you edit the AI result before adding it to your diary.

## Notifications

V2 supports browser nutrition alerts while the app is open/loaded. True scheduled background push notifications can be added later with Firebase Cloud Messaging.
