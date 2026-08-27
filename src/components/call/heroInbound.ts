import { getContact } from "#/data/store";
import { touchContactActivity } from "#/data/actions";
import { notify } from "#/lib/notify";
import { playArrivalChime } from "#/lib/chime";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { useContactSession } from "#/components/contacts/useContactSession";
import { ROSA_FINANCIAL_DOCS } from "./rosaDocs";

/** The financials email's timeline-row id. Deterministic so `addSimEvent`
 * dedupes it and R2's replay-reset can clear it by id. */
export const ROSA_FINANCIALS_EMAIL_ID = "sim-rosa-financials-email";

/** Delay from the call being logged to the email landing — long enough to read
 * as "she just sent it", short enough not to stall the demo. */
const ARRIVAL_MS = 6_000;

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
 * Rosa's story beat: after the called-back call ends, she sends Miguel's
 * financials. The email self-arrives as an actionable row on HER contact
 * timeline — T-12 + rent roll attached, "Start a Deal" primary action. No deal
 * exists yet; it's created when the broker acts on this row.
 */
function onArrive(contactId: string, mySession: number) {
  if (mySession !== session) return;
  const contact = getContact(contactId);
  if (!contact) return;
  const from = contactFullName(contact);
  const subject = "Miguel's files — the T-12 and rent roll";

  useContactSession.getState().addSimEvent(contactId, {
    id: ROSA_FINANCIALS_EMAIL_ID,
    type: "inbound-email",
    actor: { name: from },
    direction: "in",
    timestamp: new Date().toISOString(),
    seq: 2_000_000,
    subject,
    body:
      "John — I went through Miguel's cabinet after we spoke. Attached are the full trailing twelve months and the current rent roll, exactly as he kept them. I'm not saying yes to anything yet. But you should see what the building actually does before we talk again. — Rosa",
    hasAttachment: true,
    attachments: ROSA_FINANCIAL_DOCS.map(({ name, meta }) => ({ name, meta })),
    actionBar: { primary: "Start a Deal", ghosts: ["Reply"] },
    source: "user",
  });
  touchContactActivity(contactId);
  playArrivalChime();
  notify({ title: `New email from ${from}`, description: subject });
}

export const heroInbound = {
  /** Schedule the self-arrival of Rosa's financials email onto her contact
   * timeline (armed once the call is logged — see GlobalLogCallModal). Bumps
   * session so a prior pending arrival is dropped. */
  arm(contactId: string) {
    clearTimer();
    session += 1;
    const mySession = session;
    timer = setTimeout(() => onArrive(contactId, mySession), ARRIVAL_MS);
  },
  /** Drop a pending/in-flight arrival (reset / new call / 4D replay). */
  cancel() {
    clearTimer();
    session += 1;
  },
};
