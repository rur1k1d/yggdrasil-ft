# Privacy — local-only by design

> English (house rule). This is the confidentiality contract of `yggdrasil-ft`.
> Family data is private: the app must never be able to leak it, by accident or
> by design.

## 1. Rules

1. **No backend, no accounts, no sync, no telemetry.** The app makes no network
   request at runtime; all assets are bundled locally.
2. **One storage sink:** `localStorage` (`yggdrasil_ft_v1`). Optional photo/scan
   support (P7) adds IndexedDB — same device, same origin, still local.
3. **Nothing is uploaded, ever.** Exports are files the user downloads.
4. **Real family data is never committed.** `data/`, `vault/`, `*.ged`,
   `*.gedcom`, exported `*.json` and scans are git-ignored; the repo ships only
   a **fictional** seed tree (`data/seed/sample-family.json`).
5. **No third-party scripts, fonts, analytics or CDNs.** Offline and privacy at
   the same time.
6. **Screenshots and docs use the fictional dataset only.**
7. **Privacy mode** (P4/P7) masks living persons (name abbreviated, dates
   clipped) in print/screenshot output.

## 2. Why there is no sync phase

The Planner has an optional accounts/sync phase (Cloudflare + D1). Here that is
ruled out: **confidentiality beats convenience**. If multi-device use is ever
needed, the answer is an exported file the user moves themselves — optionally
inside an **encrypted vault** (WebCrypto AES-GCM + user passphrase, still 100%
local) planned for P7. Nothing in this project may introduce a server.

## 3. Threat notes

| Risk | Mitigation |
|---|---|
| Real data accidentally committed | `.gitignore` from P0, fictional-only seed, review checklist in `CONTRIBUTING.md` |
| Browser storage cleared / data loss | Frequent JSON export reminder + export nudge (P4) |
| XSS from pasted text or imported files | render as text only (no `innerHTML`), strict JSON schema validation, size caps |
| Imported GEDCOM executing anything | pure parser, no code execution, no network follow-ups |
| Shared device / browser profile | documented in-app warning; encrypted vault in P7 for exports |
| Leak through a "template" repo | seed data is fictional by rule, reviewed in CI checklist |

## 3. How we verify (gates)

- Grep the built bundle for `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`
  (outside service-worker registration) and fail CI on hits.
- Offline test: load the built app, disable the network, reload — tree and
  research board must still work.
- DevTools Network on a fresh profile: requests only from the app's own origin.
- `docs/privacy.md` rules restated in `CONTRIBUTING.md` for contributors.
