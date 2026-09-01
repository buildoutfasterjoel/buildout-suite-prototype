import { create } from "zustand";
import type { ComposeKind } from "#/components/contacts/contactDisplay";

/** An AI-written activity being handed to a contact's composer. */
export interface ComposeActivityDraft {
  /** Whose composer this belongs to — a draft must never land on the wrong page. */
  contactId: string;
  /** Which tab the text belongs to. */
  kind: ComposeKind;
  body: string;
  /** Email only; left alone when absent, so a body revision keeps the subject. */
  subject?: string;
}

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
  /**
   * Raised by `stage_field_value`: opens the tab the text belongs to with the
   * assistant's value in it, unsaved. The broker still presses Log Note / Send
   * Email — which is why this stages rather than commits, and why nothing here
   * touches the timeline.
   *
   * Separate from `draft` above even for email: that one is `draft_email`'s
   * path, which owns a subject AND a body and renders a card in the rail. This
   * one writes only what it was given, so "make it warmer" leaves the subject
   * the broker typed alone.
   */
  activityDraft: ComposeActivityDraft | null;
  requestActivityDraft: (draft: ComposeActivityDraft) => void;
}

export const useComposeFocus = create<ComposeFocus>((set) => ({
  seq: 0,
  kind: null,
  draft: null,
  activityDraft: null,
  request: (kind) =>
    set((s) => ({ seq: s.seq + 1, kind, draft: null, activityDraft: null })),
  requestEmailDraft: (draft) =>
    set((s) => ({ seq: s.seq + 1, kind: "email", draft, activityDraft: null })),
  requestActivityDraft: (activityDraft) =>
    set((s) => ({ seq: s.seq + 1, kind: activityDraft.kind, activityDraft, draft: null })),
}));
