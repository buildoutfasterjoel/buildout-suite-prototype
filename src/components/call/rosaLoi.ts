import { addDealDocument, getContact, getListingsForProperty } from "#/data/store";
import { touchContactActivity } from "#/data/actions";
import { notify } from "#/lib/notify";
import { playArrivalChime } from "#/lib/chime";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { useContactSession } from "#/components/contacts/useContactSession";
import { DELGADO_LOI } from "./rosaDocs";
import { DELGADO_BUYER_LEAD_ID } from "./rosaLeads";

/** The LOI email's timeline-row id. Deterministic so `addSimEvent` dedupes it
 * and a replay-reset can clear it by id. */
export const DELGADO_LOI_EMAIL_ID = "sim-delgado-loi-email";

/** Delay from the call being logged to the email landing — long enough to read
 * as "he went straight back to his desk", short enough not to stall the demo. */
export const ARRIVAL_MS = 6_000;

// Monotonic session so a cancel()/re-arm drops a pending arrival.
let session = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/**
 * The payoff on the lead run: the last lead the broker called — Marcus Trejo,
 * the local operator — emails in a letter of intent on the Delgado Building.
 * The paperwork is real the moment he sends it (the pdf files onto the deal's
 * documents) and the email self-arrives as an actionable row on *his* contact
 * timeline, which is exactly where the call session left the broker standing.
 */
function onArrive(contactId: string, propertyId: string, mySession: number) {
  if (mySession !== session) return;
  const contact = getContact(contactId);
  if (!contact) return;
  const deal = getListingsForProperty(propertyId)[0];
  const from = contactFullName(contact);
  const now = new Date().toISOString();

  if (deal) {
    addDealDocument(deal.id, {
      id: crypto.randomUUID(),
      name: DELGADO_LOI.name,
      size: DELGADO_LOI.size,
      uploadedAt: now,
      aiGenerated: false,
    });
  }

  const subject = "LOI — The Delgado Building";
  useContactSession.getState().addSimEvent(contactId, {
    id: DELGADO_LOI_EMAIL_ID,
    type: "inbound-email",
    actor: { name: from },
    direction: "in",
    timestamp: now,
    seq: 2_000_002,
    subject,
    body:
      "John — good call. I've walked past that building for fifteen years and I already know what it is. Attached is our letter of intent: all cash, thirty-day close, no financing contingency. I'm not going to gut it and I'm not going to churn the tenants. Tell the owner that part. — Marcus",
    hasAttachment: true,
    attachments: [{ name: DELGADO_LOI.name, meta: DELGADO_LOI.meta }],
    associations: deal
      ? [{ type: "deal", label: deal.name, id: deal.id }]
      : undefined,
    source: "user",
  });
  touchContactActivity(contactId);
  playArrivalChime();
  notify({ title: `New email from ${from}`, description: subject });
}

export const rosaLoi = {
  /** Schedule the ~6s self-arrival of the buyer's LOI onto his own timeline
   * (armed once his call is logged — see GlobalLogCallModal). Bumps session so
   * a prior pending arrival is dropped. */
  arm(contactId: string, propertyId: string) {
    clearTimer();
    session += 1;
    const mySession = session;
    timer = setTimeout(
      () => onArrive(contactId, propertyId, mySession),
      ARRIVAL_MS,
    );
  },
  /**
   * Arm the LOI iff the call that was just logged was the buyer lead's — the
   * last name on the Delgado leads list. Every other logged call (including the
   * two leads ahead of him) is a no-op, so the beat can only land at the end of
   * the run. Returns whether it armed.
   */
  maybeArmFor(contactId: string): boolean {
    if (contactId !== DELGADO_BUYER_LEAD_ID) return false;
    const propertyId = getContact(contactId)?.propertyIds[0];
    if (!propertyId) return false;
    this.arm(contactId, propertyId);
    return true;
  },

  /** Drop a pending/in-flight arrival (reset / new call / replay). */
  cancel() {
    clearTimer();
    session += 1;
  },
};
