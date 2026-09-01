import { create } from "zustand";
import type { AccessTier } from "#/data/teammates";

/**
 * Access requests the signed-in user has made this session, keyed by contact.
 * A request is a knock on the accountable person's door; in the prototype
 * nobody answers it, so it stays pending until cancelled. Session-scoped, like
 * the rest of the contact-page state — a reload clears it.
 */
interface AccessRequestState {
  requests: Record<string, { tier: AccessTier; requestedAt: string }>;
  request: (contactId: string, tier: AccessTier) => void;
  cancel: (contactId: string) => void;
}

export const useAccessRequests = create<AccessRequestState>((set) => ({
  requests: {},
  request: (contactId, tier) =>
    set((s) => ({
      requests: {
        ...s.requests,
        [contactId]: { tier, requestedAt: new Date().toISOString() },
      },
    })),
  cancel: (contactId) =>
    set((s) => {
      const next = { ...s.requests };
      delete next[contactId];
      return { requests: next };
    }),
}));
