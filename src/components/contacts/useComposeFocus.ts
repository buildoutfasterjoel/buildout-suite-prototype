import { create } from "zustand";
import type { ComposeKind } from "#/components/contacts/contactDisplay";

/** An AI-drafted email being handed to a contact's composer. */
export interface ComposeEmailDraft {
  /** Whose composer this belongs to — a draft must never land on the wrong page. */
  contactId: string;
  subject: string;
  body: string;
}

/**
 * A transient cross-panel signal: which compose tab the middle column should
 * switch to, and that its message field should take focus. Raised from the
 * contact hero — clicking an email address there is a request to write to that
 * person — and consumed by ContactComposeModule.
 *
 * `seq` is bumped on every request so the effect can key on the counter rather
 * than on `kind`: clicking the same address twice re-focuses the field instead
 * of doing nothing the second time. That same counter is what lets the assistant
 * revise a draft in place — every new version is a new request.
 */
interface ComposeFocus {
  seq: number;
  kind: ComposeKind | null;
  /**
   * Set by `requestEmailDraft` only. A plain focus request clears it, so an old
   * AI draft can't reappear when the broker later clicks an email address.
   */
  draft: ComposeEmailDraft | null;
  request: (kind: ComposeKind) => void;
  /**
   * Hand an AI-written email to a contact's composer: opens the Email tab with
   * the subject and body filled in. Called both by the draft card's "Open in
   * Email" (which navigates first) and by the `draft_email` tool when the broker
   * is already on that contact's page, which is what makes "make it shorter"
   * rewrite the composer they're looking at.
   */
  requestEmailDraft: (draft: ComposeEmailDraft) => void;
}

export const useComposeFocus = create<ComposeFocus>((set) => ({
  seq: 0,
  kind: null,
  draft: null,
  request: (kind) => set((s) => ({ seq: s.seq + 1, kind, draft: null })),
  requestEmailDraft: (draft) =>
    set((s) => ({ seq: s.seq + 1, kind: "email", draft })),
}));
