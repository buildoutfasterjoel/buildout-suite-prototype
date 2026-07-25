import { describe, it, expect } from "vitest";
import { useCallStore } from "./useCallStore";
import type { HeroActions } from "./heroRecapExtensions";

const sample: HeroActions = {
  dealId: "d", dealName: "The Delgado Building", createdStage: "proposal",
  followUpTaskId: "t", followUpDate: "2026-07-30", narration: "…",
};

describe("useCallStore.heroActions", () => {
  it("sets and clears heroActions; reset clears it too", () => {
    useCallStore.getState().setHeroActions(sample);
    expect(useCallStore.getState().heroActions?.dealId).toBe("d");
    useCallStore.getState().clearHeroActions();
    expect(useCallStore.getState().heroActions).toBeNull();
    useCallStore.getState().setHeroActions(sample);
    useCallStore.getState().reset();
    expect(useCallStore.getState().heroActions).toBeNull();
  });
});
