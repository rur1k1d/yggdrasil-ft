export type ResearchTemplate = {
	id: string;
	title: string;
	appliesTo: "person" | "family" | "tree";
	covers: string;
	questions: string[];
	whereToLook: string[];
	expectedDocs: string[];
};

export const RESEARCH_TEMPLATES: ResearchTemplate[] = [
	{
		id: "parish-records",
		title: "Parish / registry records",
		appliesTo: "person",
		covers: "any region with parish books",
		questions: [
			"Birth/christening entry for the person (year range from current data).",
			"Marriage entry of the parents (search ±5 years around the first child).",
			"Death/burial entry (search forward from last known event).",
			"Siblings: are there untracked christenings in the same books?",
			"Confession lists / status animarum: family composition at one date.",
		],
		whereToLook: [
			"Regional state archive (PL: metryki/AP; UA: DALO/DAPO)",
			"Local parish office",
			"FamilySearch/AGAD",
		],
		expectedDocs: [
			"baptism/marriage/burial acts",
			"index cards",
			"status animarum",
		],
	},
	{
		id: "census",
		title: "Census / revision lists",
		appliesTo: "family",
		covers: "RU (revision lists), PL, UA, US, NO",
		questions: [
			"Locate the household in the nearest census year after the last known event.",
			"Confirm names, ages, occupation, address, household composition.",
			"Track year-over-year changes to find births/deaths/moves.",
		],
		whereToLook: [
			"NARA/Ancestry (US)",
			"Revizskie skazki (RU)",
			"Digitalarkivet (NO)",
		],
		expectedDocs: ["household pages", "revision lists", "tax registers"],
	},
	{
		id: "military",
		title: "Military records",
		appliesTo: "person",
		covers: "19th–20th c.",
		questions: [
			"Conscription/registration card for the person.",
			"Unit + rank + service dates; POW or casualty entries.",
			"Award/decorations lists.",
			"Veterans' records & compensation files.",
		],
		whereToLook: ["CAW/WBH (PL)", "TsDAVO (UA)", "Bundesarchiv (DE)"],
		expectedDocs: ["service books", "casualty lists", "award files"],
	},
	{
		id: "migration",
		title: "Migration / emigration",
		appliesTo: "person",
		covers: "global",
		questions: [
			"Departure records (port/embarkation lists) and arrival records.",
			"Naturalisation papers and passport applications.",
			"First census in the destination country.",
			"Ship manifests and the place of last residence as given.",
		],
		whereToLook: ["Ellis Island/Castle Garden", "FamilySearch passenger lists"],
		expectedDocs: ["manifests", "petitions", "naturalisation certificates"],
	},
	{
		id: "dna-triangulation",
		title: "DNA-match triangulation",
		appliesTo: "person",
		covers: "all",
		questions: [
			"Which matches cluster on this branch? (notes only, no DNA upload).",
			"Smallest shared-tree hypothesis documented before contacting the match.",
			"Research task per unrepaired match with outbound message plan.",
			"Sketch a 'both-lines-verified' threshold before treating branch as firm.",
		],
		whereToLook: ["FTDNA/MyHeritage/GEDmatch (manual notes)"],
		expectedDocs: [
			"match list",
			"cM ranges",
			"message log",
			"hypothesis notes",
		],
	},
	{
		id: "cemetery",
		title: "Cemetery / monument evidence",
		appliesTo: "person",
		covers: "all",
		questions: [
			"Locate the grave/monument; photograph (with permission).",
			"Transcribe the inscription; note actual burial date vs. assumed.",
			"Check burial registers of the parish/cemetery office.",
		],
		whereToLook: ["Cemetery administrations", "BillionGraves/FindaGrave"],
		expectedDocs: [
			"photographs",
			"inscription transcriptions",
			"burial registers",
		],
	},
	{
		id: "archive-letter",
		title: "Archive query letter",
		appliesTo: "family",
		covers: "all",
		questions: [
			"Formulate the precise request (name, dates, place, register + years).",
			"Identify the archive + fond/opis/sprava if known.",
			"Prepare a fallback request if the search comes back negative.",
			"Log the date sent, the reference number and the reply.",
		],
		whereToLook: [
			"State archive reading rooms",
			"Online request forms",
			"Genealogical societies",
		],
		expectedDocs: ["outbound letter", "correspondence log", "reply"],
	},
];
