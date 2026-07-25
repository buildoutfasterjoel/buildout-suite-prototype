import { addDealDocument, getContact, getListing } from "#/data/store";
import { updateDealTask } from "#/data/actions";
import { notify } from "#/lib/notify";
import { playArrivalChime } from "#/lib/chime";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { useContactSession } from "#/components/contacts/useContactSession";
import { ROSA_SIGNED_AGREEMENT } from "./rosaDocs";

/** The signed-agreement email's timeline-row id. Deterministic so `addSimEvent`
 * dedupes it and R2's replay-reset can clear it by id. */
export const ROSA_AGREEMENT_EMAIL_ID = "sim-rosa-signed-agreement-email";

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
 * The arc's closing beat: after the BOV goes out, Rosa returns the signed
 * listing agreement. The paperwork is real the moment she sends it — the pdf
 * files onto the deal and the planner's "Upload executed listing agreement"
 * task completes — and it self-arrives as an actionable row on her contact
 * timeline carrying an "Activate Listing" action.
 */
function onArrive(dealId: string, ownerContactId: string, mySession: number) {
  if (mySession !== session) return;
  const contact = getContact(ownerContactId);
  if (!contact) return;
  const from = contactFullName(contact);
  const now = new Date().toISOString();

  addDealDocument(dealId, {
    id: crypto.randomUUID(),
    name: ROSA_SIGNED_AGREEMENT.name,
    size: ROSA_SIGNED_AGREEMENT.size,
    uploadedAt: now,
    aiGenerated: false,
  });

  const deal = getListing(dealId);
  const task = deal?.tasks.find((t) => t.label === "Upload executed listing agreement");
  if (task) {
    updateDealTask(dealId, task.id, { status: "complete" });
  }

  const subject = "Signed — the listing agreement";
  useContactSession.getState().addSimEvent(ownerContactId, {
    id: ROSA_AGREEMENT_EMAIL_ID,
    type: "inbound-email",
    actor: { name: from },
    direction: "in",
    timestamp: now,
    seq: 2_000_001,
    subject,
    body:
      "John — Miguel never signed anything until he trusted the person across the table. I read the BOV twice, and then the agreement twice more. It's signed and attached. Find the operator who'll love this building the way he did. — Rosa",
    hasAttachment: true,
    attachments: [{ name: ROSA_SIGNED_AGREEMENT.name, meta: ROSA_SIGNED_AGREEMENT.meta }],
    actionBar: { primary: "Activate Listing", ghosts: ["Reply"] },
    source: "user",
  });
  playArrivalChime();
  notify({ title: `New email from ${from}`, description: subject });
}

export const rosaClosing = {
  /** Schedule the ~6s self-arrival of the signed listing agreement. Bumps
   * session so a prior pending arrival is dropped. */
  arm(dealId: string, ownerContactId: string) {
    clearTimer();
    session += 1;
    const mySession = session;
    timer = setTimeout(() => onArrive(dealId, ownerContactId, mySession), ARRIVAL_MS);
  },
  /** Drop a pending/in-flight arrival (reset / new call / 4D replay). */
  cancel() {
    clearTimer();
    session += 1;
  },
};
