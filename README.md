# GymForge — Lean Bulk HQ

A zero-build, mobile-friendly gym PWA made for a 6-day PPL lean-bulk workflow. It works immediately in local mode and optionally syncs to Firebase.

## Included
- 6-day Push/Pull/Legs ×2 workout tracker with per-set kg/reps/checks
- Session timer + rest timer
- Bengali lean-bulk diet reference + food/macros log
- Weight trend, measurements, PR board and weekly workout count
- Recovery tracking (sleep/water/readiness)
- Gym notes
- Trainer Mode: client roster + quick plan assignment
- JSON export/import backups
- PWA install / offline shell
- Firebase Email/Password Authentication + Firestore cloud sync
- Firestore security rules: each user can only access their own document
- GitHub Pages deployment workflow
- Firebase Hosting config if you prefer Firebase Hosting

## Your defaults
The app starts with 57 kg, 174 cm, 60 kg first target, 2450 kcal and 105 g protein. Change these anytime in Settings.

## Run locally
Because the app uses JavaScript modules, use a tiny local server rather than double-clicking the file:

```bash
python -m http.server 8080
```
Then open `http://localhost:8080`.

## Connect Firebase (free-friendly setup)
1. Create a Firebase project.
2. Add a **Web App** and copy its config.
3. Paste the values into `firebase-config.js`.
4. In Firebase Console → Authentication → Sign-in method, enable **Email/Password**.
5. Create one Cloud Firestore database.
6. Publish the included `firestore.rules` (Firebase CLI command below or paste them in Console).
7. In Authentication → Settings → Authorized domains, add your GitHub Pages domain if you host there.

Optional Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,hosting
```

## GitHub Pages deployment
1. Create a public GitHub repository and upload/push this folder.
2. Make sure the default branch is `main`.
3. GitHub → Settings → Pages → Source → **GitHub Actions**.
4. Push to `main`. The included workflow publishes the static app.

> Note: `firebase-config.js` is not a secret credential. Firebase security must be enforced with Authentication and Firestore Rules. Never put service-account JSON or private API secrets in a public repo.

## Data model
Cloud mode stores one private document per authenticated user:
`users/{uid}` → `{ state: {...}, updatedAt }`

This intentionally minimizes Firestore reads/writes for a personal/small app and keeps the first version simple.

## Future upgrades
The structure can be extended with trainer-client invitations, exercise library/video links, scheduled check-ins, meal database, notifications, wearable integrations, and analytics dashboards.
