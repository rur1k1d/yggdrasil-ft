# Yggdrasil_ft — project plan

> Repository: **`yggdrasil-ft`** (planned: `github.com/rur1k1d/yggdrasil-ft`, MIT).
> Local folder: `projects/Yggdrasil_Project/`.
> Files/docs/comments **English**; app UI **PL + EN**.
> Status: **v0.2.0 source, 2026-10-23.** The published v0.1.0 demo remains at
> https://rur1k1d.github.io/yggdrasil-ft/ until the next release is approved.
> Reports, print, Markdown export and privacy-mode masking exist as modules but
> are not exposed in the UI yet; see `README.md` for the honest feature list.

## 1. Goal (one sentence)

Give anyone a *download-and-go* structure to build a family tree in the browser:
person/relation model, an SVG tree canvas, a source registry with archival
references, and a **research TODO board** that keeps track of where ancestors
still have to be found — fully offline, single-file data, no backend.

The differentiator versus existing open-source GEDCOM viewers is the **research
workflow** (where do I still need to look?), not the chart drawing.

## 2. Confidentiality requirement (hard constraint)

Family data is **confidential by nature**. Therefore:

- **All data is stored locally only** — `localStorage` (v1) and, later, IndexedDB
  for attachments. There is **no backend, no account, no sync, no telemetry**,
  no analytics, no external fonts/CDN calls at runtime.
- **Real family data is NEVER committed** to the repository. `.gitignore`
> blocks `data/`, `vault/`, `*.ged`, `*.gedcom`, `*.json` dumps (see §4).
> Only a **fictional seed dataset** (`data/seed/sample-family.json`) is shipped.
- The published GitHub Pages build is the **empty app** (demo dataset only).
  Real trees stay on the user's machine, in their browser profile, or in files
  they export themselves.
> Design consequence: no accounts/sync phase — unlike the Planner, confidentiality
> rules out any optional cloud path for v1. An *encrypted file vault* (user-held
> passphrase, no server) may come later in P7.

## 2b. Non-goals (v1)

- No server, no accounts, no collaboration, no automatic record matching.
- No scraping of archives/Ancestry/MyHeritage (ToS + would need network).
- No DNA-processing math beyond notes/segment bookkeeping (P7 optional).
- No GEDCOM 7 (5.5.1 only; see `docs/gedcom.md`).

## 3. Locked decisions (2026-10-19)

| Topic | Decision |
|---|---|
| Repository | `yggdrasil-ft`, public, **MIT © 2026 Ivan Kryvosheyev**, branch `main` |
| Stack | **Vite 7 + TypeScript (strict) + Preact 10 + `@preact/signals`**, npm |
| Offline | **PWA** (`vite-plugin-pwa` / Workbox): app shell cached, installable, works offline |
| Storage | **localStorage `yggdrasil_ft_v1`** — one versioned JSON doc (Planner pattern: `schema`, `load/save/update/migrate/safeParse`, `yggdrasil-ft:change` event, in-memory fallback) |
| Tree rendering | own generation/row layout + **inline SVG** (pan/zoom, keyboard nav), no heavy deps |
| Interop | JSON (canonical) from P1 · **GEDCOM 5.5.1 import/export in P5** · Markdown export from P3 |
| Tooling | **Biome** (lint+format), `tsc --noEmit`, **Vitest** |
| Delivery | GitHub Actions → **GitHub Pages** live demo; repo marked as **Template** |
| Confidentiality | **local-only data, no telemetry, real data never committed** (sec. 2) |
| Seed data | fictional only (`data/seed/sample-family.json`) |

Reuse from the Planner (`projects/Planner_App_Project/`): the store envelope +
migration strategy (`data_model.md` sec. 1/6), the templates-spec approach
(`templates_spec.md`), markdown export, and the goal/gate discipline.

## 4. Privacy rules (hard)

1. `localStorage` is the only sink. Nothing is ever sent anywhere.
2. **Never commit**: `data/`, `vault/`, `*.ged`, `*.gedcom`, `*.json` exports,
   photos/scans, personal notes. `.gitignore` enforces this (added in P0).
3. The repo ships **only** fictional demo data plus the app code.
4. Screenshots in the README show the **fictional** dataset only.
5. Export files are written locally by the user (browser download); nothing
   is uploaded.
6. Living persons: a "privacy mode" toggle masks living individuals in
   screenshots/print (P4/P7).
7. No third-party scripts, fonts, analytics or CDNs in the app (all assets bundled).

## 5. Architecture

