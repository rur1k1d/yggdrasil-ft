# Yggdrasil_ft — goal_resume (tracker + resume prompt)

> Offline-first **family-tree web app** with a research TODO board.
> Repo target: **`rur1k1d/yggdrasil-ft`** (MIT). Local-only data — no server, no accounts.
> Docs in English; app UI PL+EN. Reuses the Planner store/templates patterns.
> **Status: P0–P5 done (P2–P5 code still uncommitted). P6 in progress — work the
> P6.0–P6.11 checklist below in order.**

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
| Commit identity | `rur1k1d <rur1k1d@proton.me>` repo-local; domain email never appears in history |
| Publication | public repo + GitHub Pages demo; **no domain, no site URL, no domain email anywhere** |

## Constraints (house rules)

- Files/docs/comments in **English**; UI copy **PL+EN**, no hardcoded strings.
- Real family data never leaves the machine and is never committed
  (`data/`, `vault/`, `*.ged` are git-ignored).
- No third-party scripts/fonts/CDNs in the app (offline + privacy).
- After each phase: run the gates, tick the phase here, append **Evidence** + **Log**.
- Never publish `pentestit.pl`, the portfolio site URL, `dev@pentestit.pl`, `ik@…`
  or any other domain email: not in commits, README, `package.json`, topics or the
  repo homepage. Demo link = GitHub Pages only. `LICENSE` keeps
  `MIT © 2026 Ivan Kryvosheyev` (author name is intended).
- Screenshots for the README go to **`docs/img/`** only. `.gitignore` ignores
  `*.png`/`*.jpg` globally with allow-listed exceptions (`public/icons/**`,
  `docs/img/**`, `data/seed/img/**`).
- Irreversible steps (repo create, push, Pages enable, tag/release) require one
  explicit go-ahead at the P6.11 gate.

## Phases (status tracker)

- [x] **P0** Docs + meta + privacy rules + git-ignore.
- [x] **P1** Skeleton + offline
- [x] **P2** People + relations + tree
- [x] **P3** Research TODO board
- [x] **P4** Sources, citations, reports (Source registry, citations on facts, confidence, per-person Markdown/print report, privacy mode)
- [x] **P5** GEDCOM 5.5.1
- [ ] **P6** Release polish (checklist below)
- [ ] **P7** Later options

## P6 checklist — release polish (goal items, in order)

State when written (2026-10-23): P2–P5 code complete but **uncommitted**; only two
commits exist (P0, P1), both authored `Ivan <dev@pentestit.pl>`; no remote;
`rur1k1d/yggdrasil-ft` does not exist yet.

- [ ] **P6.0 Baseline** — start `npm run dev`, review the app with the fictional
      seed, then run `npm run verify` + `npm run probe`; record exact numbers.
- [ ] **P6.1 Identity rewrite** — rewrite P0/P1 author+committer to
      `rur1k1d <rur1k1d@proton.me>` with dates preserved
      (`git filter-branch --env-filter`; `git-filter-repo` is not installed).
      Verify `git log --format='%an <%ae> | %cn <%ce>'` shows zero
      `dev@pentestit.pl`.
- [ ] **P6.2 Commit P2–P5** — 2–4 semantic commits (`feat(p2)`… or grouped by
      module); leave the working tree clean.
- [ ] **P6.3 Privacy gate** — `git status` shows only intended files; ignore
      matrix (`data/*` except seed, `vault/`, `*.ged`, `exports/`, `dist/`,
      `node_modules/`); scan tracked files for real personal data, emails,
      phones, absolute paths and our domain; only the fictional seed may ship.
      Stop and report on any finding.
- [ ] **P6.4 i18n** — nested EN/PL key parity test, hardcoded-string scan,
      natural-Polish pass (pl-translation-reviewer).
- [ ] **P6.5 Empty states** — empty tree, no search results, empty research
      board, empty sources, empty IO.
- [ ] **P6.6 Responsive** — 320/360/390/768/1024/1440, zero horizontal overflow,
      phone-usable tree; add `scripts/ui-probe.mjs` (zero-dep CDP, same style as
      `scripts/pwa-probe.mjs`) with EN+PL screenshots.
- [ ] **P6.7 a11y** — focus order, labels, AA contrast on new surfaces, reduced
      motion, `aria-live` on dynamic content, keyboard-only pass.
- [ ] **P6.8 PWA base-safe** — relative `start_url`/`scope`/`navigateFallback`
      and icon paths; installable; offline-after-first-visit probe PASS.
- [ ] **P6.9 CI + Pages** — `.github/workflows/ci.yml` + `deploy.yml`;
      `base: "/yggdrasil-ft/"` for CI builds; verify `dist` under a
      `/yggdrasil-ft/` mount locally.
