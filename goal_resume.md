# Yggdrasil_ft — goal_resume (tracker + resume prompt)

> Offline-first **family-tree web app** with a research TODO board.
> Repo target: **`rur1k1d/yggdrasil-ft`** (MIT). Local-only data — no server, no accounts.
> Docs in English; app UI PL+EN. Reuses the Planner store/templates patterns.
> **Status: P0+P1 done (docs + skeleton). Resume at P2.**

## Goal (one sentence)

Give anyone a download-and-go structure to build a family tree in the browser —
person/relation model, SVG tree, sources with archival references, and a
research-TODO board that tracks where ancestors still need to be found — fully
offline, with all personal data stored **locally and confidentially**.

## Read first

- `projects/Yggdrasil_Project/plan.md` — scope, non-goals, stack, phases, gates
- `projects/Yggdrasil_Project/data_model.md` — entities + storage envelope
- `projects/Yggdrasil_Project/research_templates.md` — research checklist templates
- `projects/Yggdrasil_Project/docs/gedcom.md` — 5.5.1 import/export scope
- `projects/Yggdrasil_Project/docs/privacy.md` — confidentiality rules
- Reference patterns (read-only): `projects/Planner_App_Project/data_model.md`,
  `.../templates_spec.md`, `src/scripts/planner/store.ts`, `export-md.ts`

## Locked decisions (2026-10-19)

| Topic | Decision |
|---|---|
| Repo | `yggdrasil-ft`, public, **MIT © 2026 Ivan Kryvosheyev**, `main` |
| Stack | Vite 7 + TS (strict) + **Preact 10** + `@preact/signals`, npm |
| Storage | `localStorage` **`yggdrasil_ft_v1`** — one versioned doc, Planner store pattern (schema/migrate/safeParse/subscribe + in-memory fallback) |
| Offline | PWA via `vite-plugin-pwa` (app shell cached, installable) |
| Tree | own generation layout + inline SVG (pan/zoom, keyboard) |
| Interop | JSON (P1) · Markdown (P3) · **GEDCOM 5.5.1 (P5)** |
| Tooling | Biome + `tsc --noEmit` + Vitest |
| Delivery | GitHub Actions → GitHub Pages demo, repo as Template |
| **Data** | **local-only, no telemetry, real data NEVER committed** (fictional seed only) |
| Accounts/sync | **out of scope** (confidentiality rules out any cloud path; encrypted local vault only, P7) |

## Constraints (house rules)

- Files/docs/comments in **English**; UI copy **PL+EN**, no hardcoded strings.
- Real family data never leaves the machine and is never committed
  (`data/`, `vault/`, `*.ged` are git-ignored).
- No third-party scripts/fonts/CDNs in the app (offline + privacy).
- After each phase: run the gates, tick the phase here, append **Evidence** + **Log**.

## Deliverables (file map)

```
projects/Yggdrasil_Project/
  plan.md  goal_resume.md  README.md  data_model.md  research_templates.md
  LICENSE  .gitignore  CONTRIBUTING.md  SECURITY.md
  docs/  gedcom.md  privacy.md  [P1+] architecture.md
  data/seed/            fictional sample tree (real data git-ignored)
  src/                  [P1+] model/ store/ io/ views/ components/ styles/ i18n/
  tests/                [P1+] vitest suites ([P5] gedcom round-trip)
  .github/workflows/    [P6] ci.yml  deploy.yml
```

## Phases (status tracker)

- [x] **P0 — Docs + meta + privacy rules + git-ignore.** No code yet.
      *Verify:* files exist and are mutually consistent; `.gitignore` blocks real
      data while allowing the fictional seed; seed JSON valid.
      Evidence (2026-10-19 — line counts): `plan.md` (205), `goal_resume.md` (131),
      `data_model.md` (193), `research_templates.md` (115), `README.md` (69),
      `docs/gedcom.md` (60), `docs/privacy.md` (49), `CONTRIBUTING.md` (56),
      `SECURITY.md` (39), `LICENSE` (MIT, © 2026 Ivan Kryvosheyev, 21),
      `.gitignore` (66), `data/seed/sample-family.json` (fictional, 174 ln:
      4 persons / 1 family / 2 sources / 3 tasks / 1 note; sourceIds and family
      links verified). `.gitignore` proven with a `git check-ignore` matrix:
      `data/*`, `vault/`, `*.ged`, `exports/`, scans, `dist/`, `node_modules/`
      **BLOCKED**; `data/seed/sample-family.json`, `public/icons/**` and
      `docs/img/**` allowed (hence `data/*` + `!data/seed/**`, because git cannot
      re-include files under an ignored parent directory). Enums cross-checked
      across docs (`Sex`, `FamilyType`, `TaskStatus`, `TaskPriority`,
      `PersonConfidence`, `PersonResearch` are used by the entities).
