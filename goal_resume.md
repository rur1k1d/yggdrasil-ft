# Yggdrasil_ft — goal_resume (tracker + resume prompt)

> Offline-first **family-tree web app** with a research TODO board.
> Repo target: **`rur1k1d/yggdrasil-ft`** (MIT). Local-only data — no server, no accounts.
> Docs in English; app UI PL+EN. Reuses the Planner store/templates patterns.
> **Status: P6 complete. v0.1.0 released 2026-10-23.
> Live: https://rur1k1d.github.io/yggdrasil-ft/**

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
| Interop | JSON (P1) · Markdown module (UI pending) · **GEDCOM 5.5.1 (P5)** |
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
- Never publish our domain, our site URL or any domain email: not in commits,
  README, `package.json`, topics or the repo homepage. The only public contact
  identity is `rur1k1d@proton.me`. Demo link = GitHub Pages only. `LICENSE` keeps
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
- [x] **P3** Research TODO board (templates, stats, read-only list; task editing + Markdown UI pending)
- [x] **P4** Sources registry UI (citation/report/print/privacy modules exist; UI pending, see README)
- [x] **P5** GEDCOM 5.5.1
- [x] **P6** Release polish, Pages demo, template repo, v0.1.0 (checklist below)
- [ ] **P7** Later options

## P6 checklist — release polish (goal items, in order)

State when written (2026-10-23): P2–P5 code complete but **uncommitted**; only two
commits exist (P0, P1), both authored with the retired domain email; no remote;
`rur1k1d/yggdrasil-ft` does not exist yet.

- [x] **P6.0 Baseline** — start `npm run dev`, review the app with the fictional
      seed, then run `npm run verify` + `npm run probe`; record exact numbers.
- [x] **P6.1 Identity rewrite** — rewrite P0/P1 author+committer to
      `rur1k1d <rur1k1d@proton.me>` with dates preserved
      (`git filter-branch --env-filter`; `git-filter-repo` is not installed).
      Verify `git log --format='%an <%ae> | %cn <%ce>'` shows zero occurrences of
      the retired domain email.
- [x] **P6.2 Commit P2–P5** — 2–4 semantic commits (`feat(p2)`… or grouped by
      module); leave the working tree clean.
- [x] **P6.3 Privacy gate** — `git status` shows only intended files; ignore
      matrix (`data/*` except seed, `vault/`, `*.ged`, `exports/`, `dist/`,
      `node_modules/`); scan tracked files for real personal data, emails,
      phones, absolute paths and our domain; only the fictional seed may ship.
      Stop and report on any finding.
- [x] **P6.4 i18n** — nested EN/PL key parity test, hardcoded-string scan,
      natural-Polish pass (pl-translation-reviewer).
- [x] **P6.5 Empty states** — empty tree, no search results, empty research
      board, empty sources, empty IO.
- [x] **P6.6 Responsive** — 320/360/390/768/1024/1440, zero horizontal overflow,
      phone-usable tree; add `scripts/ui-probe.mjs` (zero-dep CDP, same style as
      `scripts/pwa-probe.mjs`) with EN+PL screenshots.
- [x] **P6.7 a11y** — focus order, labels, AA contrast on new surfaces, reduced
      motion, `aria-live` on dynamic content, keyboard-only pass.
- [x] **P6.8 PWA base-safe** — relative `start_url`/`scope`/`navigateFallback`
      and icon paths; installable; offline-after-first-visit probe PASS.
- [x] **P6.9 CI + Pages** — `.github/workflows/ci.yml` + `pages.yml`;
      relative Vite base so one `dist` works at the domain root and under
      `/yggdrasil-ft/`; `npm run probe:pages` verifies the mount locally.
- [x] **P6.10 README + meta** — fix the stale "P0, no app code" status;
      screenshots in `docs/img/` (fictional data only); features; install/dev;
      demo link (GitHub Pages only); topics; template-flag prep.
- [x] **P6.11 Publish gate** — go-ahead received 2026-10-23. Created public
      `rur1k1d/yggdrasil-ft` (no license overwrite), pushed `main`, enabled Pages
      with `build_type=workflow`, set description/homepage/12 topics,
      `is_template=true`. Live probe PASS: SW active, offline reload, PL/EN
      switch, installable manifest, 0 console errors, 0 third-party requests.
      Released `v0.1.0`.

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

