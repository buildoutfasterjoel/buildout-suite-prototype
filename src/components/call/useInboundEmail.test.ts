import { describe, it, expect } from "vitest";
import { useInboundEmail, type InboundEmail } from "./useInboundEmail";

const sample: InboundEmail = {
  dealId: "d", from: "Rosa Delgado", subject: "Re: Following up on our call",
  body: "…", tone: "interested", attachments: ["The Delgado Building — Rent Roll.xlsx"], canUnderwrite: true,
};

describe("useInboundEmail", () => {
  it("sets and clears the inbound email", () => {
    useInboundEmail.getState().setInbound(sample);
    expect(useInboundEmail.getState().inbound?.dealId).toBe("d");
    useInboundEmail.getState().clearInbound();
    expect(useInboundEmail.getState().inbound).toBeNull();
  });
});
