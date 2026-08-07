import { describe, expect, it } from "vitest";
import {
  foldThreads,
  groupByBucket,
  hiddenMessageCount,
  shortDateTime,
  visibleEvents,
  type TimelineEvent,
} from "#/components/contacts/timeline";

describe("shortDateTime", () => {
  it("keeps two messages minutes apart distinguishable", () => {
    // The failure this guards: `relativeTime` renders both of these as "3w ago".
    const a = shortDateTime("2026-07-06T13:12:00.000Z");
    const b = shortDateTime("2026-07-06T13:31:00.000Z");
    expect(a).not.toBe(b);
  });

  it("carries the date as well as the clock time", () => {
    const out = shortDateTime("2026-07-06T16:05:00.000Z");
    expect(out).toMatch(/Jul 6/);
    expect(out).toMatch(/\d:\d{2}\s?(AM|PM)/);
  });
});

describe("foldThreads", () => {
  const base = {
    id: "e1",
    actor: { name: "Ethan Thompson" },
    contact: { name: "Rosa Delgado", id: "c1" },
    timestamp: "2026-07-01T10:00:00.000Z",
    seq: 1,
    subject: "Pricing",
    source: "user" as const,
  };

  it("turns a sent email plus its inbound reply into one conversation", () => {
    const sent: TimelineEvent = {
      ...base,
      type: "email",
      direction: "out",
      body: "Here are the numbers.",
      reply: {
        replier: "Rosa Delgado",
        timestamp: "2026-07-02T09:00:00.000Z",
        body: "Looks right to me.",
      },
    };
    const out = foldThreads([sent]);
    const convo = out.find((e) => e.type === "conversation")!;

    // The reply is the newest message, so it's what the row previews and dates by.
    expect(convo.thread!.latestBody).toBe("Looks right to me.");
    expect(convo.timestamp).toBe("2026-07-02T09:00:00.000Z");
    // Two messages, so exactly one hides behind the toggle.
    expect(hiddenMessageCount(convo.thread!)).toBe(1);
    // The original survives as a member (that's what the Emails filter lists) and
    // no longer carries the nested reply.
    const member = out.find((e) => e.id === "e1")!;
    expect(member.threadId).toBe(convo.threadId);
    expect(member.reply).toBeUndefined();
  });

  it("hides members under All and lists them under Emails", () => {
    const sent: TimelineEvent = {
      ...base,
      type: "email",
      direction: "out",
      body: "Here are the numbers.",
      reply: { replier: "Rosa Delgado", body: "Looks right to me." },
    };
    const folded = foldThreads([sent]);
    expect(visibleEvents(folded, "all").map((e) => e.type)).toEqual([
      "conversation",
    ]);
    expect(visibleEvents(folded, "emails").every((e) => e.type !== "conversation")).toBe(
      true,
    );
  });

  it("advances an existing conversation instead of adding a row", () => {
    const convo: TimelineEvent = {
      ...base,
      id: "convo-1",
      type: "conversation",
      threadId: "t1",
      thread: {
        latestSender: "Rosa Delgado",
        latestBody: "What next?",
        messages: [
          {
            id: "m1",
            direction: "in",
            sender: "Rosa Delgado",
            timestamp: "2026-07-01T10:00:00.000Z",
            body: "What next?",
          },
        ],
      },
    };
    const out = foldThreads([convo], {
      "convo-1": [
        {
          id: "r1",
          body: "I'll send the counter.",
          timestamp: "2026-07-03T12:00:00.000Z",
          sender: "Ethan Thompson",
        },
      ],
    });

    expect(out).toHaveLength(1);
    expect(out[0].thread!.messages).toHaveLength(2);
    expect(out[0].thread!.latestBody).toBe("I'll send the counter.");
    // Re-dated to the reply, which is what floats it back to the top of the feed.
    expect(out[0].timestamp).toBe("2026-07-03T12:00:00.000Z");
  });

  it("leaves an email with no reply alone", () => {
    const sent: TimelineEvent = {
      ...base,
      type: "email",
      direction: "out",
      body: "Here are the numbers.",
    };
    expect(foldThreads([sent])).toEqual([sent]);
  });
});

describe("groupByBucket — pinned", () => {
  const row = (id: string, timestamp: string, pinned = false): TimelineEvent => ({
    id,
    type: "note",
    actor: { name: "Ethan Thompson" },
    timestamp,
    seq: 1,
    source: "user",
    pinned,
  });
  const now = new Date("2026-08-07T12:00:00.000Z").getTime();

  it("lifts a pinned row out of its time bucket into its own heading", () => {
    const groups = groupByBucket(
      [
        row("recent", "2026-08-06T10:00:00.000Z"),
        // A year old: would otherwise be filed under "Earlier".
        row("old-pinned", "2025-02-01T10:00:00.000Z", true),
      ],
      now,
    );
    expect(groups[0].bucket).toBe("Pinned");
    expect(groups[0].events.map((e) => e.id)).toEqual(["old-pinned"]);
    // And it doesn't also appear further down.
    expect(groups.slice(1).flatMap((g) => g.events.map((e) => e.id))).toEqual([
      "recent",
    ]);
  });

  it("omits the Pinned heading when nothing is pinned", () => {
    const groups = groupByBucket([row("a", "2026-08-06T10:00:00.000Z")], now);
    expect(groups.map((g) => g.bucket)).not.toContain("Pinned");
  });
});

