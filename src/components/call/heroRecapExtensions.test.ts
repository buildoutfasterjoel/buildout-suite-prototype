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
  contactId, name, entity: "Delgado Properties LLC", phone: "555", initials: "RD",
  firstName: "Rosa", role: "owner", note: "",
});

const recap: CallRecapSpecT = {
  sentiment: "positive",
  keyPoints: ["Open to a conversation."],
  tasks: [],
  opportunity: { name: "The Delgado Building", address: "12 King St" },
};

describe("heroRecapExtensions", () => {
  beforeEach(() => hydrate());

  it("isHeroCall is true for the signal owner, false otherwise", () => {
    const rosa = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "rosa")!;
    const other = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey !== "rosa" && !c.signal)!;
    expect(isHeroCall(targetFor(rosa.id, rosa.firstName))).toBe(true);
    expect(isHeroCall(targetFor(other.id, other.firstName))).toBe(false);
  });

  it("opens the opportunity at proposal and schedules a follow-up (no auto-activate)", () => {
    const rosa = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "rosa")!;
    const actions = applyHeroRecapExtensions(
      { target: targetFor(rosa.id, rosa.firstName), recap },
      { now: new Date("2026-07-24T09:00:00") }, // a Friday
    )!;
    expect(actions).not.toBeNull();
    expect(actions.createdStage).toBe("proposal");
    expect(actions.followUpDate).toBe("2026-07-30"); // next Thursday
    const deal = useDataStore.getState().listings.get(actions.dealId)!;
    expect(deal.status).toBe("proposal"); // NOT "active"
    const task = useDataStore.getState().tasks.get(actions.followUpTaskId)!;
    expect(task).toBeTruthy();
    expect(task.dueDate).toBe("2026-07-30");
    expect(actions.narration).not.toContain("pipeline");
    expect(actions.narration).not.toContain("tour");
    expect(actions.narration).toContain("BOV");
  });

  it("undo removes the follow-up task and pulls the deal out of the pipeline", () => {
    const rosa = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "rosa")!;
    const actions = applyHeroRecapExtensions({ target: targetFor(rosa.id, rosa.firstName), recap })!;
    undoHeroActions(actions);
    expect(useDataStore.getState().tasks.get(actions.followUpTaskId)).toBeUndefined();
    expect(useDataStore.getState().listings.get(actions.dealId)!.status).toBe("inactive");
  });
});