```
src/
  main.ts            bootstrap (mount + service-worker registration)
  app.tsx            root component, router outlet, theme/i18n provider
  router.ts          hash router (works offline / file:// style serving)
  model/             types.ts schema.ts migrations.ts validate.ts ids.ts
  store/             store.ts (load/save/update/migrate/safeParse/subscribe)
                     seed.ts (fictional sample tree + empty project)
  io/                json.ts  markdown.ts  [P5] gedcom-import.ts gedcom-export.ts
  views/             tree/  person/  research/  sources/  timeline/  settings/
  components/        dialogs, chips, forms, tables (generic, a11y-first)
  styles/            tokens.css  app.css  print.css
  i18n/              pl.ts  en.ts  t.ts (no hardcoded UI strings)
tests/               vitest: model, migrations, json, templates, [P5] gedcom round-trip
```

Data flow: `view -> store.update(mutator) -> validate -> persist(localStorage) ->
emit change -> re-render`. IO modules are pure (string in / string out) so they
are unit-testable without a browser.

## 6. Data model (v1 summary)

Full field list: `data_model.md`.

- `Person` — names (forename, surname, married/alt names), sex, life events
  (birth/christening/marriage/death/burial) with date+place+sourceIds, occupation,
  residence, notes, tags, `confidence`, `researchStatus`.
- `Family` — `partnerIds[]`, `childIds[]`, `type: marriage|partnership|unknown`,
  start/end dates + place, sourceIds.
- `Source` — registry: `type`, `title`, `repository`, `reference`
  (signatura / fond-opis-sprava), `url`, `accessedAt`, `quality`,
  `transcription`, `note`.
- `ResearchTask` — the differentiator: `subjectType: person|family|tree` +
  `subjectId?`, `question`, `hypothesis`, `whereToLook[]`,
  `status: open|done|blocked|dropped`, `priority: low|med|high`,
  `nextAction`, `sourceIds[]`, `outcome`, `templateId?`, `createdAt/updatedAt`.
- `Note` — free notes (`text`, `at`), loose links `personId?`/`familyId?`/`taskId?`.
- `Settings` — `locale`, `theme`, `privacyMode`, `dateFormat`, `surnameOrder`,
  `treeDirection`, `researchTemplates[]`.
- Envelope: `{ schema: 1, updatedAt, settings, persons, families, sources, tasks, notes }`.

Invariants validated on write: no cycles in ancestry, no impossible dates,
duplicate detection (same name+date warning), referential integrity of sourceIds.

## 7. Research templates (`research_templates.md`)

Parameterised checklists that create `ResearchTask` sets, e.g.:
parish/registry records (per region + period), census, military records,
migration/emigration, DNA-match triangulation, cemetery/monument photos,
archive query letters. Each template: title, target scope, ordered questions,
"where to look" hints, expected document types.

## 7a. Agents to leverage (from AGENTS_SETTINGS)

**Always consult `projects/AGENTS_SETTINGS/` proactively** (support only, never override rules). Use them throughout the phase, not just when stuck:
- `ecc-copied/code-reviewer.md` + `ecc-copied/commit-reviewer.md` + `ecc-copied/pr-test-analyzer.md` - pre-commit/review hygiene
- `ecc-copied/build-error-resolver.md` + `fetched-external/typescript-pro.md` - TS/Vite/Preact type/build issues
- `ecc-copied/code-architect.md` / `ecc-copied/architect.md` - structure for new modules/views
- `ecc-copied/security-reviewer.md` + `fetched-external/security-auditor.md` - ensure no secrets/data leaks (local-only)
- `ecc-copied/spec-miner.md` - clarify requirements from notes/specs
- `.opencode/agents/pl-translation-reviewer.md` - PL/EN UI consistency

## 8. Phases

- [x] **P0 — Docs + meta.** `plan.md`, `goal_resume.md`, `data_model.md`,
      `research_templates.md`, `README.md`, `docs/gedcom.md`, `docs/privacy.md`,
      `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, `.gitignore`,
      `data/seed/sample-family.json` (fictional).
      *Verify:* files exist and are mutually consistent; `.gitignore` blocks
      `data/`, `vault/`, `*.ged`; no code yet. **DONE 2026-10-19** (see
      `goal_resume.md` → Evidence).
- [x] **P1 — Skeleton + offline.** Vite/Preact/TS scaffold, Biome, Vitest,
      tokens, hash router, i18n PL/EN, store with schema+migrations+fallback,
      seed loader, JSON export/import, PWA (manifest + service worker).
      *Verify:* `biome check` clean, `tsc --noEmit` 0, `vitest` green, `build` OK,
      offline load of `dist` works (SW active), JSON round-trip test, 0 console errors.
      **DONE 2026-10-19** (see `goal_resume.md` → Evidence).
- [x] **P2 — People + relations + tree.** Person CRUD, relation editor
      (parent/child/partner), SVG tree with pan/zoom + keyboard nav, search,
      validation warnings, fictional demo tree browsable.
      *Verify:* create/edit/persist across reload; cycle + impossible-date warnings;
      a11y focus order; 0 console errors; Vitest model invariants.
      **v0.2.0 overhaul:** life dates, grouped relation editor, generation-card
      layout with SVG connectors, focal person via `#/tree/<id>`, drag-to-link
      dialog, unlinked tray, fit/full-screen, 8-person demo and 63 tests.
