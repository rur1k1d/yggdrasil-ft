# GEDCOM 5.5.1 — interop scope

> English (house rule). Interop doc for `yggdrasil-ft`. Implemented in **P5**
> (`src/io/gedcom-export.ts`, `src/io/gedcom-import.ts`, `src/io/gedcom-shared.ts`;
> tests in `tests/gedcom.test.ts`). This file fixes the supported subset, the
> mapping and the known limitations.

## 1. Why 5.5.1

GEDCOM 5.5.1 is the dialect that practically every genealogy tool still imports
and exports (Ancestry, MyHeritage, FamilySearch, Gramps, MacFamilyTree, webtrees).
GEDCOM 7 exists (`gedcom7` spec) but tool support is still uneven; a strict 5.5.1
subset maximizes round-trips that actually work. A GEDCOM 7 input file is
rejected with an explicit `gedcom7` error, never partially parsed.

## 2. Supported subset (v1 import + export)

| GEDCOM | Our model | Notes |
|---|---|---|
| `INDI` | `Person` | `NAME` (multiple: birth/married/alias/…), `SEX` |
| `NAME`/`GIVN`/`SURN`/`NPFX`/`NSFX`/`TYPE` | `NamePart` | subtags authoritative; `NAME` value is the fallback |
| `BIRT`/`CHR`/`MARR`/`DIV`/`DEAT`/`BURI`/`RESI` | `Event` | date + place + citations + note |
| `EMIG`/`IMMI` | `Event` (`migration`) | both map to the single migration type |
| `DATE` | `PartialDate` | `ABT`, `BEF`, `AFT`, `BET … AND …` qualifiers preserved |
| `PLAC` | `Place` | single string → `name` + best-effort `admin`/`country` |
| `FAM` (`HUSB`/`WIFE`/`CHIL`) | `Family` | union as the single source of truth |
| `SOUR` | `Source` | `TITL`, `REPO`, `REFN`, `QUAY`, `DATA>TEXT`, `NOTE` |
| `_URL`/`_ACCESSED`/`_TYPE` | `Source.url`/`accessedAt`/`type` | vendor tags, read back losslessly |
| `NOTE` (inline or `0 @…@ NOTE` record) | `Person.notes` / family note | plain text, `CONT`/`CONC` joined, `@@` unescaped |
| `OCCU` | `Person.occupations` | free text |
| `FAMC`/`FAMS` | *ignored on import* | exported for other tools; `FAM` is canonical |
| `OBJE` | *not imported (P7)* | media stays off in v1 |
| `HEAD`/`TRLR` | metadata | `GEDC.VERS` written as 5.5.1, `CHAR UTF-8` enforced |

## 3. Mapping decisions (as implemented)

- **Union is canonical.** A child's link to parents exists only through `FAM`.
  On import a `FAM` becomes one `Family`; on export `Family` → `@F…@` with
  `HUSB`/`WIFE` (`partnerIds[0..1]`, positional — order preserved on import)
  + `CHIL` in `childIds` order.
- **Xrefs are positional.** `@I1@`→`p1`, `@F1@`→`f1`, `@S1@`→`s1`; event ids are
  regenerated from a global counter (`e1`, `e2`, … — INDI order, then FAM).
- **Fuzzy dates preserved.** `PartialDate.qualifier` maps 1:1 to
  `ABT/BEF/AFT/BET`, and `PartialDate.display` keeps the original text form
  when the date cannot be parsed.
- **Sex collapses.** `other` exports as `U` and comes back as `unknown`
  (documented lossy collapse).
- **Sources are shared.** One `Source` record may be cited by many events; the
  GEDCOM export references the same `@S…@` id. `QUAY` maps to
  `original=3 / derivative=2 / transcription=1 / index=0`; `unknown` omits the
  tag, and an absent `QUAY` imports as `undefined`.
- **Repository names** are deduplicated into `0 @Rn@ REPO` records; on import a
  `REPO` pointer is resolved back to the repository name string.
- **Occupation merge is lossy.** Person-level `OCCU` lines and occupation
  events both land in `Person.occupations[]` — only one representation survives.
- **Text escaping.** `@` → `@@` on write, unescaped after `CONT`/`CONC`
  joining on read; lines longer than 200 chars are wrapped with `CONC`.
- **Unknown tags** are collected in an import report (`unknownTags` /
  `ignoredTags`, each with tag + line number), never injected into the
  document as opaque blobs. Children of an unknown tag are not walked.
- **Charset gates.** `CHAR` other than UTF-8 → `{code:"charset"}`; `GEDC.VERS`
  7.x → `{code:"gedcom7"}`; a line without a valid level → `{code:"syntax", line}`;
  empty input → `{code:"empty"}`. Errors are structured codes — no raw parser
  strings ever reach the UI.
- **Confidentiality:** import/export is pure string/file work in the browser —
  **no upload, no network**. A real `.ged` file is personal data: it is never
  committed (`*.ged` is git-ignored).

## 4. Round-trip gates (P5) — implemented

All four gates live in `tests/gedcom.test.ts` and run under `npm run verify`:

1. **Stability:** `import(export(import(export(seed))))` deep-equals
   `import(export(seed))` (fixed timestamp on both imports). ✅
2. **Fixture projection:** the fictional `data/seed/sample-family.json`
   round-trips its persons, names, sex, events, places, family links, source
   fields and notes; the import report counts match (4/1/2). ✅
3. **UTF-8:** Polish diacritics, `@`-escapes, 3-part places and source
   transcriptions survive export → import. ✅
4. **Gates:** empty / charset / gedcom7 / malformed-line (with line number),
   unknown-vs-ignored tag classification, and an exact empty-document
   round-trip. ✅

## 5. Known limitations (documented, not silently dropped)

JSON-only fields are **not** carried by GEDCOM and are reset on import:
`settings` (the app re-applies the current settings on import), `tasks`,
`Note` entities, `tags`, `confidence`, `researchStatus`, `living`,
`createdAt`/`updatedAt` (reset to the import time), place `lat`/`lon`,
`meta`. Also:

- `other`-type events are skipped on export (no GEDCOM tag) — reported only
  via absence, not an error.
- A family whose `start`/`end` event is not marriage/divorce-shaped loses that
  event on export (only `MARR`/`DIV` are written at family level).
- `FAMC`/`FAMS` are exported for other tools but never read back.
- Import never throws: malformed structure yields `{ ok: false, errors[] }`
  and the current document is left untouched.
- Not supported in v1: `SOUR`+`TEXT` citation granularity beyond a flat link,
  LDS ordinances, association/`ASSO`, multimedia (`OBJE`), GEDCOM 7 features.
