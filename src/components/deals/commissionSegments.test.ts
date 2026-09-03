import { describe, expect, it } from "vitest";
import type { DealBroker } from "#/data/types";
import { internalBrokerSegments } from "./commissionSegments";

const broker = (name: string, grossCommission: number) =>
	({ name, grossCommission }) as DealBroker;

describe("internalBrokerSegments", () => {
	it("gives each broker their own row, in list order", () => {
		const segments = internalBrokerSegments([
			broker("Ethan Thompson", 300),
			broker("Tessa Nakamura", 200),
		]);
		expect(segments.map((s) => [s.label, s.value])).toEqual([
			["Ethan Thompson", 300],
			["Tessa Nakamura", 200],
		]);
		expect(new Set(segments.map((s) => s.color)).size).toBe(2);
	});

	it("folds brokers past the palette into one Other row, losing no money", () => {
		const brokers = [
			broker("A", 100),
			broker("B", 100),
			broker("C", 100),
			broker("D", 50),
			broker("E", 25),
		];
		const segments = internalBrokerSegments(brokers);
		expect(segments).toHaveLength(4);
		expect(segments[3]).toMatchObject({ label: "2 Other Brokers", value: 75 });
		expect(segments.reduce((t, s) => t + s.value, 0)).toBe(375);
	});

	it("never repeats a color", () => {
		const brokers = Array.from({ length: 6 }, (_, i) => broker(`B${i}`, 10));
		const colors = internalBrokerSegments(brokers).map((s) => s.color);
		expect(new Set(colors).size).toBe(colors.length);
	});
});
