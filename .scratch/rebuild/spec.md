# GeoGuessr Practice Rebuild Specification

**Status:** ready-for-agent

## Problem Statement

The current single-prompt prototype does not help a learner build rapid, reliable GeoGuessr recognition skills:

1. **Wrong unit of language practice:** It shows 3 isolated words per country (`Straße|groß|Fußweg`) and always asks for a country rather than training the learner to look at realistic **Sentences** and **Sign Text**, recognize the language inside a visually confusable **Language Group** (e.g., Japanese vs Korean vs Simplified/Traditional Chinese; Polish vs Czech vs Slovak vs Hungarian), and then connect that language to its **Candidate Countries**.
2. **Repetitive flashcard scheduling instead of perceptual fluency:** Repeating the exact same card teaches memorization of a single example rather than instant pattern + **Tell** recognition across unseen text, and ignores response speed.
3. **Missing high-yield geographic Sections and interactive map:** **Driving Side** and Street View **Coverage** are not dedicated, map-backed **Sections** that let the learner build spatial mental models (such as clicking all left-driving covered countries in a region or distinguishing **Official**, **Limited**, and **None** coverage tiers).
4. **No guided feedback loop when lost:** When the learner has no idea what to look for on a prompt, there is no on-demand **Guided Breakdown** to highlight the **Tells** directly on the current prompt, explain how to rule out distractors, and queue immediate follow-up practice.
5. **Fragile persistence and dated UI:** Progress lives only in browser `IndexedDB` (lost if browser storage is cleared or another browser is opened), and the dark-green UI feels cluttered and unpolished rather than clean, minimal, and Apple-inspired with purposeful color accents.

## Solution

A complete, clean-room rebuild of **GeoGuessr Practice** as a local-first web application with an Apple-inspired minimalist UI (light/dark system theme, crisp neutral surfaces, subtle `1px` borders, soft elevation, and vibrant functional accents for highlighted **Tells**, map regions, and mastery rings), automatic disk persistence to `data/progress.json` mirrored with `IndexedDB`, and a 4-stage perceptual learning engine powered by **Adaptive Response-Time-based Sequencing (ARTS)**.

The application is organized around a central **Dashboard**, four dedicated practice **Sections** (**Languages**, **Driving Side**, **Coverage**, and **Domains & Currencies**), and an interactive **Field Guide** reference browser backed by a single shared **Playable Country** dataset.

## User Stories

### Dashboard & Navigation

1. As a learner opening the app, I want to land on a clean **Dashboard** showing each **Section** (**Languages**, **Driving Side**, **Coverage**, **Domains & Currencies**), my overall and per-Section **Mastery State** breakdown (**Unseen**, **Learning**, **Recognized**, **Mastered**), total trials practiced, active streak/time practiced, and my top confusion pairs, so that I immediately know where I stand and what to practice next.
2. As a learner on the **Dashboard**, I want a one-click "Smart Practice (Weakest Spots)" action that automatically launches an interleaved session targeting my highest-priority **Learning** skills and frequent confusion pairs across Sections, so that I can train efficiently without manually configuring a session.
3. As a learner, I want the visual interface to follow my system light/dark appearance with clean typography, generous whitespace, and color used specifically for interactive clues, highlighted **Tells**, map selections, and instant feedback, so that the app is a pleasure to use for daily drills.
4. As a learner, I want full keyboard navigation across all drills (`1`–`6` for choices, `Space` or `?` for **Guided Breakdown**, `Enter` to submit/advance, `Escape` to exit or close overlays), so that I can answer within the fluency time window without reaching for the mouse on text drills.

### Languages Section & 4-Stage Perceptual Loop

