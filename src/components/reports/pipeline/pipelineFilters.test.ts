import { describe, it, expect } from "vitest";
import type { PipelineRow } from "./pipelineRows";
import {
  EMPTY_PIPELINE_FILTERS,
  applyPipelineFilters,
  pipelineFilterChips,
} from "./pipelineFilters";

const TODAY = new Date(2026, 7, 17); // 17 Aug 2026 — Q3

function row(over: Partial<PipelineRow> = {}): PipelineRow {
  return {
    listingId: "l1",
    dealId: "100",
    name: "123 Main Street",
    stage: "active",
    dealType: "Lease",
    dealSide: "seller",
    propertyType: "office",
    street: "123 Main Street",
    city: "Chicago",
    state: "IL",
    office: "Chicago — West Loop",
    brokers: ["Ethan Delgado"],
    transactionValue: 0,
    brokerageGross: 0,
    closeDate: null,
    ...over,
  };
}

describe("applyPipelineFilters", () => {
  it("returns every row when nothing is set", () => {
    const rows = [row(), row({ dealId: "101" })];
    expect(applyPipelineFilters(rows, EMPTY_PIPELINE_FILTERS, TODAY)).toHaveLength(2);
  });

  it("searches name, street, city, state and the deal id", () => {
    const rows = [
      row({ dealId: "100", name: "123 Main Street", street: "123 Main Street", city: "Chicago" }),
      row({
        dealId: "205",
        name: "Westgate Plaza",
        street: "789 Westgate Boulevard",
        city: "Denver",
        state: "CO",
      }),
    ];
    const only = (search: string) =>
      applyPipelineFilters(rows, { ...EMPTY_PIPELINE_FILTERS, search }, TODAY)
        .map((r) => r.dealId);

    expect(only("westgate")).toEqual(["205"]);
    expect(only("denver")).toEqual(["205"]);
    expect(only("CO")).toEqual(["205"]);
    expect(only("100")).toEqual(["100"]);
    expect(only("westgate boulevard")).toEqual(["205"]);
  });

  it("matches search case-insensitively", () => {
    const rows = [row({ name: "Westgate Plaza" })];
    expect(
      applyPipelineFilters(rows, { ...EMPTY_PIPELINE_FILTERS, search: "WESTGATE" }, TODAY),
    ).toHaveLength(1);
  });

  it("filters by each single-value field", () => {
    const rows = [
      row({ dealId: "1", stage: "active", dealType: "Lease", dealSide: "seller", propertyType: "office" }),
      row({ dealId: "2", stage: "closed", dealType: "Sale", dealSide: "buyer", propertyType: "retail" }),
    ];
    const ids = (f: Partial<typeof EMPTY_PIPELINE_FILTERS>) =>
      applyPipelineFilters(rows, { ...EMPTY_PIPELINE_FILTERS, ...f }, TODAY).map((r) => r.dealId);

    expect(ids({ stage: "closed" })).toEqual(["2"]);
    expect(ids({ dealType: "Sale" })).toEqual(["2"]);
    expect(ids({ dealSide: "seller" })).toEqual(["1"]);
    expect(ids({ propertyType: "retail" })).toEqual(["2"]);
  });

  it("composes filters as AND", () => {
    const rows = [
      row({ dealId: "1", stage: "active", dealType: "Lease" }),
      row({ dealId: "2", stage: "active", dealType: "Sale" }),
    ];
    const out = applyPipelineFilters(
      rows,
      { ...EMPTY_PIPELINE_FILTERS, stage: "active", dealType: "Sale" },
      TODAY,
    );
    expect(out.map((r) => r.dealId)).toEqual(["2"]);
  });

  it("drops rows with no office when an office filter is active", () => {
    const rows = [row({ dealId: "1", office: null }), row({ dealId: "2", office: "Denver" })];
    const out = applyPipelineFilters(
      rows,
      { ...EMPTY_PIPELINE_FILTERS, office: "Denver" },
      TODAY,
    );
    expect(out.map((r) => r.dealId)).toEqual(["2"]);
  });

  it("matches a broker against any broker on the deal, not just the lead", () => {
    const rows = [row({ dealId: "1", brokers: ["Ethan Delgado", "Priya Raman"] })];
    const out = applyPipelineFilters(
      rows,
      { ...EMPTY_PIPELINE_FILTERS, broker: "Priya Raman" },
      TODAY,
    );
    expect(out).toHaveLength(1);
  });

  it("applies the close-date presets against the injected today", () => {
    const rows = [
      row({ dealId: "q3", closeDate: "2026-09-15" }), // this quarter + this year + next 90
      row({ dealId: "q4", closeDate: "2026-11-20" }), // this year only
      row({ dealId: "old", closeDate: "2025-01-05" }), // past
      row({ dealId: "none", closeDate: null }),
    ];
    const ids = (closeDate: typeof EMPTY_PIPELINE_FILTERS.closeDate) =>
      applyPipelineFilters(rows, { ...EMPTY_PIPELINE_FILTERS, closeDate }, TODAY)
        .map((r) => r.dealId);

    expect(ids("this-quarter")).toEqual(["q3"]);
    expect(ids("this-year")).toEqual(["q3", "q4"]);
    expect(ids("next-90")).toEqual(["q3"]);
    expect(ids("past")).toEqual(["old"]);
  });

  it("excludes rows with no close date from every close-date preset", () => {
    const rows = [row({ dealId: "none", closeDate: null })];
    expect(
      applyPipelineFilters(rows, { ...EMPTY_PIPELINE_FILTERS, closeDate: "this-year" }, TODAY),
    ).toHaveLength(0);
  });
});

describe("pipelineFilterChips", () => {
  it("is empty when nothing is set", () => {
    expect(pipelineFilterChips(EMPTY_PIPELINE_FILTERS)).toEqual([]);
  });

  it("names every active filter, inline and modal alike", () => {
    const chips = pipelineFilterChips({
      ...EMPTY_PIPELINE_FILTERS,
      search: "westgate",
      stage: "closed",
      office: "Denver",
    });
    expect(chips.map((c) => c.label)).toEqual([
      "Search: westgate",
      "Stage: Closed",
      "Office: Denver",
    ]);
  });

  it("uses the display label, not the raw stage value", () => {
    const [chip] = pipelineFilterChips({ ...EMPTY_PIPELINE_FILTERS, stage: "proposal" });
    expect(chip.label).toBe("Stage: Pitching");
  });

  it("clears only its own field", () => {
    const state = { ...EMPTY_PIPELINE_FILTERS, stage: "closed" as const, dealType: "Sale" as const };
    const [stageChip] = pipelineFilterChips(state);
    const next = stageChip.clear(state);
    expect(next.stage).toBeNull();
    expect(next.dealType).toBe("Sale");
  });
});
