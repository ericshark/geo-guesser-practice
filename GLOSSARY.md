# GeoGuessr Practice

A personal, local-only training app for recognizing GeoGuessr clues fast. Each kind of clue is practiced in its own Section, and progress is tracked toward instant, unaided recognition.

## Structure

**Section**:
A top-level practice area dedicated to one kind of clue: **Languages**, **Driving Side**, **Coverage**, and **Domains & Currencies**. New Sections can be added over time.
_Avoid_: Topic, category, module

**Dashboard**:
The home screen summarizing every Section's practice volume, Mastery distribution, and top confusion pairs.
_Avoid_: Overview, home

## Languages

**Language Group**:
A set of languages that look alike and are practiced against each other (e.g., East Asian: Japanese, Korean, Simplified Chinese, Traditional Chinese).
_Avoid_: Category, family (a linguistic family is not the same as a visual confusion set)

**Sample**:
A piece of real text in one language shown as a prompt. A Sample is either a **Sentence** or **Sign Text** (street-sign or shop-sign style wording).
_Avoid_: Example, phrase, card

**Tell**:
A specific, explicit feature inside a Sample that points to a language (e.g., `ß` → German, `ő/ű` → Hungarian, `-ij-` → Dutch).
_Avoid_: Hint, clue, giveaway

## Learning & Progress

**Contrast Card**:
A side-by-side comparison of two or more confusable languages (shown as a quick Prime before a Language Group, or triggered automatically when the learner confuses Language A with Language B twice).
_Avoid_: Cheat sheet, duel

**Guided Breakdown**:
An on-demand overlay ("Show me what to look for") during a question that highlights the Tells on the current prompt, explains how to narrow down the choices, and queues immediate follow-up practice on that feature.
_Avoid_: Hint, give up

**Mastery State**:
One of four progression levels for a skill item: **Unseen**, **Learning**, **Recognized** (accurate untimed), or **Mastered** (accurate and answered within the fluency response-time threshold without assistance).
_Avoid_: Rank, Elo, score

## Geography

**Playable Country**:
A country or distinct GeoGuessr territory (e.g., Hong Kong, Macau, Puerto Rico, Faroe Islands, Réunion) represented by a single shared record containing its Coverage Tier, Driving Side, Languages on signs, Domain, and Currency.
_Avoid_: Nation, state

**Coverage Tier**:
Whether a country has **Official** (broad road Street View), **Limited** (partial regions, select cities, or trekker-only), or **None** (no playable Street View coverage).
_Avoid_: Availability

**Candidate Countries**:
The set of Playable Countries with Official or Limited coverage consistent with an observed clue (e.g., left-hand traffic + Thai script → Thailand).
_Avoid_: Possible countries, options