5. As a learner entering the **Languages** Section, I want to choose a visually confusable **Language Group** (East Asian, Southeast Asian, South Asian Scripts, Romance, Germanic, Central European Slavic & Hungarian, Cyrillic, Baltic & Finnic, Mediterranean / Middle East / Caucasus, African, or All-Groups Mixed), so that quiz options are genuine lookalikes rather than trivial mismatches like English vs Chinese vs Russian.
6. As a learner starting a **Language Group**, I want a compact, skippable **Stage 0 Quick Prime** (**Contrast Card**) that shows the group's languages side by side with their top 2–4 **Tells**, visual script notes, and **Candidate Countries**, so that I know what features to scan for before the timed drill starts.
7. As a learner in **Stage 1 Interleaved Speed Drill**, I want every trial to draw a fresh, unseen **Sample** (mixing full **Sentences** from the bundled open corpus and realistic **Sign Text** like street names, warnings, and shop signs) so that I never memorize individual prompts.
8. As a learner answering a language prompt, I want immediate feedback (<100ms) that highlights the exact **Tell(s)** inside the **Sample** in color (e.g., `ß`, `ő/ű`, `ł`, `ř`, `ы` vs `і/ї`, Hangul syllable blocks vs Hiragana curves), displays the English translation, and lists the **Candidate Countries** with Street View coverage, so that every trial reinforces both pattern recognition and explicit rules.
9. As a learner viewing a **Sample** that happens to have no single-character **Tell**, I want the feedback to explain the structural, word-level, or absence clue (e.g., doubled vowels in Finnish/Estonian, `-ij-` in Dutch, or absence of Polish nasal vowels), so that I learn how to handle short signs without obvious diacritics.
10. As a learner who confuses Language A with Language B twice within recent trials, I want **Stage 2 Triggered Contrast** to automatically insert a side-by-side **Contrast Card** comparing a Sample of Language A and Language B with their distinguishing **Tells** highlighted and ask me to identify which is which, followed by extra priority weighting on that pair, so that my specific confusion is resolved immediately.
11. As a learner who has reached fluency on a language (accurate and fast), I want **Stage 3 Language → Country Bridge** trials that ask me to select or click on the map all **Candidate Countries** where that language appears on Street View signs (while noting uncovered countries only as informational footnotes), so that recognizing a language immediately translates into actionable GeoGuessr country candidates.
12. As a learner, I want dedicated **Tell Recognition** micro-questions mixed into language practice (e.g., "Which language uses `ř`?" or "Which script has a horizontal headline with rounded loops below?"), so that I lock in high-value character giveaways alongside full-sentence reading.

### Guided Breakdown ("I'm Lost / Show Me What to Look For")

13. As a learner who is completely stuck on any question, I want to press a **"Show me what to look for"** button (`?` or `Space`) instead of guessing blindly, so that the app overlays a **Guided Breakdown** directly on the current prompt.
14. As a learner viewing a **Guided Breakdown**, I want it to highlight the specific **Tells** or geographic clues present on the current prompt, explain step-by-step how to eliminate the distractor options, and automatically queue 2–3 immediate follow-up questions featuring that same skill/feature, so that being lost turns directly into guided skill acquisition.
15. As a learner who uses a **Guided Breakdown**, I want that trial recorded as assisted exposure rather than an unaided fluent retrieval, so that my **Mastery State** remains honest.

### Driving Side Section

16. As a learner in the **Driving Side** Section, I want interactive map drills where I click all left-driving (or right-driving) **Playable Countries** within a target region (e.g., Europe, Southern & Eastern Africa, South & Southeast Asia, Oceania, Americas & Caribbean, or World), including selectable pills for small islands/territories (UK Crown Dependencies, Malta, Cyprus, Hong Kong, Macau, Singapore, Christmas Island, Bermuda, U.S. Virgin Islands), so that I can picture every left-driving country on the map instantly.
17. As a learner in the **Driving Side** Section, I want rapid country prompts ("Does traffic in Kenya drive on the left or right?") scheduled by ARTS response time and accuracy, so that I have zero hesitation on tricky countries (such as Ghana, Nigeria, Senegal, Rwanda, Indonesia, Thailand, Cambodia, Laos, Bangladesh, Bhutan, Japan, Taiwan).
18. As a learner in the **Driving Side** Section, I want multi-clue narrowing drills ("Left-hand traffic + Cyrillic/Latin/Asian script or regional clue → select the **Candidate Countries**"), so that I practice combining driving side with a second clue just like in a real GeoGuessr round.
19. As a learner in the **Driving Side** Section, I want an interactive written Field Guide on how to determine driving side when no moving cars are visible (road-edge yellow/white line positions, sign orientation, roundabout circulation direction, parked car dominance, and camera-car shadow/hood clues), so that I know how to spot left-hand traffic from road geometry alone.

