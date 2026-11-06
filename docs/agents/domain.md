# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root
- **`docs/adr/`**: read ADRs that touch the area you're about to work in

## File structure

Single-context repo:

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-bundled-text-corpus.md
│   ├── 0002-arts-category-scheduling.md
│   └── 0003-local-file-persistence.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept, use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.
