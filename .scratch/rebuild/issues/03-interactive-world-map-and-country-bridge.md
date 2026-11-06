# 03: Interactive World Map & Stage 3 Language → Candidate Countries Bridge

**What to build:** Build the offline interactive vector world map component with regional zoom presets and clickable pill markers for small GeoGuessr territories and islands, and integrate it into **Stage 3 Language → Country Bridge** trials so that once a learner recognizes a language fluently, they practice clicking or selecting all of its covered **Candidate Countries** on the map.

**Blocked by:** 01: Foundation — Playable Country & Language Corpus Dataset + Local File Persistence + Dashboard & Languages Speed Drill

**Status:** ready-for-agent

- [ ] Bundled, offline vector world map renders all **Playable Countries** cleanly in both light and dark modes with smooth regional zoom presets (`World`, `Europe`, `Asia`, `South & SE Asia`, `Africa`, `Southern & Eastern Africa`, `Oceania`, `Americas`).
- [ ] Small GeoGuessr territories and microstates (e.g., Hong Kong, Macau, Singapore, Malta, Cyprus, Luxembourg, Andorra, Monaco, San Marino, Faroe Islands, Gibraltar, Bermuda, U.S. Virgin Islands, Puerto Rico, Curaçao, Réunion, Christmas Island) have clear, accessible clickable pill markers on the map.
- [ ] When a language reaches `recognized` or `mastered` status, `PracticeEngine` interleaves **Stage 3 Language → Country Bridge** trials asking the learner to click or select all Street View-covered **Candidate Countries** for that language on the interactive map.
- [ ] Submitting a map selection highlights correct selections in emerald, missed **Candidate Countries** in amber, and incorrect clicks (including uncovered countries) in rose, while showing informational footnotes for notable non-covered countries where that language is spoken.
- [ ] Tests at the `PracticeEngine` seam verify **Stage 3 Bridge** trial generation and multi-country map answer validation.