### Coverage Section

20. As a learner in the **Coverage** Section, I want to practice identifying whether a country or territory has **Official** (broad road coverage), **Limited** (specific regions, select cities, or trekker-only), or **None** (no playable Street View road coverage) **Coverage Tier**, so that I never guess a country in GeoGuessr that isn't even in the game.
21. As a learner in the **Coverage** Section, I want map-selection drills ("Click all African countries with Official or Limited Street View coverage" or "Which of these neighboring countries has NO coverage?") that highlight common trap countries (e.g., mainland China, Egypt, Morocco, Algeria, Belarus, Moldova, Venezuela, Bolivia, Paraguay vs Uruguay, Cuba, Iran, Pakistan road gaps), so that I internalize the playable world map.
22. As a learner answering a **Coverage** question for a country with **Limited** coverage (such as Nigeria, Kenya, Senegal, Russia, Vietnam, India, Colombia, Ecuador, Alaska/Northern Canada), I want feedback to display a concise regional coverage note (e.g., where the coverage actually exists within that country), so that I know which parts of large or partially covered countries are playable.

### Domains & Currencies Section

23. As a learner in the **Domains & Currencies** Section, I want to drill country-code top-level domains (`.ch`, `.hr`, `.za`, `.rs`, `.ba`, `.me`, `.mk`, `.al`, `.dz`, `.tn`, `.is`, `.fi`, `.ee`, `.lv`, `.lt`, `.pl`, `.cz`, `.sk`, `.hu`, `.ro`, `.bg`, `.ua`, `.by`, `.ge`, `.il`, `.ae`, `.kr`, `.jp`, `.tw`, `.hk`, `.my`, `.id`, `.ph`, `.vn`, `.th`, `.sg`, `.au`, `.nz`, `.ar`, `.br`, `.cl`, `.co`, `.pe`, `.mx`, `.uy`) embedded inside realistic sign/URL snippets (e.g., `www.pekara.hr`, `info@stadt.ch`), so that I can instantly map non-obvious ccTLDs on vans and billboards to their **Playable Country**.
24. As a learner in the **Domains & Currencies** Section, I want to drill currency symbols and codes (`zł`, `Kč`, `Ft`, `lei`/`RON`, `din`/`РСД`, `лв`, `₴`, `₾`, `₪`, `฿`, `₫`, `₱`, `RM`, `Rp`, `₹`, `₨`, `₩`, `¥`, `R$`, `$`, `R`, `kr` across Denmark/Norway/Sweden/Iceland) inside realistic price tags and shop signs, including multi-country disambiguation when a currency is shared (e.g., `€`, `$`, `kr`), so that price signs immediately narrow my **Candidate Countries**.

### ARTS Scheduling & Mastery States