- [ ] **P6.10 README + meta** — fix the stale "P0, no app code" status;
      screenshots in `docs/img/` (fictional data only); features; install/dev;
      demo link (GitHub Pages only); topics; template-flag prep.
- [ ] **P6.11 Publish gate** — ask first. Then `gh repo create
      rur1k1d/yggdrasil-ft --public --source=. --remote=origin --push`
      (**no** `--license` overwrite), set topics, `is_template=true`, Pages
      `build_type=workflow`, `gh release create v0.1.0`. Verify live: SW active,
      offline reload, PL/EN switch, 0 console errors, 0 external requests.
      Update this file + `plan.md` + README.

**Done criteria:** gates green; ui-probe 0 overflow / 0 console errors in EN+PL;
PWA probe PASS online and offline; CI green; Pages live at
`https://rur1k1d.github.io/yggdrasil-ft/`; `v0.1.0` released; local tree clean;
zero real data and zero private-domain references anywhere.

## Agents to leverage
**Always consult `projects/AGENTS_SETTINGS/` proactively** (support only, never override rules). Use them throughout the work, not just when stuck:
- build-error-resolver + typescript-pro (TS/Vite/Preact)
- code-reviewer + commit-reviewer + pr-test-analyzer
- code-architect/architect
- security-reviewer + security-auditor (no secrets/leaks, local-only)
- spec-miner
- pl-translation-reviewer (PL/EN)
- technical-writer (reports/markdown/print)

## Next action

**P6 — Release polish, in the order of the checklist above.** Start with P6.0
(dev preview + baseline gates), then identity rewrite + commits + privacy gate,
then the polish items, and stop at P6.11 for the publish go-ahead. Keep
local-only, PL+EN, no hardcoded strings.

## Log

- 2026-10-19 — P0 done.
- 2026-10-19 — P1 done.
- 2026-10-20 — P2 done.
- 2026-10-20 — P3 done (templates instantiator, research board, progress stats, markdown export).
- 2026-10-20 — Starting P4.
- 2026-10-20 — P5 done. GEDCOM 5.5.1 import + export (`src/io/gedcom-{shared,export,import}.ts`), settings UI in `DataIO.tsx` (JSON/GEDCOM export+import, PL/EN keys, structured error codes), mapping + limitations as-built in `docs/gedcom.md`. Evidence: `tests/gedcom.test.ts` 13 tests (round-trip stability on `sample-family.json`, UTF-8/`@`-escape round-trip, empty-doc exact round-trip, gates empty/charset/gedcom7/syntax + unknown-vs-ignored report, purity); `npm run verify` exit 0 (biome 0 errors, tsc 0, 35/35 tests, vite build OK). Deviation: plan's "public test GEDCOM" replaced by synthetic malformed/UTF-8 fixtures — seed stays fictional-only; revisit with a public-domain file if interop gaps appear in P6.
- 2026-10-23 — goal_resume prepared for P6: ordered P6.0–P6.11 checklist, commit identity + publication rules, publish gate. Code P2–P5 is still uncommitted; history still needs the identity rewrite (P6.1).

## Resume prompt (copy/paste with /goal)
```
/goal Yggdrasil-ft P6 — polish + first public release (v0.1.0)
Read projects/Yggdrasil_Project/{goal_resume.md,plan.md,data_model.md,docs/}, then work the P6.0–P6.11 checklist in goal_resume.md in order.
Rules: files EN, UI PL+EN, local-only, never publish our domain/site/email, commit identity rur1k1d <rur1k1d@proton.me>, semantic commits, ask me at P6.11 before repo create/push/Pages/release. Proactively use projects/AGENTS_SETTINGS/. Update goal_resume.md Evidence/Log after each item.
```

## Evidence

- 2026-10-20 — P4 done. Sources, citations, reports: Source registry CRUD, citations on facts (sourceIds), confidence display, per-person Markdown report + print CSS, privacy mode (mask living). PL/EN, local-only. `tsc --noEmit` clean, `npm run build` OK.
- 2026-10-20 — P5 evidence: `npm run verify` exit 0 — biome 0 errors, `tsc --noEmit` 0, Vitest 35/35 (incl. `tests/gedcom.test.ts` ×13), `vite build` OK. Files: `src/io/gedcom-{shared,export,import}.ts`, `src/components/settings/DataIO.tsx`, `tests/gedcom.test.ts`, updated `docs/gedcom.md`, i18n `settings.io.*` (EN+PL), `tParams` in `src/i18n/t.ts`.
