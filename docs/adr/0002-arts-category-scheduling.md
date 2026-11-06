# Schedule by skill and confusion pair using ARTS, not per-sample cards

Practice items are scheduled at the **skill level** (per Language, Playable Country, or Domain/Currency) and by **confusion pair** (e.g., Slovak ↔ Czech) using Adaptive Response-Time-based Sequencing (ARTS), while always drawing a fresh, unseen Sample on every trial.

## Context & Reason

Traditional flashcard schedulers (like FSRS or SM-2 per card) repeat the exact same prompt, which trains memorization of a specific sentence rather than perceptual recognition of the language. In GeoGuessr, you never see the same street sign twice, and recognition must be both accurate and fast (under ~3.5 seconds). ARTS uses both accuracy and response time to space out fluent skills, immediately re-test errors after a short delay, and trigger side-by-side Contrast Cards when two categories are repeatedly confused.
