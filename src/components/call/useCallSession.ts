import { create } from "zustand";
import { getContact } from "#/data/store";
import { notify } from "#/lib/notify";
import { checkContactRight } from "#/components/contacts/contactRights";

/**
 * A run of calls down a list — a contact list, a deal's leads, or a hand-picked
 * selection. The store is just the queue and where we are in it; the dialing,
 * navigation, and controls live in `CallSessionController`, which watches
 * `index` and places each call.
 *
 * The session advances only when a call has been logged (the Log Call modal's
 * confirm) or explicitly skipped, so it can never run ahead of the broker.
 */
interface CallSessionState {
  active: boolean;
  /** Contact ids still to dial, in order — index 0 is the first call. */
  queue: string[];
  /** Position in `queue`; `queue.length` means the run is finished. */
  index: number;
  /** Where the queue came from, e.g. "Cold Prospects to Revive". */
  label: string;
  /** Calls logged in this session (skips don't count). */
  logged: number;

  start: (contactIds: string[], label: string) => void;
  /** A call was logged — move to the next contact. */
  advance: () => void;
  /** Leave this contact unlogged and move on. */
  skip: () => void;
  /** Stop the whole run. */
  end: () => void;
}

const IDLE = { active: false, queue: [] as string[], index: 0, label: "", logged: 0 };

export const useCallSession = create<CallSessionState>((set) => ({
  ...IDLE,
  start: (contactIds, label) =>
    set(
      contactIds.length > 0
        ? { ...IDLE, active: true, queue: contactIds, label }
        : { ...IDLE },
    ),
  advance: () =>
    set((s) => (s.active ? { index: s.index + 1, logged: s.logged + 1 } : {})),
  skip: () => set((s) => (s.active ? { index: s.index + 1 } : {})),
  end: () => set({ ...IDLE }),
}));

/** The contact id currently being called, or null when the run is done. */
export function currentSessionContactId(
  s: Pick<CallSessionState, "active" | "queue" | "index">,
): string | null {
  if (!s.active) return null;
  return s.queue[s.index] ?? null;
}

/**
 * Which of these contacts can actually be dialed: they exist, they have a
 * number, they aren't marked Do Not Call, and the viewer may reach out to them
 * (the record's owner or assignee, or shared in at Outreach). Order is
 * preserved so a list's sort (or an AI ranking) carries into the run.
 */
export function callableContactIds(contactIds: string[]): string[] {
  const seen = new Set<string>();
  return contactIds.filter((id) => {
    if (seen.has(id)) return false;
    const c = getContact(id);
    if (!c || c.doNotCall || !c.phone.trim()) return false;
    if (!checkContactRight(id, "canReachOut").ok) return false;
    seen.add(id);
    return true;
  });
}

/**
 * Kick off a run of calls from any list surface (a contact list, a deal's
 * leads, a hand-picked selection). Reports when there's nobody callable rather
 * than starting an empty session.
 */
export function startCallSession(contactIds: string[], label: string): void {
  const callable = callableContactIds(contactIds);
  if (callable.length === 0) {
    notify({
      title: "Nothing to call",
      description:
        "No contacts here have a number we can dial and that you have access to call.",
    });
    return;
  }
  const skipped = contactIds.length - callable.length;
  useCallSession.getState().start(callable, label);
  notify({
    title: `Calling ${callable.length} contact${callable.length === 1 ? "" : "s"}`,
    description:
      skipped > 0
        ? `${skipped} skipped (no number, Do Not Call, or no access to call them).`
        : label,
  });
}
