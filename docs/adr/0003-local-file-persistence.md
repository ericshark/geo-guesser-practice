# Persist progress to a local disk file mirrored with IndexedDB

User progress is persisted to `data/progress.json` on disk via a lightweight local Vite/Node middleware endpoint, mirrored in browser `IndexedDB` as a fallback and for instant reads.

## Context & Reason

Browser-only storage (`IndexedDB` / `localStorage`) is tied to a specific browser profile and port and is wiped when clearing browser data. Writing automatically to `data/progress.json` in the project workspace lets the user start the server from any browser and pick up right where they left off, while still keeping the app 100% local with zero external backend dependencies.
