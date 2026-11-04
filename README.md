# Shuttle

A mobile-first app for running a badminton tournament. Create a tournament, add players, draw doubles teams and fixtures, share a link, and keep the score live on every phone in the hall. There is no sign-up.

## Run it locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

This starts the Firebase Emulator Suite (Auth on port 9199, Firestore on port 8181) and the Next.js dev server at [http://localhost:4317](http://localhost:4317). Leave the Firebase variables unset and the app talks to the emulators automatically. Tournament data is kept in `.emulator-data` between runs.

```bash
npm test          # scoring, fixtures, standings
npm run test:rules  # Firestore security rules, against the emulator
npm run typecheck
npm run lint
```

## What you can do

1. Create a tournament: name, singles / doubles / both, and a format.
2. Add players. For doubles, draw random teams, swap players, and confirm.
3. Generate the draw.
4. Share the link or the 6-character code. Anyone with it can view and score.
5. Tap a match and use the two **+1 point** buttons. Scores follow BWF rules and update every open device immediately.
6. Read the standings, or the bracket, which advances winners on its own.

Formats: round robin, group stage (groups of about four, then a knockout for the top two), single elimination with byes, and double elimination with a grand final and a reset match when the losers-bracket finalist wins.

## Scoring rules

Best of three games. A game is won at 21 points by a margin of two, or at 30 after a 29–29 deuce. First to two games wins the match. Undo, score correction, and ending a match early (retirement or walkover) are all saved, and a correction can be undone.

Two people tapping the same rally at once cannot both count: each write carries the version the scorer last saw, and a stale write is rejected.

## Production: Firebase and Vercel

The app has no backend of its own. Deploy the Next.js app to Vercel and point it at a Firebase project.

1. Create a Firebase project and a **web app**. Enable **Cloud Firestore**, **Authentication → Anonymous**, and **App Check** with reCAPTCHA v3.
2. Copy `.env.example` to `.env.local` (or to the Vercel project settings) and fill in:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   NEXT_PUBLIC_FIREBASE_PROJECT_ID
   NEXT_PUBLIC_FIREBASE_APP_ID
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY
   ```

3. Register `localhost` as an allowed domain for Auth, and add your Vercel domain too.
4. Deploy the rules:

   ```bash
   npx firebase login
   npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
   ```

5. In the App Check console, enforce App Check for Cloud Firestore and Authentication. For local testing against the real project, set `NEXT_PUBLIC_APPCHECK_DEBUG=true`, load the app once, and register the debug token the console prints.
6. Import the repository in Vercel and deploy. `npm run build` is the build command.

To force the emulators even when those variables are present, set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`.

## How access works, and what it does not protect

There are no accounts and no login screen. Each browser signs in silently with Firebase Anonymous Auth, which exists only so security rules can require `request.auth != null` and so App Check can be enforced. Nobody sees it.

A tournament's code is its document id. The rules allow reading one tournament by its exact code and **forbid listing tournaments**, so codes cannot be walked through the API. The code is six characters from a 32-symbol alphabet with no look-alike letters (about a billion combinations).

**Anyone who has the link or the code can view the tournament, edit players, and change scores.** The code is a shared secret for the people in the hall, not an authorization system. Do not put anything private in a tournament. Treat a leaked link as a leaked tournament: there is no way to revoke a single person without changing the code, and the code cannot be changed.

The rules do limit the blast radius. Writes must match a strict schema, scores are capped at 30, match updates must increment a version (so a score cannot be silently overwritten), the score history is append-only, and only the anonymous user who created a tournament can delete it. App Check, when enforced in the Firebase console, rejects clients that are not the real web app.

These rules do not stop a determined person who already knows a code, or who copies a signed-in session, from modifying that tournament. That is an accepted limit of a no-login design.
