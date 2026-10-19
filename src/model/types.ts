export const SCHEMA_VERSION = 1;

export type Sex = "female" | "male" | "unknown" | "other";
export type PersonConfidence = "unverified" | "verified" | "disputed";
export type PersonResearch = "open" | "partial" | "complete" | "dead-end";
export type FamilyType = "marriage" | "partnership" | "unknown";

export type SourceType =
	| "archive"
	| "parish-register"
	| "civil-register"
	| "census"
	| "book"
	| "website"
	| "database"
	| "dna"
	| "photograph"
	| "interview"
	| "family-record"
	| "other";

export type TaskStatus = "open" | "done" | "blocked" | "dropped";
export type TaskPriority = "low" | "med" | "high";

export type EventType =
	| "birth"
	| "christening"
	| "marriage"
	| "divorce"
	| "death"
	| "burial"
	| "residence"
	| "occupation"
	| "migration"
	| "other";

export type NameType = "birth" | "married" | "alias" | "religious" | "other";
export type DateQualifier = "exact" | "about" | "before" | "after" | "between";
export type SourceQuality =
	| "original"
	| "derivative"
	| "transcription"
	| "index"
	| "unknown";
export type TaskSubjectType = "person" | "family" | "tree";
export type Theme = "dark" | "light";
export type DateFormat = "iso" | "dmy" | "long";
export type SurnameOrder = "given-first" | "surname-first";
export type TreeDirection = "vertical" | "horizontal";
export type AppLocale = "en" | "pl";

export type NamePart = {
	forename: string;
	surname?: string;
	prefix?: string;
	suffix?: string;
	type: NameType;
};

export type PartialDate = {
	year?: number;
	month?: number;
	day?: number;
	qualifier?: DateQualifier;
	yearTo?: number;
	display?: string;
};

export type Place = {
	name: string;
	admin?: string;
	country?: string;
	lat?: number;
	lon?: number;
};

export type Event = {
	id: string;
	type: EventType;
	date?: PartialDate;
	place?: Place;
	sourceIds: string[];
	note?: string;
};

export type LifeEvent = Event;

export type Person = {
	id: string;
	names: NamePart[];
	sex: Sex;
	living?: boolean;
	events: Event[];
	occupations?: string[];
	notes: string;
	tags: string[];
	confidence: PersonConfidence;
	researchStatus: PersonResearch;
	createdAt: string;
	updatedAt: string;
};

export type Family = {
	id: string;
	partnerIds: string[];
	childIds: string[];
	type: FamilyType;
	start?: Event;
	end?: Event;
	sourceIds: string[];
	note?: string;
};

export type Source = {
	id: string;
	type: SourceType;
	title: string;
	repository?: string;
	reference?: string;
	url?: string;
	accessedAt?: string;
	quality?: SourceQuality;
	transcription?: string;
	note?: string;
	createdAt: string;
	updatedAt: string;
};

export type ResearchTask = {
	id: string;
	subjectType: TaskSubjectType;
	subjectId?: string;
	question: string;
	hypothesis?: string;
	whereToLook: string[];
	status: TaskStatus;
	priority: TaskPriority;
	nextAction?: string;
	sourceIds: string[];
	outcome?: string;
	templateId?: string;
	createdAt: string;
	updatedAt: string;
};

export type Note = {
	id: string;
	personId?: string;
	familyId?: string;
	taskId?: string;
	text: string;
	at: string;
};

export type Settings = {
	locale: AppLocale;
	theme: Theme;
	privacyMode: boolean;
	dateFormat: DateFormat;
	surnameOrder: SurnameOrder;
	treeDirection: TreeDirection;
	researchTemplates: string[];
};

export type YggdrasilDoc = {
	schema: 1;
	updatedAt: string;
	settings: Settings;
	persons: Person[];
	families: Family[];
	sources: Source[];
	tasks: ResearchTask[];
	notes: Note[];
};
