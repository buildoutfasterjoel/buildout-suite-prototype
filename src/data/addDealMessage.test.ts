import { describe, expect, it } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { addDealMessage } from "#/data/store";

function anyDealId(): string {
  const first = [...useDataStore.getState().listings.values()][0];
  if (!first) throw new Error("no seeded listings");
  return first.id;
}

describe("addDealMessage", () => {
  it("appends a message with a generated id and timestamp", () => {
    const id = anyDealId();
    const before = useDataStore.getState().listings.get(id)!.messages.length;

    const updated = addDealMessage(id, {
      author: "John Whitfield",
      text: "Hello team",
    });

    expect(updated).toBeDefined();
    const messages = useDataStore.getState().listings.get(id)!.messages;
    expect(messages.length).toBe(before + 1);
    const last = messages[messages.length - 1];
    expect(last.author).toBe("John Whitfield");
    expect(last.text).toBe("Hello team");
    expect(last.id).toBeTruthy();
    expect(last.timestamp).toBeTruthy();
  });

  it("returns undefined for an unknown listing", () => {
    expect(
      addDealMessage("does-not-exist", { author: "X", text: "Y" }),
    ).toBeUndefined();
  });
});
