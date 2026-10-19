# Yggdrasil_ft

**Offline-first family-tree builder with a research TODO board.**
Build your ancestry in the browser, keep every note about *where to look next*,
and never send a single byte of your family data anywhere.

> Status: **P0 — planning/docs.** No app code yet. Roadmap: `plan.md`,
> tracker: `goal_resume.md`, schema: `data_model.md`.

## Why

Most genealogy tools are either cloud services (your family data lives on someone
else's server) or desktop software with a steep learning curve. `yggdrasil-ft`
is a small, local-first web app that you download and use:

- **Confidential by design** — all data stays in your browser (`localStorage`),
  no accounts, no sync, no telemetry, no third-party scripts. Works fully offline
  once loaded (installable PWA).
- **Research-first** — the point is not just drawing a tree, but tracking the
  *open questions*: who is missing, which archive to query next, which hypothesis
  to test. Every person can carry a research TODO with sources and outcomes.
- **Yours forever** — export the whole document as JSON, exchange with other
  tools via **GEDCOM 5.5.1**, print or export markdown reports.

## Roadmap (short)

| Phase | Content |
|---|---|
| P0 | Docs, license, privacy rules, seed dataset *(current)* |
| P1 | Vite + Preact + TS skeleton, store with migrations, PWA offline, JSON export/import |
| P2 | People, relations, SVG tree (pan/zoom, keyboard), validation |
| P3 | Research TODO board + templates + markdown export |
| P4 | Sources, citations, reports, privacy mode |
| P5 | GEDCOM 5.5.1 import/export with round-trip tests |
| P6 | Release polish, GitHub Pages demo, template repo, `v0.1.0` |
| P7 | Photos (IndexedDB), timeline/map, DNA notes, encrypted local vault |

Details and acceptance criteria per phase: `plan.md`.

## Privacy (the short version)

- Nothing leaves your device. No server exists.
- The repo ships **fictional demo data only**; real trees are git-ignored
  (`data/`, `vault/`, `*.ged`) and stay on your machine.
- Living persons can be masked for screenshots and print (privacy mode).
- Full contract: `docs/privacy.md`.

## Getting started (once P1 lands)

```bash
npm install
npm run dev        # local dev server
npm test           # Vitest
npm run build      # static build in dist/ — open it offline
```

## Naming note

The project name follows the Norse world tree (Yggdrasil), a natural fit for a
family tree. It is **not** related to the Yggdrasil Network
(`yggdrasil-network/*`, an encrypted IPv6 overlay) nor to other projects that
happen to share the name — see the topic list; `-ft` stands for *family tree*.
Prior art acknowledged: `KeithPetro/Yggdrasil` and `marioparra/yggdrasil-opensource`
(self-hosted GEDCOM viewers). We differ by being fully offline and by making the
research TODO the centre of the app.

## License

MIT © 2026 Ivan Kryvosheyev — see `LICENSE`.
