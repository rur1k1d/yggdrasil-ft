# Contributing to Yggdrasil_ft

Thanks for wanting to help. This project builds an **offline-first** family-tree
app; two rules override everything else.

## The two rules

1. **Privacy first.** Family data is confidential. Nothing in the app may send
   data anywhere — no network calls, no telemetry, no third-party scripts or
   fonts. See `docs/privacy.md`.
2. **Never commit real personal data.** No real names/dates/places, no `.ged`
   files, no scans, no exports. `data/`, `vault/`, `*.ged`, `*.gedcom` and
   exported `*.json` are git-ignored; use the fictional seed
   (`data/seed/sample-family.json`) for examples, tests and screenshots.

## Workflow

1. Fork, or use **Use this template** on GitHub.
2. `npm install` → `npm run dev`.
3. Branch: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
5. Run the gates before opening a PR:

```bash
npm run lint        # biome check
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # must succeed
```

## Style

- TypeScript strict, no `any` without a comment explaining why.
- Components are plain functions; state lives in the store (`src/store`), not in
  ad-hoc globals.
- All user-visible strings go through `src/i18n` (`pl.ts` / `en.ts`) — no
  hardcoded UI text.
- English for code, comments, commit messages, docs. UI copy PL + EN.
- Commits: `feat: …`, `fix: …`, `docs: …`, `test: …`, `chore: …`.

## Accessibility

- Keyboard reachable everywhere; the tree must be navigable without a mouse.
- Respect `prefers-reduced-motion`.
- Contrast: no text below 4.5:1 on its background.

## Adding a research template

Templates live in `src/data/research-templates.ts` and are documented in
`research_templates.md`. A template is data, not code: title, `appliesTo`,
`covers`, ordered questions, `whereToLook[]`, `expectedDocs[]`. Keep the wording
practical ("request fond X, opis Y, sprava Z"), not generic advice.

## Reporting security/privacy issues

Do **not** open a public issue for a privacy leak or data-loss bug — see
`SECURITY.md`.
