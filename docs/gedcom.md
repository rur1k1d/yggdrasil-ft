# GEDCOM 5.5.1 — interop scope

> English (house rule). Interop plan for `yggdrasil-ft`. Implementation lands in
> **P5**; this file fixes the target subset and the known limitations before any
> code is written.

## 1. Why 5.5.1

GEDCOM 5.5.1 is the dialect that practically every genealogy tool still imports
and exports (Ancestry, MyHeritage, FamilySearch, Gramps, MacFamilyTree, webtrees).
GEDCOM 7 exists (`gedcom7` spec) but tool support is still uneven; a strict 5.5.1
subset maximizes round-trips that actually work. GEDCOM 7 can be a later add-on.

## 2. Supported subset (v1 import + export)

| GEDCOM | Our model | Notes |
|---|---|---|
| `INDI` | `Person` | `NAME` (multiple: birth/married/alias), `SEX` |
| `NAME`/`GIVN`/`SURN`/`NPFX`/`NSFX` | `NamePart` | `married`/`aka` types via `TYPE` |
| `BIRT`/`CHR`/`MARR`/`DIV`/`DEAT`/`BURI` | `Event` | date + place |
| `DATE` | `PartialDate` | `ABT`, `BEF`, `AFT`, `BET … AND …` qualifiers preserved |
| `PLAC` | `Place` | single string → `name` + best-effort `admin`/`country` |
| `FAM` (`HUSB`/`WIFE`/`CHIL`) | `Family` | union as the single source of truth |
| `SOUR` | `Source` | `TITL`, `AUTH`/`REPO`, `PUBL`, `NOTE`, `TEXT`/`QUAY` |
| `NOTE` | `Note` / `Person.notes` | plain text |
| `OCCU` | `Person.occupations` | free text |
| `OBJE` | *not imported (P7)* | media stays off in v1 |
| `HEAD`/`SUBM`/`SUBN` | metadata | `GEDC.VERS` written as 5.5.1 |

**Not supported in v1 (documented, not silently dropped):** `SOUR`+`TEXT` citation
granularity beyond a flat link, `SSN`/`RESI` sub-structures beyond a simple event,
LDS ordinances, association/`ASSO`, `_`-prefixed vendor tags (kept as notes when
small, otherwise reported), multimedia (`OBJE`), GEDCOM 7 features.

## 3. Mapping decisions

- **Union is canonical.** A child's link to parents exists only through `FAM`.
  On import a `FAM` becomes one `Family`; on export `Family` → `@F…@` with
  `HUSB`/`WIFE` (`partnerIds[0..1]`) + `CHIL`.
- **Fuzzy dates preserved.** `PartialDate.qualifier` maps 1:1 to
  `ABT/BEF/AFT/BET`, and `PartialDate.display` keeps the original text form.
- **Sources are shared.** One `Source` record may be cited by many events; the
  GEDCOM export references the same `@S…@` id.
- **Unknown tags** are collected in an import report (count + file/line), never
  injected into the document as opaque blobs.
- **Confidentiality:** import/export is pure string/file work in the browser —
  **no upload, no network**. A real `.ged` file is personal data: it is never
  committed (`*.ged` is git-ignored).

## 4. Round-trip gates (P5)

1. `import → export → import` produces a document identical to the first import
   (deep-equal on the supported subset) for the fictional fixture.
2. A second fixture from a public test file (e.g. a small public-domain or
   self-authored GEDCOM) imports without errors; the unknown-tag report matches
   the expected list.
3. Char-set: UTF-8 in and out (`1 CHAR UTF-8`); legacy `ANSI`/`ANSEL` inputs are
   reported as unsupported rather than silently mangled.
4. Malformed input never throws at the UI layer: the parser returns
   `{ ok: false, errors[] }` and the document is left untouched.
