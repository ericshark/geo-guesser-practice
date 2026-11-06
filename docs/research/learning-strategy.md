# Training fast written-language recognition: research report

> Compiled by a research agent using web search, which only returned paper summaries; the full texts weren't read. Figures marked **(unverified)** came from those summaries. The plan below is mostly **extrapolated**: we found no controlled study of training people to recognize written languages.

## 1. Perceptual Learning Modules (PLMs) and ARTS
- **PLMs** are many short, timed "which category is this?" trials, each using a *new* example, with immediate feedback. They train two things: noticing which features matter, and processing them quickly and effortlessly. Explaining rules is secondary. Kellman, Massey & Son 2010, *TopiCS* 2:285 (doi:10.1111/j.1756-8765.2009.01053.x); Kellman & Massey 2013.
- **Aviation:** about 1 hour of PLM training brought novices to the accuracy of pilots with 500–2,500 hours of experience, often with faster responses. Kellman & Kaiser 1994, *Proc. HFES* 38.
- **ECG reading:** large gains in accuracy and fluency (fluent = correct in under 15 s). The gains were still there about 1 year later. Krasne et al. 2020, *AEM Educ Train* 5:e10454 (doi:10.1002/aet2.10454).
- **Histopathology/dermatology:** a category was retired once answered correctly ~3 times in a row, each in under ~12 s **(unverified)**. Krasne et al. 2013, *J Pathol Inform* (doi:10.4103/2153-3539.123991).
- **ARTS** (Adaptive Response-Time-based Sequencing) decides what to show next. Mettler, Massey & Kellman 2011 (CogSci); Mettler, Massey & Kellman 2016, *JEP:General* 145:295.
  - Each category gets a priority score: `P = a(N − D)[ b(1−α)·log(RT/r) + αW ]`.
  - Terms: N = trials since the category was last shown; D = enforced delay; α = 1 after an error, 0 after a correct answer; W = a large error weight; RT = response time.
  - Effect: missed categories come back right after the delay. Slow correct answers come back sooner than fast ones, and fast correct answers are spaced out further.