- [x] **P1** Skeleton + offline: Vite/Preact/TS + Biome + Vitest, tokens, hash
      router, i18n PL/EN, store (`yggdrasil_ft_v1`, schema+migrate+safeParse+
      fallback), seed loader, JSON export/import, PWA (manifest + SW).
      *Verify:* `biome check` clean · `tsc --noEmit` 0 · Vitest green ·
      `build` OK · **offline load of `dist`** OK · JSON round-trip test ·
      0 console errors.
      Evidence (2026-10-19): `npx biome check .` = 24 files, 0 errors, exit 0 ·
      `npx tsc --noEmit` exit 0 · `npx vitest run` = 3 files, **22/22** (store 14
      · JSON round-trip 6 · i18n parity 2) · `npm run build` exit 0 (PWA
      `generateSW`, **9 unique precache entries**, no duplicates) · CDP probe
      (`npm run probe` → `scripts/pwa-probe.mjs`, headless Chromium, server
      **killed mid-run**) = **PROBE PASS**: online + offline boots with SW
      control both true, `consoleErrors []`, `exceptions []`,
      `externalRequests []`, all traffic `127.0.0.1:4173` · static scan of
      `src/` + `index.html` = zero external URLs. Key files: `src/model/*`,
      `src/store/{store,seed}.ts`, `src/io/json.ts`, `src/{app.tsx,router.ts}`,
      `src/i18n/*`, `src/styles/*`, `public/icons/*`, `vite.config.ts`,
      `scripts/pwa-probe.mjs`, `tests/{store,json,i18n}.test.ts`.
- [ ] **P2 — People + relations + tree.** Person CRUD, relation editor
      (parent/child/partner), SVG tree (pan/zoom, keyboard), search, validation
      warnings (cycles, impossible dates, duplicates).
      *Verify:* create/edit persist across reload · warnings fire · a11y focus
      order · Vitest invariants · 0 console errors.
- [ ] **P3 — Research TODO board.** Task CRUD + templates instantiator + per-person
      research panel + progress stats + markdown export.
      *Verify:* template → tasks · markdown matches fixture · Vitest.
- [ ] **P4 — Sources, citations, reports.** Source registry, citations on facts,
      confidence, per-person Markdown/print report, privacy mode (mask living).
      *Verify:* citation integrity tests · print CSS audit · masking works.
- [ ] **P5 — GEDCOM 5.5.1.** Import/export + mapping table + round-trip test.
      *Verify:* import→export→import idempotent on fixture · limits documented.
- [ ] **P6 — Release polish.** i18n complete, empty states, responsive, a11y,
      Lighthouse installable PWA, GitHub Pages demo, repo as Template, README
      screenshots (fictional data), topics, tag `v0.1.0`.
      *Verify:* CI green · Pages demo works offline after first visit.
- [ ] **P7 — Later options.** Photos/scans (IndexedDB), timeline + map, DNA segment
      notes, encrypted export vault (user passphrase, local only), optional
      Portfolio sample page.

## Data model (v1)

`Person · Family · Source · ResearchTask · Note · Settings` in one versioned doc
`{ schema: 1, updatedAt, settings, persons, families, sources, tasks, notes }`
(localStorage key `yggdrasil_ft_v1`). Invariants on write: no ancestry cycles,
no impossible dates, referential integrity of `sourceIds`, duplicate warnings.
Full fields: `data_model.md`.

## Research templates

parish/registry records · census · military records · migration/emigration ·
DNA-match triangulation · cemetery/monument photos · archive query letters.
Each = title + scope + ordered questions + "where to look" hints + expected
documents → instantiates `ResearchTask[]`. Details: `research_templates.md`.

## Verify harness (per phase)

`npx biome check` · `npx tsc --noEmit` · `npx vitest run` · `npm run build` ·
serve `dist` (preview) and load with network disabled (offline gate) ·
0 console errors · keyboard-only pass on new views · print CSS check (P4+).

## Next action

**P2 — People + relations + tree.** Person CRUD, relation editor
(parent/child/partner), SVG tree with pan/zoom + keyboard nav, search,
validation warnings (ancestry cycles, impossible dates, duplicates), fictional
demo tree browsable. Run the phase gates on the new views and append Evidence.

## Log

- 2026-10-19 — Project created; name chosen **`yggdrasil-ft`** (GitHub check:
  `Yggdrasil` heavily taken, incl. two GEDCOM viewers; `yggdrasil-ft` free).
  Stack + decisions locked; **P0 docs written** (`plan.md`, `data_model.md`,
  `research_templates.md`, `docs/gedcom.md`, `docs/privacy.md`, `README.md`,
  `LICENSE`, `.gitignore`). Commander's ruling: **data stays local because it is
  confidential** — no accounts/sync phase, real data never committed.
- 2026-10-19 — **P0 verified.** All 12 P0 files written and cross-checked; seed
  `data/seed/sample-family.json` valid (4 persons / 1 family / 2 sources / 3 tasks
  / 1 note, links OK); `.gitignore` proven with a `git check-ignore` matrix (real
  data blocked, fictional seed + app icons + docs images allowed). Also added in
  this pass: `CONTRIBUTING.md`, `SECURITY.md`, `data/seed/sample-family.json`.
  **Paused on commander's request — resume at P1 when we come back to it.**
- 2026-10-19 — **P1 done (skeleton + offline).** Scaffolded Vite 7.3.7 + Preact
  10.29.8 + TS strict + Biome + Vitest (versions locked per plan); app shell
  (hash router, dark Norse tokens, i18n PL/EN with type-enforced key parity and
  zero hardcoded UI strings); store `yggdrasil_ft_v1` (schema/migrate/
  safeParse/subscribe, seed on first run, corrupt → in-memory empty with raw
  preserved, quota/no-storage fallbacks) + seed loader; JSON export/import with
  round-trip test; PWA via `vite-plugin-pwa` `generateSW` (9-entry precache,
  PIL-generated icons + favicon, installable manifest). Added
  `scripts/pwa-probe.mjs` — zero-dependency CDP probe (Node 24 global
  WebSocket) that kills the preview server mid-run and proves offline boot
  under SW control with 0 console errors and 0 external requests. All gates
  green — see Evidence above. Next: **P2 (people + relations + tree)**.