25. As a learner, I want my response time measured unobtrusively on every question (shown as a calm fluency indicator bar rather than a punishing game-over countdown), so that I can take extra time to inspect a prompt whenever needed while the scheduler still knows whether my recognition was automatic (<3.5s) or effortful.
26. As a learner, I want each skill item (each Language, Playable Country's driving side/coverage, and Domain/Currency) to progress through four clear **Mastery States**—**Unseen**, **Learning**, **Recognized** (≥80% accuracy on recent trials regardless of speed), and **Mastered** (last 4 of 5 trials correct without assistance, including the last 3 in a row under the fluency response-time ceiling)—so that "Mastered" genuinely reflects instant in-game recognition.
27. As a learner, I want the ARTS scheduler to enforce a minimum spacing delay of at least 2 intervening trials before repeating the same skill, heavily prioritize recent errors and slow correct answers, and weight my active confusion pairs, so that practice time is always spent where it yields the fastest improvement.

### Field Guide & Reference Browser

28. As a learner, I want a searchable **Field Guide** where I can browse every **Playable Country** (viewing its **Coverage Tier** + notes, **Driving Side**, official/signage languages, ccTLD domain, currency, and key distinguishing notes in one unified card) and every **Language Group** (viewing side-by-side **Contrast Cards**, all **Tells**, and sample signs), so that I can study or review outside of timed drills.

### Persistence & Data Management

29. As a learner running the app locally, I want my progress, trial history, confusion matrix, and **Mastery States** saved automatically to `data/progress.json` in the project directory on every answer (and mirrored in browser `IndexedDB`), so that stopping the server, clearing browser cache, or opening a different browser never loses my progress.
30. As a learner, I want to be able to export my progress as a versioned JSON file, import a backup file with validation, or reset a specific **Section** or all progress with confirmation, so that I have full control over my training data.

## Implementation Decisions

### 1. Single Canonical Geography & Language Dataset

All **Sections** read from one immutable, typed dataset in the codebase:

- **`PlayableCountry`**: keyed by ISO-based slug (including distinct GeoGuessr territories such as `hk`, `mo`, `pr`, `fo`, `gl`, `bm`, `vi`, `cw`, `re`, `CX`, `im`, `je`, `gg`, `gi`, `gu`, `mp`, `as`). Contains:
  - `id`, `name`, `region` (`Europe`, `Asia`, `Oceania`, `Africa`, `Americas`)
  - `coverageTier`: `'official' | 'limited' | 'none'`
  - `coverageNote`: concise explanation of regional limits or why it is a common trap
  - `drivingSide`: `'left' | 'right'`
  - `drivingNote`: optional note (e.g., island/border exceptions or car meta notes)
  - `signLanguages`: array of Language IDs commonly seen on street/road signs
  - `tld`: primary country-code domain (e.g., `.hr`, `.ch`, `.za`)
  - `currencies`: array of `{ symbol: string; code: string; exampleSign: string }`
  - `mapGeometryId` / `coordinates`: links the country to the vector world map polygon and/or small-territory clickable pill coordinates.
- **`LanguageSpec` & `LanguageGroup`**:
  - Each `LanguageSpec` belongs to a primary visual `LanguageGroup` (`east-asian`, `southeast-asian`, `south-asian`, `romance`, `germanic`, `central-slavic-hungarian`, `cyrillic`, `baltic-finnic`, `mediterranean-middle-east-caucasus`, `african`) and defines:
    - `id`, `name`, `nativeName`, `script`
    - `tells`: array of `{ id: string; pattern: string;regex?: string; label: string; explanation: string; isUnique: boolean }`
    - `gestaltNote`: what to look for when no single-character **Tell** appears
    - `candidateCountryIds`: computed/verified list of covered `PlayableCountry` IDs (`coverageTier !== 'none'`), plus `uncoveredCountryNotes` for notable non-covered countries.
    - `samples`: bundled pool of authentic **Sentences** (sourced from Tatoeba CC-BY / open corpora) and authored **Sign Text** (street signs, traffic notices, shop headers), each with `{ id, text, translation, kind: 'sentence' | 'sign', tellIds: string[], structuralClue?: string }`.

### 2. ARTS Perceptual Learning & Session Engine (`PracticeEngine`)

The core domain module is a pure, deterministic state machine + façade (`PracticeEngine`) with no React or DOM dependencies:

- **Skill-level scheduling, never sample-level repetition**:
  - Every schedulable unit is a `SkillId` (e.g., `lang:pl`, `drive:ke`, `cov:cn`, `domain:hr`, `curr:pln`).
  - Within an active session, each candidate `SkillId` receives an ARTS priority score:
    $$P = a \cdot (N - D) \cdot \left[ b \cdot (1 - \alpha) \cdot \max\left(0, \ln\frac{\text{RT}}{r}\right) + \alpha \cdot W \right] + C_{\text{pair}}$$
    where $N$ is trials since last presentation, $D = 2$ is the enforced spacing delay (so $P \le 0$ when $N \le D$), $\alpha = 1$ if the last attempt was wrong or used a **Guided Breakdown** (else $0$), $W$ is the error weight, $\text{RT}$ is the response time in ms relative to target threshold $r$ (3500ms for language/domain/currency recognition, 2500ms for left/right driving side), and $C_{\text{pair}}$ boosts skills involved in recent confusion pairs.
- **Sample selection with anti-repeat tracking**:
  - For any selected `SkillId`, the engine picks the least-recently-seen **Sample** for that skill (avoiding any `sampleId` already shown in the session or recent history) and highlights any matching **Tells** during feedback or **Guided Breakdown**.
- **Confusion-pair matrix & Stage 2 Triggered Contrast**:
  - The engine records directed confusion counts `confused[expectedSkillId][chosenSkillId]`.
  - When a learner confuses `A` and `B` at least twice in recent trials, the engine queues a **Contrast Card** trial comparing `A` and `B` side by side with their distinguishing **Tells** highlighted, followed by elevated priority for both `A` and `B`.
- **Stage 3 Language → Country Bridge**:
  - Once a language reaches `recognized` or `mastered` within a session, the engine interleaves bridge trials asking the learner to select the language's **Candidate Countries** (via map click or multi-select).
- **Guided Breakdown queue**:
  - Calling `requestGuidedBreakdown()` reveals the current prompt's **Tells**, structural notes, and distractor elimination reasons, marks the current attempt as assisted (`assisted: true`), and schedules 2 follow-up trials targeting that skill/Tell after the spacing delay $D$.
- **Mastery State calculation**:
  - `unseen`: 0 attempts.
  - `learning`: >0 attempts, <80% accuracy on the last 5 attempts or assisted on the most recent attempt.
  - `recognized`: ≥80% accuracy (at least 4 of last 5 correct without assistance), but not yet meeting the fluency response-time threshold.
  - `mastered`: at least 4 of the last 5 attempts correct without assistance, including the last 3 consecutive attempts correct and each under the fluency ceiling (`3500ms` for languages/domains/currencies, `2500ms` for driving side, `5000ms` for map-click questions).

### 3. Local File Persistence + IndexedDB Mirror (`ProgressStore`)

- A Vite server middleware (and standalone local Node handler for `npm run dev` / `npm run preview`) exposes `GET /api/progress` and `PUT /api/progress`, reading and atomically writing `data/progress.json` in the workspace directory.
- On the client, `ProgressStore` loads from `/api/progress` on startup (falling back to `IndexedDB` if offline/static) and writes through to both `/api/progress` and `IndexedDB` on every completed trial or reset/import action.
- Schema validation via `zod` guarantees safe imports and versioned migrations.

### 4. Interactive Vector World Map

- Built with a bundled, offline-capable Natural Earth / TopoJSON geometry plus dedicated interactive pill markers for small GeoGuessr territories and microstates (e.g., Hong Kong, Macau, Singapore, Malta, Cyprus, Luxembourg, Andorra, Monaco, San Marino, Faroe Islands, Gibraltar, Bermuda, U.S. Virgin Islands, Puerto Rico, Curaçao, Réunion, Christmas Island).
- Supports region zoom presets (`World`, `Europe`, `Asia`, `South & SE Asia`, `Africa`, `Southern & Eastern Africa`, `Oceania`, `Americas`), click-to-toggle country selection, color-coded **Coverage Tier** / **Driving Side** overlays, and hover/focus tooltips for accessibility.

### 5. Apple-Inspired Minimalist UI Architecture

- **Theme & Typography**: System-following light/dark mode (`#F5F5F7` / `#FFFFFF` surfaces in light mode; `#0B0C0E` / `#14161A` in dark mode), SF Pro / Inter typography, crisp `1px` translucent borders, and subtle spring transitions.
- **Color Semantics**:
  - Primary interactive accent: System Blue (`#0071E3` / `#0A84FF`)
  - Highlighted **Tells** in Samples: Distinct pill/underline highlights (Indigo, Amber, Rose, Teal) linking each highlighted character span in the sentence directly to its **Tell** badge below.
  - **Mastery States**: Unseen (Neutral Slate), Learning (Amber), Recognized (Blue), Mastered (Emerald).

## Testing Decisions

### What Makes a Good Test
Tests must assert observable external behavior and outputs across module boundaries—never internal private helpers, CSS class names, or implementation details.

### Agreed Testing Seams

1. **Primary Seam — `PracticeEngine` (Session & ARTS Learning Controller)**:
   - Tested with an in-memory `ProgressStore` and deterministic clock/RNG.
   - Verifies:
     - Starting a session for any of the 4 **Sections** (**Languages**, **Driving Side**, **Coverage**, **Domains & Currencies**) or Smart Weakest-Spot mode.
     - Stage 0 Quick Prime delivery and skipping.
     - ARTS priority scheduling: spacing delay $D = 2$ prevents back-to-back repeats of the same skill; errors and slow correct responses are prioritized ahead of fast correct responses.
     - Fresh **Sample** selection: consecutive trials for the same language never repeat the same `sampleId` until the pool is exhausted.
     - Feedback payload accuracy: matching **Tells** are identified with character spans in the **Sample**, translation, and covered **Candidate Countries** (excluding `none`-coverage countries from playable answers).
     - Stage 2 Triggered **Contrast Card**: confusing Language A with Language B twice triggers a side-by-side comparison trial for A vs B.
     - **Guided Breakdown**: invoking `requestGuidedBreakdown()` returns the breakdown explanation + highlighted **Tells**, records the trial as assisted (preventing false promotion to `mastered`), and queues follow-up trials for that skill.
     - **Mastery State** transitions: `unseen` → `learning` → `recognized` (accurate untimed) → `mastered` (4 of 5 correct, last 3 consecutive correct under the fluency RT ceiling without assistance).
2. **Persistence Seam — `ProgressStore` & Disk JSON Serialization**:
   - Verifies that saving trial history and confusion counts persists valid JSON to the disk store path (`data/progress.json`), survives reload, and validates/rejects malformed backup imports cleanly.
3. **Dataset Integrity Seam**:
   - Verifies that every **Language Group** has ≥3 confusable languages with multiple unique **Samples** (`sentence` and `sign`) and valid **Tells**, and every `candidateCountryId` resolves to a valid `PlayableCountry` with `coverageTier !== 'none'`.

## Out of Scope

- User accounts, cloud authentication, or remote multi-user leaderboards.
- Redistributing proprietary Google Street View panorama photographs (all road/driving-side guides use original vector diagrams and authentic text signage).
- Live LLM API calls at runtime (all corpora and **Tells** are bundled offline).
- Non-v1 visual clue sections that require photographic datasets (utility poles, bollards, license plate blurs, car antennas), which can be added as future **Sections** on top of the shared `PlayableCountry` schema.

## Further Notes

- Respects `GLOSSARY.md` terms (**Section**, **Dashboard**, **Language Group**, **Sample**, **Tell**, **Contrast Card**, **Guided Breakdown**, **Mastery State**, **Playable Country**, **Coverage Tier**, **Candidate Countries**) and ADRs `0001`–`0003`.
