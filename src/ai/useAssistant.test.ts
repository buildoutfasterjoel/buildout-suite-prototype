import { describe, it, expect, beforeEach } from "vitest";
import { useAssistant } from "./useAssistant";

describe("useAssistant greetedThisSession", () => {
  beforeEach(() => useAssistant.setState({ greetedThisSession: false }));

  it("defaults to not greeted", () => {
    expect(useAssistant.getState().greetedThisSession).toBe(false);
  });
  it("setGreeted flips it", () => {
    useAssistant.getState().setGreeted(true);
    expect(useAssistant.getState().greetedThisSession).toBe(true);
  });
});