describe("foldThreads — actors and attachments", () => {
  const outbound: TimelineEvent = {
    id: "e1",
    type: "email",
    direction: "out",
    actor: { name: "Ethan Thompson" },
    contact: { name: "Rosa Delgado", id: "c1" },
    timestamp: "2026-07-01T10:00:00.000Z",
    seq: 1,
    subject: "Financials",
    body: "Sending the pack.",
    source: "user",
    attachments: [{ name: "T12.pdf", meta: "PDF · 268 KB" }],
  };

  it("reads as the contact → the broker once they answer last", () => {
    const folded = foldThreads([
      { ...outbound, reply: { replier: "Rosa Delgado", timestamp: "2026-07-02T09:00:00.000Z", body: "Got it." } },
    ]);
    const convo = folded.find((e) => e.type === "conversation")!;
    expect(convo.actor.name).toBe("Rosa Delgado");
    expect(convo.contact?.name).toBe("Ethan Thompson");
  });

  it("flips back when the broker replies after them", () => {
    const folded = foldThreads(
      [{ ...outbound, reply: { replier: "Rosa Delgado", timestamp: "2026-07-02T09:00:00.000Z", body: "Got it." } }],
      {
        e1: [
          {
            id: "r1",
            body: "Anything else?",
            timestamp: "2026-07-03T09:00:00.000Z",
            sender: "Ethan Thompson",
          },
        ],
      },
    );
    const convo = folded.find((e) => e.type === "conversation")!;
    expect(convo.actor.name).toBe("Ethan Thompson");
    expect(convo.contact?.name).toBe("Rosa Delgado");
  });

  it("keeps attachments on the message that carried them", () => {
    const folded = foldThreads(
      [outbound],
      {
        e1: [
          {
            id: "r1",
            body: "Thanks!",
            timestamp: "2026-07-03T09:00:00.000Z",
            sender: "Ethan Thompson",
          },
        ],
      },
    );
    const convo = folded.find((e) => e.type === "conversation")!;
    const [original, reply] = convo.thread!.messages;

    expect(original.attachments?.map((a) => a.name)).toEqual(["T12.pdf"]);
    // The reply carried nothing, so nothing rides along with it…
    expect(reply.attachments).toBeUndefined();
    // …and the row no longer hoists them to the top.
    expect(convo.attachments).toBeUndefined();
    // The paperclip still flags that the exchange holds a file.
    expect(convo.hasAttachment).toBe(true);
  });
});

describe("foldThreads — replying to an already-folded conversation", () => {
  const sent: TimelineEvent = {
    id: "e1",
    type: "email",
    direction: "out",
    actor: { name: "Ethan Thompson" },
    contact: { name: "Rosa Delgado", id: "c1" },
    timestamp: "2026-02-01T10:00:00.000Z",
    seq: 1,
    subject: "BOV",
    body: "Here's the analysis.",
    source: "user",
    reply: {
      replier: "Rosa Delgado",
      timestamp: "2026-02-02T09:00:00.000Z",
      body: "This is more rigorous than the others.",
    },
  };

  it("accepts a reply stored against the derived thread key", () => {
    // The conversation this produces carries `threadId: "e1-thread"`, so the panel
    // keys a reply to it under that — not under "e1". Reading only the event id
    // here dropped the reply and left the thread where it was.
    const convoBefore = foldThreads([sent]).find((e) => e.type === "conversation")!;
    expect(convoBefore.threadId).toBe("e1-thread");

    const folded = foldThreads([sent], {
      "e1-thread": [
        {
          id: "r1",
          body: "Confirming receipt.",
          timestamp: "2026-08-07T09:00:00.000Z",
          sender: "Ethan Thompson",
        },
      ],
    });
    const convo = folded.find((e) => e.type === "conversation")!;

    expect(convo.thread!.latestBody).toBe("Confirming receipt.");
    // Re-dated to the reply, which is what carries it to the top of the feed.
    expect(convo.timestamp).toBe("2026-08-07T09:00:00.000Z");
    expect(hiddenMessageCount(convo.thread!)).toBe(2);
  });

  it("still refuses to let arc thread members swallow the conversation's reply", () => {
    // Members share the conversation's threadId. If they matched it, each would
    // fold into a conversation of its own.
    const member: TimelineEvent = {
      ...sent,
      id: "m1",
      reply: undefined,
      threadId: "arc-thread",
    };
    const out = foldThreads([member], {
      "arc-thread": [
        { id: "r9", body: "hi", timestamp: "2026-08-07T09:00:00.000Z", sender: "Ethan Thompson" },
      ],
    });
    expect(out).toEqual([member]);
  });
});