- **Mastery** requires both accuracy and speed: n of the last m answers correct, each under a response-time ceiling. One example is "4 of the last 5, each under 6.5 s" **(unverified)**.
- **Adaptive beats fixed schedules:** ARTS outperformed fixed expanding spacing, fixed equal spacing, and "yoked" schedules (another learner's adaptive schedule replayed). So the benefit comes from adapting to each individual.
- **Closest analogue to this app:** Mettler & Kellman 2014, *Vision Research* 99:111 (doi:10.1016/j.visres.2013.12.009). Learners classified 12 butterfly genera, seeing a new image on every trial. ARTS was more efficient than random order.

## 2. Interleaving vs blocking
- **Interleaving** means mixing categories within a practice session; **blocking** means practicing one category at a time.
- Kornell & Bjork 2008 (*Psych Sci* 19:585): interleaving painters improved classification of new paintings. Most learners still *believed* blocking worked better, so the schedule shouldn't follow learner preference.
- **Why it works:** seeing an item right next to one from a different category makes the difference stand out ("discriminative contrast"). Spacing alone doesn't explain it. Birnbaum et al. 2013, *Mem Cogn* 41:392 (doi:10.3758/s13421-012-0272-7). Showing items side by side worked as well as interleaving (Kang & Pashler 2012, *Appl Cogn Psych* 26:97).
- **Meta-analysis:** Brunmair & Richter 2019, *Psych Bull* 145:1029 (doi:10.1037/bul0000209).
  - Overall interleaving benefit: g = 0.42; for paintings, g ≈ 0.67.
  - For word lists it reversed: g ≈ −0.39, meaning blocking was better.
  - Interleaving helps more when categories are similar to each other and when examples within a category vary.
- **When blocking helps:**
  - When categories are easy to tell apart and the hard part is learning what members have in common (Carvalho & Goldstone 2014, *Mem Cogn* 42:481).
  - For rule-based categories. Interleaving helps more for "information-integration" categories, which are learned by overall impression rather than a statable rule (Noh et al. 2016, *Cognition* 155:23).
  - Blocked-then-interleaved hybrids also performed well (Yan et al. 2017, *JEP:Applied* 23:403).
- **For this app:**
  - Interleave *within* a group of easily confused languages (e.g., Thai/Lao/Khmer).
  - A short blocked warm-up is fine when a language is new.
  - Mixing very different groups (e.g., Thai with Polish) adds little, though it's harmless as review.

## 3. Explicit tells vs implicit exposure
- A **tell** is a distinguishing feature, such as a character only one language uses.
- **Pointing out tells helps and doesn't cancel the interleaving benefit:** highlighting diagnostic features while interleaving examples improved category learning (Eglington & Kang 2017, *JARMAC* 6:475).
- **Telling learners what to look for is a shortcut:** starting with easy examples and moving to hard ones only helped when learners didn't know which feature mattered. Telling them removed the need (Pashler & Mozer 2013, *JEP:LMC* 39:1162). Starting with clear, typical examples also helps (Hornsby & Love 2014, mammograms).
- **Side-by-side contrast cards** make differences stand out because the learner compares aligned pairs (Gentner & Markman 1994, *Psych Sci* 5:152). Example: Czech ř/ů vs Slovak ä/ô/ĺ.
- **Extrapolation — two kinds of cue:**
  - **Explicit rules:** most tells are single characters (ß, ő/ű, ł, ř, ы vs і/ї). These can be stated in words, and instruction speeds learning.
  - **Overall impression ("gestalt"):** cues like the texture of Chinese/Japanese/Korean text, Hangul's circles vs kana's curves, or how dense Thai looks compared with Lao. These need many varied examples.
  - **Caveat:** short signs often contain no tell. The learner also needs gestalt recognition and **absence** reasoning, e.g., no ł/ą/ę makes Polish less likely.

## 4. Feedback
- **Give feedback immediately and keep it about the task.** Delayed feedback hurt gestalt-type learning but not rule-based learning (Maddox, Ashby & Bohil 2003, *JEP:LMC* 29:650). Aim for feedback within about 500 ms.
- **Explain, don't just mark right or wrong.** For complex material, showing the correct answer and why works better than right/wrong alone (Shute 2008, *RER* 78:153). Feedback aimed at the person rather than the task can backfire (Kluger & DeNisi 1996).
- **Triggered side-by-side comparisons:** when a learner keeps confusing A and B, insert a trial showing A next to B. This reached mastery in fewer trials than random comparisons. The evidence is only conference abstracts (Jacoby, Massey & Kellman, *Journal of Vision*, faces and dermatology).

## 5. Spaced repetition for categories
- Spacing helps category learning, not just memorizing facts (Vlach, Sandhofer & Kornell 2008, *Cognition* 109:163).
- **Schedule each language (or confused pair), not each individual example, and show a fresh example every time.** This is how category-level ARTS works, and variety helps (§2). Repeating the same example teaches that example, not the category.
- **FSRS and SM-2** (common spaced-repetition schedulers) were designed for individual facts.
  - Reasonable for long-term review of retired languages, over days to weeks.
  - Within a session, use ARTS-style priority instead, over trials to minutes.
  - This split is our extrapolation; no study compares FSRS and ARTS for perceptual categories.

## 6. Adapting to the learner's confusions
- ARTS boosts each category after an error. Triggered comparisons extend this to specific confused pairs. Roads & Mozer 2017 (*Cog Sci* 41:1394) used similarity models to choose useful contrasting examples.
- Choosing trials directly from a full **confusion matrix** (a table of which languages get mistaken for which) is a reasonable extension, but there is little direct evidence for it.

## 7. Speed and automaticity
- Instance theory (Logan 1988, *Psych Rev* 95:492): automatic recognition comes from retrieving many stored examples. Response time falls along a power curve with practice. Each input must consistently map to the same answer. Many varied examples mean many stored instances.
- **Response-time ceilings** in PLMs are set per domain: 15 s (ECG), ~12 s (histology, **unverified**), 2–5 s (simpler math PLMs, **unverified**).
- There is no published ceiling for recognizing scripts. **Extrapolated suggestions:**
  - Script family (Latin, Cyrillic, …): under 1.5 s.
  - Language within a group of similar languages: under 2.5–3 s.

## 8. Training people to identify scripts and languages
- We found no controlled study of training people to identify written languages, so all of the above is extrapolated.
- Automatic language identification by computer gets high accuracy from short character sequences and diacritics (Cavnar & Trenkle 1994). That suggests a few tells carry much of the signal. This is an engineering analogy, not evidence about human learners.

## Recommended learning loop

**Stage 0 — Prime (2–5 min per language group, once).** Show one contrast card with the group's languages side by side. For each language: 2–4 highlighted tells, the countries it's used in, and one line on how to tell it from its closest neighbour.

**Stage 1 — Warm-up (new languages only).** Show 3–4 easy, typical examples per language, one language at a time, with tells highlighted. Then switch to interleaving.

**Stage 2 — Interleaved drill (the core).**
- **Each trial:** a fresh sign or sentence. The choices are the group's languages, plus the occasional distractor from another group.
- **Choosing the next language:** use the ARTS priority score with an enforced delay of 2 trials. Weight errors much more heavily than slow answers. Fast correct answers push a language further back.
- **Confusion boost:** after 2+ cases of answering B when the answer was A, within the last ~10 trials:
  - insert a side-by-side A|B trial ("which is Slovak?");
  - then bias the next 3–5 trials toward A and B.
- **Feedback, shown immediately** as correct or incorrect. On an error, show:
  - the correct language and the countries it's used in;
  - the tell, highlighted inside the sample;
  - the tell of the language the learner picked, for contrast;
  - a "gestalt cue: …" note when the sample has no tell.
- **Retiring a language within a session:** 4 of the last 5 correct, including the last 3, each faster than the ceiling.
  - Ceiling: under 3 s for most groups.
  - Under 4 s for Latin-script groups that differ mainly by diacritics.
  - Under 1.5 s at the script-family stage.
  - These are extrapolated. An alternative is an adaptive ceiling: 1.5× the learner's median correct response time on already-retired languages.

**Stage 3 — Long-term review.** Retired languages move to a spaced schedule per language (FSRS is fine), with a fresh example each review. A miss, or an answer slower than the ceiling, sends the language back to Stage 2. Mixed reviews across all groups check that recognition holds up outside the group.

**Order of training:** script family (Latin / Cyrillic / Chinese-Japanese-Korean / Southeast Asian scripts / Arabic …) → language within the group → country. Each level unlocks only after the one before it is mastered.

## Alternatives
1. **Tells-first course:** study a list of features, then drill.
   - Pro: fastest early gains on signs that contain tells.
   - Con: weaker on short signs with no tell and on gestalt-heavy groups (Chinese/Japanese/Korean, Thai/Lao/Khmer). Remembered rules fade without drilling.
2. **Pure implicit drill:** no tells, just classify and get feedback.
   - Pro: closest to Kellman's approach and builds gestalt recognition.
   - Con: slower to discover single-character tells that one sentence of instruction would give (Pashler & Mozer 2013). Best for learners who already know the tells.
