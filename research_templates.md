# Yggdrasil_ft — Research templates (v1)

> English (house rule). Each template is a **parameterised checklist** that, when
> applied to a person or family, instantiates `ResearchTask` records
> (see `data_model.md`). Templates answer the one question the app exists for:
> *where do I still have to look?*
>
> Template shape: `id`, `title`, `appliesTo` (person | family | tree),
> `covers` (countries/periods it is useful for), `questions[]` (ordered),
> `whereToLook[]` (concrete archives/collections), `expectedDocs[]`.

## 1. Parish / registry records (region + period)

`id: parish-records` · appliesTo: person · covers: any region with parish books

- Birth/christening entry for the person (year range from the current data).
- Marriage entry of the parents (search ±5 years around the first child).
- Death/burial entry (search forward from last known event).
- Siblings: are there untracked christenings in the same books?
- Confession lists / status animarum: family composition at one date.

**Where to look:** regional state archive (Poland: metryki/AP; Ukraine:
DALO/DAPO fond-opis-sprava; church books on FamilySearch/AGAD), local parish
office, published register indexes.
**Expected docs:** baptism/marriage/burial acts, index cards, status animarum.

## 2. Census / revision lists

`id: census` · appliesTo: family · covers: RU (revision lists), PL, UA, US, NO

- Locate the household in the nearest census year after the last known event.
- Confirm names, ages, occupation, address, household composition.
- Track year-over-year changes to find births/deaths/moves.

**Where to look:** census portals (US: NARA/Ancestry; RU: revizskie skazki
fondy; NO: Digitalarkivet), state archives.
**Expected docs:** household pages, revision lists, tax registers.

## 3. Military records

`id: military` · appliesTo: person · covers: 19th–20th c.

- Conscription/registration card for the person (age 18–40).
- Unit + rank + service dates; possible POW or casualty entries.
- Award/decorations lists.
- Veterans' records & compensation files.

**Where to look:** national military archives (PL: CAW/WBH; UA: TsDAVO; DE:
Bundesarchiv), WWI/WWII databases, Red Cross / ITS Arolsen files.
**Expected docs:** service books, casualty lists, award files.

## 4. Migration / emigration

`id: migration` · appliesTo: person

- Departure records (port/embarkation lists) and arrival records.
- Naturalisation papers and passport applications.
- First census in the destination country.
- Ship manifests and the place of last residence as given.

**Where to look:** Ellis Island/Castle Garden, FamilySearch passenger lists,
national archive emigration fondy, Norwegian/Canadian/Australian archives.
**Expected docs:** manifests, petitions, naturalisation certificates.

## 5. DNA-match triangulation

`id: dna-triangulation` · appliesTo: person

- Which matches cluster on this branch? (note matches + shared cM from FTDNA/
  MyHeritage/GEDmatch — **as notes only; no DNA data is uploaded by this app**).
- Smallest shared-tree hypothesis documented before contacting the match.
- Introduce a research task per unrepaired match with an outbound message plan.
- Sketch a "both-lines-verified" threshold before treating a branch as firm.

**Where to look:** FTDNA/MyHeritage/GEDmatch, chromosome browsers (manual notes),
the project's paper trail (never conclusions from DNA alone).
**Expected docs:** match list, cM ranges, message log, hypothesis notes.

## 6. Cemetery / monument evidence

`id: cemetery` · appliesTo: person

- Locate the grave/monument; photograph (with permission).
- Transcribe the inscription; note the actual burial date vs. assumed.
- Check burial registers of the parish/cemetery office.

**Where to look:** cemetery administrations, BillionGraves/FindaGrave,
volunteer photographers, local caretakers.
**Expected docs:** photographs, inscription transcriptions, burial registers.

## 7. Archive query letter

`id: archive-letter` · appliesTo: person/family

- Formulate the precise request (name, dates, place, register + years).
- Identify the archive + fond/opis/sprava if known.
- Prepare a fallback request if the search comes back negative.
- Log the date sent, the reference number and the reply.

**Where to look:** state archive reading rooms, online request forms, local
genealogical societies.
**Expected docs:** outbound letter, correspondence log, reply, found copies.

---

## Applying a template

1. Pick a person/family → *Research* tab → **Apply template**.
2. Fill parameters (region, period, known event window).
3. The app creates the `ResearchTask` set with `nextAction` on the first item
   and links `sourceIds` for anything already cited.
4. Tasks appear in the research board and in the markdown export.

*(Template definitions ship in `src/data/research-templates.ts` from P3 and are
shown here first so the wording and scope are agreed before coding.)*
