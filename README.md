# GeoGuessr Academy

A local-first learning platform for getting better at GeoGuessr. A guided curriculum teaches the clues that identify countries (languages, driving side, Street View coverage, web addresses and prices, with road lines, signs, bollards, plates and more on the roadmap), then practice and spaced review make them stick.

## How it works

- **Learn**: a path of topics and short lessons. Each lesson introduces a few clues (what to look for, where it applies, what it is confused with), then asks questions that mix in look-alikes and due reviews.
- **Practice**: mixed questions from everything learned, optionally limited to a region.
- **Reference**: everything known about a country, with a button to practise just that country.
- Every clue is scheduled with FSRS, so weak and overdue clues return at the right time. See [docs/adr/0004](./docs/adr/0004-fsrs-per-clue-scheduling.md).

## Documentation

- [GLOSSARY.md](./GLOSSARY.md): domain vocabulary
- [docs/adr/](./docs/adr/): architectural decisions
- [docs/research/learning-strategy.md](./docs/research/learning-strategy.md): perceptual-learning research

## Scripts

```sh
npm run dev
npm test
npm run typecheck
npm run build
```

Progress is saved to `data/progress.json` by the dev server and mirrored in the browser (IndexedDB).
