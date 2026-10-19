# Yggdrasil_ft — Data model (v1)

> English (house rule). One versioned JSON document lives in **`localStorage`**
> under the key **`yggdrasil_ft_v1`** — nothing leaves the browser. This file
> defines the entities, fields, enums and invariants that back the UI, the
> research board and the JSON/GEDCOM exchange.
> Types use TypeScript notation; IDs are short opaque strings.

## 1. Storage envelope

```ts
type YggdrasilDoc = {
  schema: 1;                 // bumped on breaking change; store.migrate()
  updatedAt: string;         // ISO-8601
  settings: Settings;
  persons: Person[];
  families: Family[];
  sources: Source[];
  tasks: ResearchTask[];
  notes: Note[];
};
```

The store exposes `load()`, `save(doc)`, `update(mutator)`,
`migrate(raw)`, `safeParse()`, `exportJSON()`, `importJSON()`,
`replaceDoc(doc)` and emits a **`yggdrasil-ft:change`** event. If `localStorage`
throws (private mode / quota), the store falls back to an in-memory document for
the session and the UI shows a persistent "not persisted" warning.

```ts
type Settings = {
  locale: 'en' | 'pl';
  theme: 'dark' | 'light';        // default: dark ("world tree")
  privacyMode: boolean;           // masks living persons in print/screens
  dateFormat: 'iso' | 'dmy' | 'long';
  surnameOrder: 'given-first' | 'surname-first';
  treeDirection: 'vertical' | 'horizontal';
  researchTemplates: string[];   // ids of templates pinned for quick use
};
```

## 2. Enums

```ts
type Sex            = 'female' | 'male' | 'unknown' | 'other';
type PersonConfidence = 'unverified' | 'verified' | 'disputed';
type PersonResearch   = 'open' | 'partial' | 'complete' | 'dead-end';
type FamilyType     = 'marriage' | 'partnership' | 'unknown';

type SourceType = 'archive' | 'parish-register' | 'civil-register' | 'census'
                | 'book' | 'website' | 'database' | 'dna' | 'photograph'
                | 'interview' | 'family-record' | 'other';

type TaskStatus   = 'open' | 'done' | 'blocked' | 'dropped';type TaskPriority = 'low' | 'med' | 'high';

type EventType = 'birth' | 'christening' | 'marriage' | 'divorce' | 'death'
               | 'burial' | 'residence' | 'occupation' | 'migration' | 'other';
```

## 2b. Local-only + privacy rule

The document **never** leaves the device: no network calls, no telemetry, no
sync. `Person.living === true` entries are masked in print/screenshot mode when
`settings.privacyMode` is on (name abbreviated, dates clipped). See
`docs/privacy.md`.

## 3. Entities

```ts
type NamePart = {
  forename: string;
  surname?: string;
  prefix?: string;           // von / van / de
  suffix?: string;           // Jr., III
  type: 'birth' | 'married' | 'alias' | 'religious' | 'other';
};

type Event = {
  id: string;
  type: EventType;
  date?: PartialDate;        // see below — genealogical dates are often fuzzy
  place?: Place;
  sourceIds: string[];
  note?: string;
};

type PartialDate = {
  year?: number;
  month?: number;            // 1-12
  day?: number;              // 1-31
  qualifier?: 'exact' | 'about' | 'before' | 'after' | 'between';
  yearTo?: number;           // for 'between'
  display?: string;          // as written in the source, e.g. "ok. 1850 r."
};

type Place = {
  name: string;              // "Chernihiv"
  admin?: string;            // voivodeship / oblast / county
  country?: string;
  lat?: number;              // optional, for the P7 map
  lon?: number;
};

type Person = {
  id: string;
  names: NamePart[];         // first entry = primary/birth name
  sex: Sex;
  living?: boolean;          // privacy mode gate
  events: Event[];
  occupations?: string[];
  notes: string;
  tags: string[];            // e.g. 'rurikid', 'to-verify', 'dna-line'
  confidence: PersonConfidence;
  researchStatus: PersonResearch;
  createdAt: string;
  updatedAt: string;
};

type Family = {
  id: string;
  partnerIds: string[];      // 1-2 (more only for documented cases)
  childIds: string[];
  type: FamilyType;
  start?: Event;             // ceremony / cohabitation
  end?: Event;               // divorce / separation / death of a partner
  sourceIds: string[];
  note?: string;
};

type Source = {
  id: string;
  type: SourceType;
  title: string;             // "Metryki parafii ... 1850-1900"
  repository?: string;       // archive or website name
  reference?: string;        // signatura / fond-opis-sprava / call number
  url?: string;
  accessedAt?: string;       // ISO date
  quality?: 'original' | 'derivative' | 'transcription' | 'index' | 'unknown';
  transcription?: string;    // free text quote
  note?: string;
  createdAt: string;
  updatedAt: string;
};

type ResearchTask = {
  id: string;
  subjectType: 'person' | 'family' | 'tree';
  subjectId?: string;        // person/family id; omitted for whole-tree tasks
  question: string;          // "Who were the parents of X?"
  hypothesis?: string;       // what we expect to find
  whereToLook: string[];     // archives, collections, hints
  status: TaskStatus;
  priority: TaskPriority;
  nextAction?: string;       // the very next concrete step
  sourceIds: string[];
  outcome?: string;          // result text when done (or why dropped)
  templateId?: string;       // which research template created it
  createdAt: string;
  updatedAt: string;
};

type Note = {
  id: string;
  personId?: string;         // loose link: person
  familyId?: string;         // loose link: family
  taskId?: string;           // loose link: research task
  text: string;
  at: string;                // ISO-8601
};
```

Person-level judgement (`confidence`, `researchStatus`) is deliberately separate
from task-level state (`TaskStatus`): a person can be `partial` while all their
current tasks are `done`, meaning "no open leads right now".

## 4. Relationships

- `Family.partnerIds[] -> Person.id` (partner unions), `Family.childIds[] -> Person.id`.
- A child's parents are derived **only** through `Family` (no `person.parentIds`),
  so a union is the single source of truth.
- `Event.sourceIds[] -> Source.id`; `ResearchTask.sourceIds[] -> Source.id`.
- `ResearchTask.subjectId -> Person.id | Family.id` (per `subjectType`).
- `Note.personId? / familyId? / taskId?` — optional loose links.

## 5. Invariants (checked on every write)

1. **No cycles** — a person may never be their own ancestor.
2. **Date sanity** — birth before death; parents plausibly older than children
   (warning, not a hard block: `personAge < 12` or `> 60` at child's birth).
3. **No impossible dates** — day/month ranges, `before` < `after`.
4. **Referential integrity** — no dangling `sourceIds`/`subjectId`.
5. **Duplicate warning** — same primary name + same birth year ⇒ hint, not error.
6. **One union edge per couple** — merging partners instead of duplicating.
7. **Privacy gate** — `living` persons are masked in exports marked as public.

## 6. Exports & round-trips

- `exportJSON()` → `JSON.stringify(doc, null, 2)`; `importJSON(raw)` validates +
  migrates, replacing the document only on success.
- Markdown (P3): the research list (`- [ ] question — where to look`) plus a
  per-person report (P4).
- GEDCOM 5.5.1 (P5): mapping table + limitations in `docs/gedcom.md`.
