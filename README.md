# GeoGuessr Academy

An offline-capable, local-first country-clue practice application. React, TypeScript, Vite, Dexie/IndexedDB and FSRS-7. No account or hosted backend.

## Run

Requires Node 24 or later.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. For the offline-capable production application:

```sh
npm run build
npm run preview
```

Keep the same browser origin/port when returning: IndexedDB belongs to an origin. Load the production app once and let its service worker finish caching before going offline. Development mode does not install the offline worker. Clearing browser storage removes progress; export backups in Settings.

## Controls

Choose an answer or press 1–4. Enter checks a typed answer or continues after feedback. H requests a hint, ? records “I don’t know”, Escape pauses. Elimination questions allow multiple selections before checking. Reload resumes the stored question and feedback.

## Learning system

FSRS v6 schedules one card per concept using FSRS-7 and 90% desired retention. Wrong answers receive Again; correct answers receive Good. Hints and introduction views are recorded as assistance and do not advance a correct answer's schedule. Speed does not determine a rating. Incorrect concepts return after three intervening questions when the session has room. Same-session retries do not create extra successful study dates.

After three correct answers across two variants, suitable items switch to typed recall. Model scheduling and observed skill are separate. Recognition is not equivalent to unsupported recall. Mastery labels are heuristics; see [learning notes](docs/learning-system.md).

Content lives in `src/content.ts`. Stable IDs bind history to concepts. Add country aliases in the normalizer and facts with explanatory exceptions and references. Source links require internet; the quiz does not. Text is authentic script vocabulary; vector road scenes are illustrative context, not photographs or evidence of a specific location.

Settings exports/imports versioned JSON. Import validates the envelope before replacing tables transactionally; confirmation is required. Reset also requires confirmation. Unknown concept history is retained on import.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

## Current implementation limits

This is a working implementation of the core app, **not full completion of the accepted plan**:

- The content bank exceeds 200 entries, but does not meet the requested per-category minimums. Domains and driving conventions are overrepresented. References include broad editorial starting points; not every individual claim has received a source audit.
- Three examples are provided per entry, but some are restatements rather than genuinely independent transfer tests. Simulation scenarios currently combine domains and driving direction, rather than rich unfamiliar road scenes.
- Selection uses a priority score and randomness, rather than the specified configurable weighted pools and seeded selection. New-item caps and feedback-leak prevention are not implemented.
- Country Duel currently practices authored comparison explanations rather than an interactive choice of countries. Spot-the-difference does not yet render two distinct examples side by side. Elimination validates country selections but does not require a separate reasoning choice.
- There is no configurable session timer, timed recognition, regional country browser, confusion-pair analytics, or update-between-sessions prompt.
- Mastery thresholds are simplified. Retained does not yet require a verified seven-day retrieval gap and unfamiliar-example success. Format-specific progression and diagnostic support adjustment are incomplete.
- Fonts rely on device coverage. Some scripts may be unavailable on a device without suitable fonts. There is no photograph-import asset manifest yet.
- Backup validation does not fully validate every FSRS card field or opaque session/settings payload. No migration from older app versions is currently necessary; only version 1 is supported.

These limits should be addressed before treating the curriculum or retained-skill indicators as validated training measures.
