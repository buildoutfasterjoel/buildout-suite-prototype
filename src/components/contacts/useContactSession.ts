import { create } from "zustand";
import type { ComposedActivity } from "#/components/contacts/contactDisplay";
import { currentUserActor } from "#/data/currentUser";
import { contactFullName } from "#/components/contacts/contactDisplay";
import type { ComposedDraft } from "#/components/contacts/ContactComposeModule";
import type { TimelineEvent } from "#/components/contacts/timeline";
import { nurtureStageRow } from "#/components/contacts/timelineKit";
import { promoteOnEngagement } from "#/data/contactEngagement";
import type { EngagementTrigger } from "#/data/contactStage";
import { notify } from "#/lib/notify";

/**
 * Per-contact session state for the activity timeline: activities logged this
 * session, simulated inbound events (Rosa's story emails), rows the broker has
 * handled, and story-arc flags. Lives in a module store — not component state —
 * so navigating away from a contact page and back keeps the timeline exactly
 * where it was. A hard refresh clears it (module state), which is the intended
 * pairing with the Rosa demo reset: refresh = fresh demo, navigation = continuity.
 */
interface ContactSessionState {
  /** Activities logged this session, newest first, keyed by contact id. */
  logged: Record<string, ComposedActivity[]>;
  /** Simulated inbound timeline events, keyed by contact id. */
  simEvents: Record<string, TimelineEvent[]>;
  /** Timeline row ids the broker has acted on (replied / called back / …). */
  resolved: Record<string, string[]>;
  /** Story-arc flags (e.g. "rosa-callback-armed"), keyed by contact id. */
  flags: Record<string, string[]>;

  /** Returns the new activity's id, so an undo can retract exactly this row. */
  addLog: (contactId: string, draft: ComposedDraft) => string;
  removeLog: (contactId: string, activityId: string) => void;
  addSimEvent: (contactId: string, event: TimelineEvent) => void;
  resolve: (contactId: string, eventId: string) => void;
  setFlag: (contactId: string, flag: string) => void;
  clearFlag: (contactId: string, flag: string) => void;
}

/** Monotonic creation order across the session (drives timeline tiebreaks). */
let _seq = 0;

export const useContactSession = create<ContactSessionState>((set) => ({
  logged: {},
  simEvents: {},
  resolved: {},
  flags: {},

  addLog: (contactId, draft) => {
    // Built outside the updater so the caller can be handed the id back.
    const seq = _seq++;
    const activity: ComposedActivity = {
      ...draft,
      id: `logged-${seq}`,
      seq,
      createdAt: new Date().toISOString(),
      // Signed by whoever is logging it, now — not by whoever looks later.
      author: draft.author ?? currentUserActor(),
    };
    set((s) => ({
      logged: {
        ...s.logged,
        [contactId]: [activity, ...(s.logged[contactId] ?? [])],
      },
    }));
    // Every surface that logs an activity funnels through here — the composer,
    // the global call log, the BOV flow, the assistant's tools — so the stage
    // automation hangs off this one write path rather than each of them.
    // A note, meeting or tour isn't the outreach the rule is about, and a
    // completed task is the tail of work that already promoted the contact.
    if (draft.kind === "email" || draft.kind === "call") {
      recordEngagement(contactId, draft.kind);
    }
    return activity.id;
  },

  removeLog: (contactId, activityId) =>
    set((s) => ({
      logged: {
        ...s.logged,
        [contactId]: (s.logged[contactId] ?? []).filter(
          (a) => a.id !== activityId,
        ),
      },
    })),

  addSimEvent: (contactId, event) =>
    set((s) => {
      const existing = s.simEvents[contactId] ?? [];
      if (existing.some((e) => e.id === event.id)) return {};
      return {
        simEvents: { ...s.simEvents, [contactId]: [...existing, event] },
      };
    }),

  resolve: (contactId, eventId) =>
    set((s) => {
      const existing = s.resolved[contactId] ?? [];
      if (existing.includes(eventId)) return {};
      return {
        resolved: { ...s.resolved, [contactId]: [...existing, eventId] },
      };
    }),

  setFlag: (contactId, flag) =>
    set((s) => {
      const existing = s.flags[contactId] ?? [];
      if (existing.includes(flag)) return {};
      return { flags: { ...s.flags, [contactId]: [...existing, flag] } };
    }),

  clearFlag: (contactId, flag) =>
    set((s) => ({
      flags: {
        ...s.flags,
        [contactId]: (s.flags[contactId] ?? []).filter((f) => f !== flag),
      },
    })),
}));

/**
 * Contact-stage automation, visible half: the broker worked the record, so the
 * stage keeps up and the timeline says why.
 *
 * Called by `addLog` above for a sent email or a logged call, and by
 * `createTask` for a task created against a contact. A no-op when the stage
 * doesn't move, so call sites fire it unconditionally.
 *
 * The stage itself is persisted; the row explaining it is session state, which is
 * the same pairing the activity that triggered it already has (a logged call is
 * gone on refresh, its `lastActivityAt` isn't).
 */
export function recordEngagement(
  contactId: string | null | undefined,
  trigger: EngagementTrigger,
): void {
  if (!contactId) return;
  const moved = promoteOnEngagement(contactId, trigger);
  if (!moved) return;
  const row = nurtureStageRow(moved.contact, moved.from, trigger);
  useContactSession.getState().addSimEvent(contactId, row);
  // Nobody asked for this change, so it announces itself — once per contact,
  // since the rule only fires on the way out of cold/inquired.
  notify({
    title: `${contactFullName(moved.contact)} moved to Nurturing`,
    description: row.body,
  });
}

const EMPTY: never[] = [];

/** Stable-reference selectors (avoid new arrays for absent contacts). */
export const selectLogged =
  (contactId: string) =>
  (s: ContactSessionState): ComposedActivity[] =>
    s.logged[contactId] ?? EMPTY;
export const selectSimEvents =
  (contactId: string) =>
  (s: ContactSessionState): TimelineEvent[] =>
    s.simEvents[contactId] ?? EMPTY;
export const selectResolved =
  (contactId: string) =>
  (s: ContactSessionState): string[] =>
    s.resolved[contactId] ?? EMPTY;
export const selectFlags =
  (contactId: string) =>
  (s: ContactSessionState): string[] =>
    s.flags[contactId] ?? EMPTY;

/**
 * The files a contact has SENT the broker this session — the attachments on
 * their inbound timeline rows (Rosa's T-12 and rent roll, say), newest first
 * and deduped by name.
 *
 * A deal started off the back of an email should carry the documents that email
 * arrived with, however it was started. The timeline's own "Start a Deal"
 * action already did that by naming the files directly (see
 * `createRosaProposalDeal`); this is the same set, discovered rather than
 * hard-coded, so asking Otto for the deal produces the identical record.
 */
export function documentsFromContact(contactId: string): { name: string; meta: string }[] {
  const events = useContactSession.getState().simEvents[contactId] ?? [];
  const seen = new Set<string>();
  const out: { name: string; meta: string }[] = [];
  for (const e of [...events].sort((a, b) => b.seq - a.seq)) {
    if (e.direction !== "in") continue;
    for (const a of e.attachments ?? []) {
      if (seen.has(a.name)) continue;
      seen.add(a.name);
      out.push({ name: a.name, meta: a.meta ?? "" });
    }
  }
  return out;
}