**P6 complete and v0.1.0 released.** Next backlog (P7 candidates): editable
research task details and source links, wire Markdown/report/print/privacy-mode
UI, photos/attachments in IndexedDB. Keep local-only, PL+EN, no hardcoded
strings.

## Log

- 2026-10-19 — P0 done.
- 2026-10-19 — P1 done.
- 2026-10-20 — P2 done.
- 2026-10-20 — P3 done (templates instantiator, research board, progress stats, markdown export).
- 2026-10-20 — Starting P4.
- 2026-10-20 — P5 done. GEDCOM 5.5.1 import + export (`src/io/gedcom-{shared,export,import}.ts`), settings UI in `DataIO.tsx` (JSON/GEDCOM export+import, PL/EN keys, structured error codes), mapping + limitations as-built in `docs/gedcom.md`. Evidence: `tests/gedcom.test.ts` 13 tests (round-trip stability on `sample-family.json`, UTF-8/`@`-escape round-trip, empty-doc exact round-trip, gates empty/charset/gedcom7/syntax + unknown-vs-ignored report, purity); `npm run verify` exit 0 (biome 0 errors, tsc 0, 35/35 tests, vite build OK). Deviation: plan's "public test GEDCOM" replaced by synthetic malformed/UTF-8 fixtures — seed stays fictional-only; revisit with a public-domain file if interop gaps appear in P6.
- 2026-10-23 — goal_resume prepared for P6: ordered P6.0–P6.11 checklist, commit identity + publication rules, publish gate. Code P2–P5 is still uncommitted; history still needs the identity rewrite (P6.1).
- 2026-10-23 — P6.0–P6.9 done: baseline, identity rewrite (zero old email in history), P2–P5 committed, privacy gate, i18n, empty states, responsive, a11y, base-safe PWA, CI + Pages.
- 2026-10-23 — P6.10 done: README for v0.1.0, plan/tracker status corrected, topics + template prep.
- 2026-10-23 — P6.11 done: public repo + Pages + topics + template flag + live probe PASS + release v0.1.0. P6 complete.

## Resume prompt (copy/paste with /goal)
```
/goal Yggdrasil-ft P6 — polish + first public release (v0.1.0)
Read projects/Yggdrasil_Project/{goal_resume.md,plan.md,data_model.md,docs/}, then work the P6.0–P6.11 checklist in goal_resume.md in order.
Rules: files EN, UI PL+EN, local-only, never publish our domain/site/email, commit identity rur1k1d <rur1k1d@proton.me>, semantic commits, ask me at P6.11 before repo create/push/Pages/release. Proactively use projects/AGENTS_SETTINGS/. Update goal_resume.md Evidence/Log after each item.
```

## Evidence

