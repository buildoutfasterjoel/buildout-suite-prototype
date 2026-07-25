import { addDealDocument, addDealMessage, getContact, getListing } from "#/data/store";
import { updateDealTask } from "#/data/actions";
import { notify } from "#/lib/notify";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { useAssistant } from "#/ai/useAssistant";
import { useClosingEmail } from "./useClosingEmail";

export const SIGNED_AGREEMENT_DOC = {
  name: "The Delgado Building — Listing Agreement (Signed).pdf",
  size: "0.3 MB",
};

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

function onArrive(dealId: string, ownerContactId: string, mySession: number) {
  if (mySession !== session) return;
  const contact = getContact(ownerContactId);
  if (!contact) return;
  const from = contactFullName(contact);
  const now = new Date().toISOString();

  addDealDocument(dealId, {
    id: crypto.randomUUID(),
    name: SIGNED_AGREEMENT_DOC.name,
    size: SIGNED_AGREEMENT_DOC.size,
    uploadedAt: now,
    aiGenerated: false,
  });

  const deal = getListing(dealId);
  const task = deal?.tasks.find((t) => t.label === "Upload executed listing agreement");
  if (task) {
    updateDealTask(dealId, task.id, { status: "complete" });
  }

  addDealMessage(dealId, { author: from, text: "Signed listing agreement attached." });
  notify({ title: "New email from Rosa Delgado", description: "Signed listing agreement attached" });

  useClosingEmail.getState().set({ dealId, from });
  useAssistant.getState().setOpen(true);
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
