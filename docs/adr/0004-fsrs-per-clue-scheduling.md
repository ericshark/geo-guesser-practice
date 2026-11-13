# Schedule each clue with FSRS across days, still per skill and never per prompt

Supersedes the scheduling algorithm in [0002](./0002-arts-category-scheduling.md). Keeps its central rule: the unit that is scheduled is the **clue** (a language, a driving-side country, a web domain), not a single prompt, and every question shows a different stimulus.

## Context & Reason

ARTS ordered items only inside one session, so nothing came back for review on a later day. Long-term retention needs spacing across days. FSRS (`ts-fsrs`) predicts recall per item and schedules the next review when recall is about to fall to the target (90%).

Per-prompt scheduling is still wrong here (it trains memorising one sentence). So the FSRS "card" is the clue, and the stimulus is picked fresh from the clue's pool (avoiding the one just shown).

## Decisions

- **Grading:** wrong → Again, correct with the hint → Hard, correct → Good, correct and fast on an established clue (4 s, 2+ prior reviews) → Easy.
- **Mastery** is derived from FSRS stability, not from recent streaks: Learning (< 4 days or last answer not clean), Familiar (≥ 4 days), Mastered (≥ 21 days, last answer correct). It cannot be reached in one sitting.
- **Interleaving and contrast** live in session building, not the scheduler: look-alike clues are mixed, and distractors come from declared confusables first.
- **Confusions** are recorded clue-to-clue only; foils (wrong answers that are not clues) are never counted.
- **Persistence** is `ProgressData` version 2. A version 1 file is copied to `data/progress.v1.backup.json` (disk) or an `v1-backup` row (IndexedDB) before the first version 2 save, and progress starts fresh.