- 2026-10-20 — P4 modules done: source registry CRUD wired; citation/report/print/privacy-mode modules and tests exist but are not exposed in the UI (corrected 2026-10-23 after P6.4 audit). PL/EN, local-only. `tsc --noEmit` clean, `npm run build` OK.
- 2026-10-20 — P5 evidence: `npm run verify` exit 0 — biome 0 errors, `tsc --noEmit` 0, Vitest 35/35 (incl. `tests/gedcom.test.ts` ×13), `vite build` OK. Files: `src/io/gedcom-{shared,export,import}.ts`, `src/components/settings/DataIO.tsx`, `tests/gedcom.test.ts`, updated `docs/gedcom.md`, i18n `settings.io.*` (EN+PL), `tParams` in `src/i18n/t.ts`.
- 2026-10-23 — P6.0 evidence: verify exit 0 (biome 0 errors/12 warnings, tsc 0, 35/35 tests, build OK, precache 9); probe PASS online+offline, 0 console errors/exceptions/external requests. Found 390 px overflow (572 EN / 677 PL).
- 2026-10-23 — P6.1 evidence: `git filter-branch` rewrote main; dates preserved; refs/original removed, reflog expired, gc; `git log --all` shows zero occurrences of the retired domain email (author and committer).
- 2026-10-23 — P6.2 evidence: commits 17e97d7 (P2–P5 app) + 45da608 (tracker); tree clean; verify exit 0.
- 2026-10-23 — P6.3 evidence: 56 tracked files, only fictional seed under `data/`, no secrets, zero retired-domain hits; fixed tracker leak in b56d660; gate PASS.
- 2026-10-23 — P6.4 evidence: 5 i18n tests (parity, placeholders, literal `t()` keys), 38/38; stale notes removed; lang/title sync; PL pass; headless verified. Commit 7f98c47.
- 2026-10-23 — P6.5 evidence: empty tree/search/research/sources/IO states, EN+PL headless check. Commits 0085ba9, 260f6ec.
- 2026-10-23 — P6.6 evidence: responsive fixes, `scripts/ui-probe.mjs`, 48/48 checks PASS at 320–1440, 6 screenshots in `docs/img/`. Commit 0b91342.
- 2026-10-23 — P6.7 evidence: tabbable tree + arrow pan/±/0 zoom, 2 px focus ring, main focus on route change, labelled controls, live result count, delete confirm, source type/quality selects; contrast 0 failures; a11y probe PASS. Commit 53a2779.
- 2026-10-23 — P6.8 evidence: relative base + manifest fields/icons/SW fallback; installability errors []; root + `/yggdrasil-ft/` mount probes PASS incl. offline boot, 0 absolute asset leaks. Commit 666238c.
- 2026-10-23 — P6.9 evidence: `.github/workflows/ci.yml` (verify + probes) and `pages.yml` (verify + deploy); `scripts/mount-probe.mjs` + `npm run probe:pages` PASS; verify 0, 38/38. Commits de71131, 119d9cc.
- 2026-10-23 — P6.10 evidence: README rewritten for v0.1.0 (honest feature list, "Not in the UI yet", privacy/backup, quick start, checks, template use, naming note, Pages demo link, 3 screenshots); plan/tracker status corrected (P3/P4 partial notes, Q3 resolved); topics + template flag queued for P6.11.
- 2026-10-23 — P6.11 evidence: `gh repo create --public --source=. --remote=origin --push` (16 commits, main); Pages `build_type=workflow`; description + homepage + 12 topics; `is_template=true`. CI run 39985872952 success, Pages run 39985872955 success. Live probe at https://rur1k1d.github.io/yggdrasil-ft/: boot, SW control, manifest errors [], installability errors [], icons 200, EN + PL (nav Drzewo/Badania/Źródła/Ustawienia), offline reload boot, 0 console errors, 0 exceptions, 0 third-party requests. Release v0.1.0 (this commit included): https://github.com/rur1k1d/yggdrasil-ft/releases/tag/v0.1.0.

## Pause note 2026-10-25

Goal state backed up to `goal_state_20261025.json`. Cardgame work started in
`projects/Cardgame_Project` with a separate goal state file. The v0.2.0 goal
remains active with items 4-5 unchecked; resume from this file when returning.

## Resume 2026-10-26

- Shell regressions fixed. Intro (DataRain splash) now shows on every page load
  for 5000 ms plus a 600 ms fade (150 ms with reduced motion); Enter, Space or
  the Continue button skip it. No `localStorage` seen-flag anymore.
- Language: English is the default regardless of browser locale. The choice is
  persisted as `yggdrasil_locale_v1` and can be changed in the header or in
  Settings (`LanguageSection`). Shell markup restored from `6c0a4bf^` (skip link,
  nav labels via i18n, `aria-current`, footer, wide main for the tree).
- Nav spacing restored (`gap: var(--space-1) var(--space-2)`), lang switch and
  language options styled, dead `.app-*` markup removed.
- Probes updated for the always-on splash (`dismissIntro`) and extended:
  intro visible, auto-dismiss after ~5 s, EN default under a Polish browser
  locale, language persistence after reload.
- Gates: `npm run verify` PASS (Biome 0, tsc 0, Vitest 66/66, build OK);
  `npm run probe` PASS; `npm run probe:pages` PASS; `npm run probe:ui` PASS
  (62 checks: 48 routes + 14 features), screenshots regenerated in `docs/img/`.
- Cleanup: removed unused `JSX` import and unused catch binding in DataRain,
  reverted the unused Playwright dependency, ignored `goal_state_*.json`.
