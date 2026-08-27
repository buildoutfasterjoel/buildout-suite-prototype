import { describe, it, expect, beforeEach } from "vitest";
import { useContactSession, documentsFromContact } from "./useContactSession";
import type { TimelineEvent } from "./timeline";

const event = (over: Partial<TimelineEvent> & { id: string; seq: number }): TimelineEvent =>
  ({
    type: "inbound-email",
    actor: { name: "Rosa Delgado" },
    direction: "in",
    timestamp: "2026-08-26T12:00:00.000Z",
    subject: "Files",
    body: "",
    source: "user",
    ...over,
  }) as TimelineEvent;

describe("documentsFromContact", () => {
  beforeEach(() =>
    useContactSession.setState({ logged: {}, simEvents: {}, resolved: {}, flags: {} }),
  );

  it("returns nothing for a contact with no session events", () => {
    expect(documentsFromContact("nobody")).toEqual([]);
  });

  it("collects attachments from inbound rows, newest first", () => {
    useContactSession.setState({
      simEvents: {
        c1: [
          event({ id: "a", seq: 1, attachments: [{ name: "T12.pdf", meta: "PDF · 268 KB" }] }),
          event({ id: "b", seq: 2, attachments: [{ name: "RentRoll.xlsx", meta: "XLSX · 96 KB" }] }),
        ],
      },
    });
    expect(documentsFromContact("c1").map((d) => d.name)).toEqual([
      "RentRoll.xlsx",
      "T12.pdf",
    ]);
  });

  it("ignores outbound rows — a deal carries what they sent US", () => {
    useContactSession.setState({
      simEvents: {
        c1: [
          event({
            id: "sent",
            seq: 1,
            direction: "out",
            attachments: [{ name: "BOV.pdf", meta: "PDF · 2.4 MB" }],
          }),
        ],
      },
    });
    expect(documentsFromContact("c1")).toEqual([]);
  });

  it("dedupes by name, keeping the newest", () => {
    useContactSession.setState({
      simEvents: {
        c1: [
          event({ id: "a", seq: 1, attachments: [{ name: "T12.pdf", meta: "old" }] }),
          event({ id: "b", seq: 2, attachments: [{ name: "T12.pdf", meta: "new" }] }),
        ],
      },
    });
    expect(documentsFromContact("c1")).toEqual([{ name: "T12.pdf", meta: "new" }]);
  });
});
