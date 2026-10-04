# AGENTS.md

## Project Overview
FRC REBUILT Scouting ("Panther Scouts") — an offline-first Vite + React 19 + TypeScript PWA for FRC robotics scouting (pit scouting, match observations, alliance strategy). Uses IndexedDB for local storage, Firebase Firestore for optional cloud sync, and The Blue Alliance (TBA) API for team/event data.

## Stack
- **Runtime:** Bun 1.4.0 (package manager + dev runner), Vite 8, React 19, Tailwind CSS 4
- **Storage:** IndexedDB (primary, offline-first); Firebase Firestore (optional cloud sync)
- **PWA:** vite-plugin-pwa (service worker in dev mode)

## Running the app
```
docker compose -f docker-compose.base44.yml up -d
```
The web service binds port 3000. Vite dev server serves live source with HMR. No build step needed for development.

## Credentials
No external credentials are required to boot:
- **Firebase config** is committed in `firebase-applet-config.json` (project `pi-obsidian`). Anonymous sign-in is attempted but failures fall back silently to offline mode.
- **TBA API key** (`VITE_TBA_AUTH_KEY`) is optional — a default encoded key is embedded in `src/utils/tbaApi.ts` and used as fallback.
- **GEMINI_API_KEY** appears in `.env.example`/metadata but is not referenced anywhere in `src/`. Not needed.

## Key files
- `vite.config.ts` — Vite config; `allowedHosts: true` (accepts all hosts). HMR/watch disabled when `DISABLE_HMR=true` (AI Studio convention; leave unset for live reload).
- `firebase-applet-config.json` — committed Firebase project config (non-secret web app config).
- `src/db/indexedDB.ts` — local offline-first database.
- `src/db/firebase.ts` — Firestore init + auth; uses config from `firebase-applet-config.json`.
- `src/utils/tbaApi.ts` — TBA API client with embedded default key fallback.

## Notes
- No lockfile is committed; `bun install` generates `bun.lock` on first run (inside the container, on the anonymous `node_modules` volume).
- The app is frontend-only; no backend server process.
