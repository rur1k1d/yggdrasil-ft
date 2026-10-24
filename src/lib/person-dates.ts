import type { Event, EventType, PartialDate, Person } from "../model/types";
import { uid } from "./ids";

export function findLifeEvent(
	person: Person,
	type: Extract<EventType, "birth" | "death">,
): Event | undefined {
	return person.events.find((event) => event.type === type);
}

export function lifeYear(
	person: Person,
	type: "birth" | "death",
): number | undefined {
	return findLifeEvent(person, type)?.date?.year;
}

export function lifeYearLabel(person: Person): string {
	const birth = lifeYear(person, "birth");
	const death = lifeYear(person, "death");
	if (birth === undefined && death === undefined) return "";
	if (death === undefined) return `${birth ?? "?"}-`;
	if (birth === undefined) return `?-${death}`;
	return `${birth}-${death}`;
}

export function setLifeYear(
	person: Person,
	type: "birth" | "death",
	year: number | undefined,
): Person {
	const events = person.events.map((event) => ({ ...event }));
	const index = events.findIndex((event) => event.type === type);

	if (year === undefined) {
		if (index < 0) return person;
		const event = events[index];
		if (!event) return person;
		const nextDate = withoutYear(event.date);
		const hasMore =
			nextDate !== undefined ||
			Boolean(event.place || event.sourceIds.length || event.note);
		if (hasMore) {
			if (nextDate) {
				events[index] = { ...event, date: nextDate };
			} else {
				const { date: _date, ...rest } = event;
				events[index] = rest;
			}
		} else {
			events.splice(index, 1);
		}
		return { ...person, events };
	}

	if (index >= 0) {
		const event = events[index];
		if (!event) return person;
		const date: PartialDate = { ...event.date, year };
		events[index] = { ...event, date };
		return { ...person, events };
	}

	events.push({
		id: uid("event"),
		type,
		date: { year },
		sourceIds: [],
	});
	return { ...person, events };
}

function withoutYear(date: PartialDate | undefined): PartialDate | undefined {
	if (!date) return undefined;
	const { year: _year, ...rest } = date;
	const hasValue =
		rest.month !== undefined ||
		rest.day !== undefined ||
		rest.qualifier !== undefined ||
		rest.yearTo !== undefined ||
		Boolean(rest.display);
	return hasValue ? rest : undefined;
}
