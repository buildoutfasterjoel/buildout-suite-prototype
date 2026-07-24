import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import { isHeroCall, applyHeroRecapExtensions, undoHeroActions } from "./heroRecapExtensions";
import type { CallTarget } from "./useCallStore";
import type { CallRecapSpecT } from "#/ai/generate/schemas";

function hydrate() {
  const ds = generateDataset();
  useDataStore.setState({
    properties: new Map(ds.properties.map((p) => [p.id, p])),
    listings: new Map(ds.listings.map((l) => [l.id, l])),
    contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    tasks: new Map(),
  } as never);
  return ds;
}

const targetFor = (contactId: string, name: string): CallTarget => ({
  contactId, name, entity: "Pinckney Holdings LLC", phone: "555", initials: "MP",
  firstName: "Marcus", role: "owner", note: "",
});

const recap: CallRecapSpecT = {
  sentiment: "positive",
  keyPoints: ["Open to a conversation."],
  tasks: [],
  opportunity: { name: "Palmetto Court", address: "12 King St" },
};

describe("heroRecapExtensions", () => {
  beforeEach(() => hydrate());

  it("isHeroCall is true for the signal owner, false otherwise", () => {
    const marcus = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "marcus")!;
    const other = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey !== "marcus" && !c.signal)!;
    expect(isHeroCall(targetFor(marcus.id, marcus.firstName))).toBe(true);
    expect(isHeroCall(targetFor(other.id, other.firstName))).toBe(false);
  });

  it("opens a proposal deal, moves it to active, and schedules the Thursday tour", () => {
    const marcus = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "marcus")!;
    const actions = applyHeroRecapExtensions(
      { target: targetFor(marcus.id, marcus.firstName), recap },
      { now: new Date("2026-07-24T09:00:00") }, // a Friday
    )!;
    expect(actions.movedToStage).toBe("active");
    expect(actions.tourDate).toBe("2026-07-30"); // next Thursday
    const deal = useDataStore.getState().listings.get(actions.dealId)!;
    expect(deal.status).toBe("active");
    const task = useDataStore.getState().tasks.get(actions.tourTaskId)!;
    expect(task.type).toBe("tour");
    expect(task.dueDate).toBe("2026-07-30");
    expect(actions.narration).toContain("pipeline");
    expect(actions.narration).toContain("Thursday"); // spoken narration uses the weekday, not the raw ISO date
  });

  it("undo removes the tour task and pulls the deal out of the pipeline", () => {
    const marcus = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "marcus")!;
    const actions = applyHeroRecapExtensions({ target: targetFor(marcus.id, marcus.firstName), recap })!;
    undoHeroActions(actions);
    expect(useDataStore.getState().tasks.get(actions.tourTaskId)).toBeUndefined();
    expect(useDataStore.getState().listings.get(actions.dealId)!.status).toBe("inactive");
  });
});
