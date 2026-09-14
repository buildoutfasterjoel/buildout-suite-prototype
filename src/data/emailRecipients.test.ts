import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { getEmails, getEmailPerformance } from "#/data/emails";
import {
  countByAction,
  formatRecipientDate,
  getEmailRecipients,
  RECIPIENT_ACTIONS,
} from "#/data/emailRecipients";

beforeEach(() => {
  useDataStore.setState(seedSlice());
});

const sentEmail = () => getEmails().find((e) => e.status === "sent")!;

describe("getEmailRecipients", () => {
  it("is stable across calls", () => {
    const email = sentEmail();
    const perf = getEmailPerformance(email);
    expect(getEmailRecipients(email, perf)).toEqual(
      getEmailRecipients(email, perf),
    );
  });

  it("draws distinct real contacts, dated from the send", () => {
    const email = sentEmail();
    const perf = getEmailPerformance(email);
    const recipients = getEmailRecipients(email, perf);

    expect(recipients.length).toBeGreaterThan(0);
    expect(new Set(recipients.map((r) => r.contactId)).size).toBe(
      recipients.length,
    );
    // Repeated names read as a duplicate send, so they're filtered out.
    expect(new Set(recipients.map((r) => r.name)).size).toBe(recipients.length);
    for (const r of recipients) {
      expect(useDataStore.getState().contacts.get(r.contactId)).toBeDefined();
      expect(r.date >= perf.sentDate).toBe(true);
    }
  });

  it("gives every action a share of a large-enough roster", () => {
    // The chips only read right if the weights actually land across the board.
    const actions = new Set(
      getEmails()
        .filter((e) => e.status === "sent")
        .flatMap((e) => getEmailRecipients(e, getEmailPerformance(e)))
        .map((r) => r.action),
    );
    expect([...actions].sort()).toEqual([...RECIPIENT_ACTIONS].sort());
  });
});

describe("countByAction", () => {
  it("partitions the roster — chip counts sum to the total", () => {
    const email = sentEmail();
    const recipients = getEmailRecipients(email, getEmailPerformance(email));
    const counts = countByAction(recipients);
    const total = RECIPIENT_ACTIONS.reduce((n, a) => n + counts[a], 0);
    expect(total).toBe(recipients.length);
  });

  it("keeps the funnel in order on every campaign", () => {
    // The quota deal exists so no roster ever shows more Opened than Delivered.
    for (const email of getEmails().filter((e) => e.status === "sent")) {
      const counts = countByAction(
        getEmailRecipients(email, getEmailPerformance(email)),
      );
      expect(counts.Delivered).toBeGreaterThanOrEqual(counts.Opened);
      expect(counts.Opened).toBeGreaterThanOrEqual(counts.Clicked);
      expect(counts.Clicked).toBeGreaterThanOrEqual(counts["Spam Reports"]);
    }
  });
});

describe("formatRecipientDate", () => {
  it("renders ISO as MM/DD/YYYY", () => {
    expect(formatRecipientDate("2026-02-20")).toBe("02/20/2026");
  });
});
