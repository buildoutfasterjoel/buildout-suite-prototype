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
   * The asymmetry the whole `collapsedBy` field exists for: folding is the only
   * automatic move. Nothing opens the card except news, so there is no automatic
   * unfold to argue with a hand fold — and `autoFold` leaves a hand fold alone
   * rather than re-stamping it as its own.
   */
  it("folds on its own when the broker hasn't intervened", () => {
    state().autoFold();
    expect(state().collapsedBy).toBe("auto");
  });

  it("leaves a hand fold as the broker's, so it keeps its precedence", () => {
    state().setCollapsed(true);
    state().autoFold();
    expect(state().collapsedBy).toBe("user");
  });

  it("folds again after a deliberate unfold — attention moved, not a veto", () => {
    // An explicit unfold is "show me now", which the next thing they do satisfies.
    state().setCollapsed(true);
    state().setCollapsed(false);
    state().autoFold();
    expect(state().collapsedBy).toBe("auto");
  });

  it("offers no automatic way to open the card", () => {
    // The guarantee behind "nothing opens it except news": if a second automatic
    // unfold ever appears, it has to argue with `revive` and the clear paths, and
    // this is the test that notices.
    expect(state()).not.toHaveProperty("autoCollapse");
    expect(state()).not.toHaveProperty("autoExpand");
  });

  /**
   * News opens it, even over a hand fold. A fold made early in a session was
   * otherwise swallowing every later hand-off, so finishing a move looked like
   * the card was broken.
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

  it("opens a freshly armed queue, whatever the last one's fold was", () => {
    state().autoFold();
    arm();
    expect(state().collapsedBy).toBeNull();
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

describe("park no longer detaches or hides", () => {
  it("parks without any slot-switching side effect", () => {
    state().park("t-rosa");
    expect(state().parkedFor).toBe("t-rosa");
    // `detached` is gone: the card is pinned from the moment it is armed, so
    // there is no second slot to switch to.
    expect(state()).not.toHaveProperty("detached");
  });

  /**
   * Parking must not fold the card by itself. The rail folds it for the duration
   * of a live call (any call, not just one the queue started), which keeps that
   * decision in one place and keeps a hand fold's precedence intact — a `park`
   * that also folded would be a second, competing author of `collapsedBy`.
   */
  it("leaves the fold alone — the rail owns that while a call is live", () => {
    expect(state().collapsedBy).toBeNull();
    state().park("t-rosa");
    expect(state().collapsedBy).toBeNull();
  });

  it("resume clears the parked move and returns to the top", () => {
    state().park("t-rosa");
    state().resume("Call logged. Next up…");
    expect(state().parkedFor).toBeNull();
    expect(state().cleared).toEqual(["t-rosa"]);
    expect(state().index).toBe(0);
  });
});
