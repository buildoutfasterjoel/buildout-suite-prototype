import { describe, it, expect, beforeEach } from "vitest";
import type { DayPlanItem } from "#/ai/dayPlan";
import { useDayPlanQueue, dayPlanKey } from "./useDayPlanQueue";

/** Two queued moves, one per contact, so `clearForContact` has something to miss. */
const ITEMS: DayPlanItem[] = [
  {
    taskId: "t-rosa",
    kind: "signal",
    headline: "Rosa → call on the overnight signal",
    reason: "A maturing loan.",
    isCall: true,
    contactId: "c-rosa",
    contactName: "Rosa Delgado",
  },
  {
    taskId: "t-luigi",
    kind: "task",
    headline: "Luigi → execute the PSA",
    reason: "Due 13 days ago.",
    isCall: false,
    contactId: "c-luigi",
    contactName: "Luigi Ferrara",
  },
] as DayPlanItem[];

const arm = () => useDayPlanQueue.getState().arm(dayPlanKey(ITEMS), ITEMS);
const state = () => useDayPlanQueue.getState();

beforeEach(() => {
  // `arm` spreads EMPTY, so this is a full reset as well as a setup.
  arm();
});

describe("collapse precedence", () => {
  /**
   * The rule the whole `collapsedBy` field exists for: an automatic gesture may
   * undo an automatic gesture, never an explicit one.
   */
  it("does not unfold what the broker folded by hand", () => {
    state().setCollapsed(true);
    state().autoCollapse(false);
    expect(state().collapsedBy).toBe("user");
  });

  it("does not fold over a deliberate unfold either", () => {
    state().setCollapsed(true);
    state().setCollapsed(false);
    // Back to null by their own hand — but they last acted, so an auto-fold
    // would still be overriding them... only until they act again. An explicit
    // unfold is recorded as `null`, which auto-fold IS allowed to take, because
    // otherwise the queue could never fold again for the rest of the session.
    state().autoCollapse(true);
    expect(state().collapsedBy).toBe("auto");
  });

  it("folds and unfolds on its own when the broker hasn't intervened", () => {
    state().autoCollapse(true);
    expect(state().collapsedBy).toBe("auto");
    state().autoCollapse(false);
    expect(state().collapsedBy).toBeNull();
  });

  it("lets the broker fold over an automatic fold, and keeps it", () => {
    state().autoCollapse(true);
    state().setCollapsed(true);
    state().autoCollapse(false);
    expect(state().collapsedBy).toBe("user");
  });

  /**
   * The one exception, and the reason it exists: a fold made early in a session
   * was silently swallowing every later hand-off, so finishing a move looked
   * like the card was broken.
   */
  it("opens on completion even over a manual fold", () => {
    state().setCollapsed(true);
    state().clear("t-rosa", "Marked done. Next up…");
    expect(state().collapsedBy).toBeNull();
  });

  it("opens when a call finishes the move, over a manual fold", () => {
    state().setCollapsed(true);
    state().park("t-rosa");
    state().resume("Call logged. Next up…");
    expect(state().collapsedBy).toBeNull();
  });

  it("opens when an email finishes the move, over a manual fold", () => {
    state().setCollapsed(true);
    state().clearForContact("c-rosa", "Emailed them. Next up…");
    expect(state().collapsedBy).toBeNull();
  });

  it("stays folded when an email matched nobody in the queue", () => {
    state().setCollapsed(true);
    state().clearForContact("c-nobody", "Emailed them. Next up…");
    expect(state().collapsedBy).toBe("user");
  });

  it("reopens on revive regardless of who folded it", () => {
    state().setCollapsed(true);
    state().dismiss();
    state().revive();
    expect(state().collapsedBy).toBeNull();
    expect(state().dismissed).toBe(false);
  });
});

describe("clearForContact", () => {
  it("drops the move for the contact that was reached", () => {
    state().clearForContact("c-rosa", "Emailed them. Next up…");
    expect(state().cleared).toEqual(["t-rosa"]);
    expect(state().note).toBe("Emailed them. Next up…");
    expect(state().index).toBe(0);
  });

  it("leaves the queue alone for someone who isn't in it", () => {
    state().clearForContact("c-nobody", "Emailed them. Next up…");
    expect(state().cleared).toEqual([]);
    expect(state().note).toBeNull();
  });

  it("does not clear the same move twice", () => {
    state().clearForContact("c-rosa", "first");
    state().clearForContact("c-rosa", "second");
    expect(state().cleared).toEqual(["t-rosa"]);
    // The second call found nothing left to clear, so it left the note alone.
    expect(state().note).toBe("first");
  });

  it("does NOT complete the task record — clearing is not finishing", () => {
    // Nothing here touches tasks; the assertion is that the store's surface
    // offers no way to, so an email can't silently tick off a deliverable.
    state().clearForContact("c-luigi", "Emailed them. Next up…");
    expect(state().cleared).toEqual(["t-luigi"]);
    expect(Object.keys(state())).not.toContain("completeTask");
  });
});

describe("park no longer detaches", () => {
  it("parks without any slot-switching side effect", () => {
    state().park("t-rosa");
    expect(state().parkedFor).toBe("t-rosa");
    // `detached` is gone: the card is pinned from the moment it is armed, so
    // there is no second slot to switch to.
    expect(state()).not.toHaveProperty("detached");
  });

  it("resume clears the parked move and returns to the top", () => {
    state().park("t-rosa");
    state().resume("Call logged. Next up…");
    expect(state().parkedFor).toBeNull();
    expect(state().cleared).toEqual(["t-rosa"]);
    expect(state().index).toBe(0);
  });
});