- [x] **P3 — Research TODO board.** Templates instantiator, progress stats, task
      list. *(Partial in v0.1.0: task editing and markdown export UI pending.)*
      *Verify:* template → tasks; markdown matches a fixed fixture; Vitest.
- [x] **P4 — Sources + citations + reports.** Source registry UI. *(Partial in
      v0.1.0: citations UI, per-person reports/print and privacy mode pending.)*
      *Verify:* citation integrity tests; print CSS audit; privacy masking.
- [x] **P5 — GEDCOM 5.5.1.** Import + export with mapping table and a
      round-trip test on the fictional fixture (plus one public test GEDCOM).
      *Verify:* import→export→import idempotent for supported subset; documented
      limitations; Vitest.
- [x] **P6 — Release polish.** i18n complete, empty states, responsive, a11y pass,
      PWA installable, GitHub Pages demo, repo as Template, README with
      screenshots (fictional data), topics, release `v0.1.0` (2026-10-23).
      *Verify:* CI green, mount + live probes PASS, Pages demo loads offline after
      first visit.
- [ ] **P7 — Later options.** Photos/scans (IndexedDB), timeline + place map,
      DNA segment notes, encrypted export vault (user passphrase, still local),
      optional Portfolio sample page using the same island.

## 9. Verify harness (per phase)

1. `npx biome check .` — clean.
2. `npx tsc --noEmit` — 0 errors.
- `npm test` (Vitest) — green, incl. migration + IO fixture tests.
- `npm run build` → `npx serve dist` (or `python3 -m http.server`) → **offline test**
  (DevTools offline / unplugged): app boots, data persists, SW active.
- 0 console errors/warnings; keyboard-only pass over the tree and forms;
  contrast check on new surfaces; no network requests after first load
  (Network tab: 0 external hosts).
- Update `goal_resume.md` (check the phase, append Evidence + Log line).

## 10. GitHub / release plan

1. `gh repo create rur1k1d/yggdrasil-ft --public --license mit --description "Offline-first family-tree builder with a research TODO board (local-only data)"`.
   *(Todo: `--license mit` writes a stock MIT file — we ship our own with the copyright line.)*
2. Topics: `genealogy`, `family-tree`, `gedcom`, `local-first`, `offline-first`,
   `pwa`, `preact`, `typescript`, `vite`, `privacy`, `mit`.
3. `.github/workflows/ci.yml` (lint/typecheck/test/build) + `deploy.yml` (Pages).
4. Settings → *Template repository* = on; README gets the live-demo link.
5. Naming note in README: unrelated to Yggdrasil Network (`yggdrasil-network/*`),
   and acknowledges prior art (`KeithPetro/Yggdrasil`,
   `marioparra/yggdrasil-opensource`) — we differ by being fully offline and
   research-TODO-centric.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Confidential data accidentally committed | `.gitignore` from P0, fictional-only seed, README warning, pre-commit scan note in CONTRIBUTING |
| `localStorage` limits (~5 MB) | v1 text-only; attachments go to IndexedDB in P7; export/backup reminder in UI |
| Data loss (browser clear) | prominent JSON export reminder + auto-download nudge (P4) |
| GEDCOM dialects vary | documented 5.5.1 subset + limitation list (`docs/gedcom.md`) |
| Tree layout complexity | own layout first; `d3-hierarchy` only if it proves necessary |
| Name collision | `-ft` suffix, distinct description/topics, README note |

## 12. Open questions (for when we resume)

1. Auto-backup nudge: how often should the app remind about a JSON export?
2. Should P7 encrypted vault use WebCrypto AES-GCM with a passphrase (default) —
   confirm no cloud even as an option?
3. *Resolved:* the fictional seed is Norse-themed (Yggdrasil-consistent).
4. *Resolved:* semantic versioning starts at `v0.1.0`; tags live in the repo.
