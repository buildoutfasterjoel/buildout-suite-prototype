import { LogCallModal } from "#/components/contacts/LogCallModal";
import type { ComposedDraft } from "#/components/contacts/ContactComposeModule";
import { useContactSession } from "#/components/contacts/useContactSession";
import { heroInbound } from "#/components/call/heroInbound";
import { useCallSession } from "#/components/call/useCallSession";
import { usePendingCallLog } from "#/components/call/usePendingCallLog";
import { useDataStore } from "#/data/dataStore";
import { getContactDetailClient } from "#/data/selectors";
import { addNote } from "#/data/actions";
import { notify } from "#/lib/notify";

/**
 * The single, app-wide post-call logging modal. A call that ends writes nothing
 * on its own (see `callFlow.endCall`) — it queues a pending log here with the
 * AI's summary, and only the broker's "Log Call" click records it. Mounted in
 * the AppShell so a call started from anywhere (dashboard CTA, the assistant,
 * a timeline row) lands the same modal.
 */
export function GlobalLogCallModal() {
  const pending = usePendingCallLog((s) => s.pending);
  // Keep the resolved contact/deals fresh if the store changes underneath.
  useDataStore((s) => s.contacts);
  useDataStore((s) => s.listings);

  const detail = pending ? getContactDetailClient(pending.contactId) : null;
  if (!pending || !detail) return null;

  const { contact, deals } = detail;

  const handleLog = (draft: ComposedDraft) => {
    // Now that the broker has confirmed, write the call: the contact's timeline
    // (session feed) and its notes history (persisted record).
    useContactSession.getState().addLog(contact.id, draft);
    const summary = draft.body.trim();
    addNote(
      contact.id,
      `Call with ${contact.firstName} — ${draft.outcome ?? "Connected"}.${
        summary ? ` ${summary}` : ""
      }`,
    );
    notify({ title: "Call logged", description: contact.firstName });
    // The hero's follow-up email follows the *logged* call, not hang-up, so the
    // story beats stay in order (and can't land behind this modal).
    if (pending.armHeroInbound) heroInbound.arm(contact.id);
    usePendingCallLog.getState().clear();
    // In a call session, the confirmed log is the cue to dial the next contact.
    if (useCallSession.getState().active) useCallSession.getState().advance();
  };

  return (
    <LogCallModal
      open
      contact={contact}
      deals={deals}
      draft={pending.draft}
      initialOutcome={pending.outcome}
      onLog={handleLog}
    />
  );
}
