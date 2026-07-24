import { generateDraftReply } from "#/ai/generate";
import { useInboundEmail, type InboundEmail } from "./useInboundEmail";
import { addDealDocument, addDealMessage, getContact, getProperty, updateListingUnderwriting } from "#/data/store";
import { notify } from "#/lib/notify";
import { propertyQualifiesForUnderwriting } from "#/components/deals/underwriting/eligibility";
import { underwritingFromSelection, defaultSelectionFor } from "#/components/deals/underwriting/strategies";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { useAssistant } from "#/ai/useAssistant";
import { useBovDraft } from "./useBovDraft";

const ARRIVAL_MS = 10_000;

// Monotonic session so a cancel()/re-arm drops a pending or in-flight arrival.
let session = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/** The broker's post-call follow-up the owner is replying to (no prior email exists —
 * the broker called). Deterministic, drives the draft-reply. */
export function synthesizedOriginal(firstName: string): { subject: string; body: string } {
  return {
    subject: "Following up on our call",
    body:
      `Great speaking just now, ${firstName} — when you get a moment, could you send ` +
      `the current rent roll and the T-12? I'll take a look and come back with a valuation.`,
  };
}

/** Otto's spoken one-line summary/offer on arrival (one-way; not the email body). */
export function inboundSummaryText(inbound: InboundEmail): string {
  const first = inbound.from.split(" ")[0] || "the owner";
  const offer = inbound.canUnderwrite ? " Want me to underwrite it?" : "";
  return `${first} just replied and sent the rent roll and the T-12 — I filed both to the deal.${offer}`;
}

/** Kick off the existing underwriting generation on the deal (value-add fits an existing
 * multifamily; setting underwriting also keeps the row visible at the Active stage). */
export function startUnderwriting(dealId: string): void {
  updateListingUnderwriting(dealId, {
    ...underwritingFromSelection("value-add", defaultSelectionFor("value-add")),
    status: "generating",
  });
  useBovDraft.getState().armFor(dealId);
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

async function onArrive(dealId: string, ownerContactId: string, mySession: number) {
  if (mySession !== session) return;
  const contact = getContact(ownerContactId);
  if (!contact) return;
  const property = getProperty(contact.propertyIds[0] ?? "");
  const propertyName = property?.name ?? "the property";
  const original = synthesizedOriginal(contact.firstName);
  const from = contactFullName(contact);

  let res;
  try {
    res = await generateDraftReply({
      data: {
        original,
        candidate: {
          name: from,
          role: contact.role,
          entity: contact.company,
          note: contact.notes ?? "",
          phone: contact.phone,
        },
        property: { name: propertyName, signal: contact.signal?.detail ?? "" },
        firstName: contact.firstName,
      },
    });
  } catch {
    res = { tone: "interested" as const, body: `Sending the rent roll and T-12. — ${contact.firstName}` };
  }
  if (mySession !== session) return; // superseded during the await

  const now = new Date().toISOString();
  const attachments = [`${propertyName} — Rent Roll.xlsx`, `${propertyName} — T-12.pdf`];
  addDealDocument(dealId, { id: crypto.randomUUID(), name: attachments[0], uploadedAt: now, size: "2.1 MB", aiGenerated: false });
  addDealDocument(dealId, { id: crypto.randomUUID(), name: attachments[1], uploadedAt: now, size: "1.4 MB", aiGenerated: false });

  addDealMessage(dealId, { author: from, text: "Sent the rent roll and T-12 — filed to the deal." });
  notify({ title: `New email from ${from}`, description: "Rent roll + T-12 attached" });

  useInboundEmail.getState().setInbound({
    dealId,
    from,
    subject: `Re: ${original.subject}`,
    body: res.body,
    tone: res.tone,
    attachments,
    canUnderwrite: propertyQualifiesForUnderwriting(property),
  });
  useAssistant.getState().setOpen(true);
}

export const heroInbound = {
  /** Schedule the ~10s self-arrival. Bumps session so a prior pending arrival is dropped. */
  arm(dealId: string, ownerContactId: string) {
    clearTimer();
    session += 1;
    const mySession = session;
    timer = setTimeout(() => void onArrive(dealId, ownerContactId, mySession), ARRIVAL_MS);
  },
  /** Drop a pending/in-flight arrival (reset / new call / 4D replay). */
  cancel() {
    clearTimer();
    session += 1;
  },
};
