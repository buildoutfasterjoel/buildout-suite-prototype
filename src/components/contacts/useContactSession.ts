import { create } from "zustand";
import type { ComposedActivity } from "#/components/contacts/contactDisplay";
import type { ComposedDraft } from "#/components/contacts/ContactComposeModule";
import type { TimelineEvent } from "#/components/contacts/timeline";

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

  addLog: (contactId: string, draft: ComposedDraft) => void;
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

  addLog: (contactId, draft) =>
    set((s) => {
      const seq = _seq++;
      const activity: ComposedActivity = {
        ...draft,
        id: `logged-${seq}`,
        seq,
        createdAt: new Date().toISOString(),
      };
      return {
        logged: {
          ...s.logged,
          [contactId]: [activity, ...(s.logged[contactId] ?? [])],
        },
      };
    }),

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
