# 02: Guided Breakdown ("Show Me What to Look For") & Triggered Side-by-Side Contrast Cards

**What to build:** Add the on-demand **Guided Breakdown** (`?` or `Space`) overlay on any active practice question so a learner who is stuck can immediately see the highlighted **Tells** or geographic clues, read how to eliminate the distractor choices, have the attempt recorded honestly as assisted exposure, and receive 2–3 immediate follow-up trials targeting that feature. Add **Stage 2 Triggered Contrast Cards** that automatically display a side-by-side comparison of Language A vs Language B whenever a confusion pair occurs twice in recent trials, and wire the **Dashboard** "Smart Practice (Weakest Spots)" launcher and top confusion-pair analytics.

**Blocked by:** 01: Foundation — Playable Country & Language Corpus Dataset + Local File Persistence + Dashboard & Languages Speed Drill

**Status:** ready-for-agent

- [ ] Pressing `Space`, `?`, or clicking **"Show me what to look for"** during any active question opens the **Guided Breakdown** overlay directly on the current prompt, highlighting the specific **Tells** (or structural/geographic clues) and explaining why each distractor option is ruled out.
- [ ] Using a **Guided Breakdown** marks the trial as `assisted: true` (preventing false promotion to **Mastered**) and queues 2–3 follow-up trials for that skill/Tell after the minimum spacing delay $D = 2$.
- [ ] `PracticeEngine` tracks a directed confusion matrix (`confused[expectedSkillId][chosenSkillId]`) persisted in `data/progress.json`.
- [ ] Confusing Skill A with Skill B twice within recent trials automatically triggers a side-by-side **Contrast Card** trial comparing A and B with their distinguishing **Tells** highlighted and asking the learner to match each side, followed by boosted priority for both skills.
- [ ] The **Dashboard** displays the learner's top confusion pairs and weakest **Learning** skills, and provides a one-click **"Smart Practice (Weakest Spots)"** button that launches an interleaved session focused on those items.
- [ ] Tests at the `PracticeEngine` seam verify **Guided Breakdown** assistance recording, follow-up queueing, confusion-pair tracking, and triggered **Contrast Card** insertion.
