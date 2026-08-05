import { describe, expect, it } from "vitest";
import { reseedDraft } from "./reseedDraft";

interface Draft {
	a: number;
	b: string;
}

describe("reseedDraft", () => {
	it("takes the store's new value for a key untouched since mount", () => {
		const base: Draft = { a: 1, b: "x" };
		const draft: Draft = { a: 1, b: "x" };
		const next: Draft = { a: 2, b: "x" };
		expect(reseedDraft(draft, base, next)).toEqual({ a: 2, b: "x" });
	});

	it("keeps the draft's value for a key the user already changed", () => {
		const base: Draft = { a: 1, b: "x" };
		const draft: Draft = { a: 5, b: "x" };
		const next: Draft = { a: 2, b: "x" };
		expect(reseedDraft(draft, base, next)).toEqual({ a: 5, b: "x" });
	});

	it("leaves a key alone that the store did not move", () => {
		const base: Draft = { a: 1, b: "x" };
		const draft: Draft = { a: 5, b: "x" };
		const next: Draft = { a: 1, b: "x" };
		expect(reseedDraft(draft, base, next)).toEqual({ a: 5, b: "x" });
	});

	it("returns the SAME object reference when nothing changed", () => {
		// The effects that drive this rely on reference equality to avoid a
		// render loop — a merge that always returns a fresh object would re-fire
		// every effect that depends on the draft, on every store update.
		const base: Draft = { a: 1, b: "x" };
		const draft: Draft = { a: 1, b: "x" };
		const next: Draft = { a: 1, b: "x" };
		expect(reseedDraft(draft, base, next)).toBe(draft);
	});

	it("returns a NEW object reference when something did change", () => {
		const base: Draft = { a: 1, b: "x" };
		const draft: Draft = { a: 1, b: "x" };
		const next: Draft = { a: 2, b: "x" };
		const result = reseedDraft(draft, base, next);
		expect(result).not.toBe(draft);
	});
});
