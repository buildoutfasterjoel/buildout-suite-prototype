import { create } from "zustand";

/**
 * One preset "revise" chip offered alongside a pinned field ask — the doc's
 * quick actions. One tap is one whole prompt, so the label is a promise and
 * `prompt` is what actually gets sent; nothing here advertises a capability
 * Otto doesn't have (they are all plain rewrites of text it was handed).
 */
export interface FieldAskAction {
  label: string;
  prompt: string;
}

/**
 * A field the broker handed to Otto from the field itself — "ask at the rail,
 * review at the field". Opening the rail this way pins a context chip above the
 * composer, which is what scopes the conversation to that one field.
 *
 * This is the object-level version of `scopeLabel`'s route-level badge: the chip
 * names the record *and* the field ("Rosa Delgado: Note") rather than the
 * section of the app the broker happens to be standing in.
 */
/**
 * Where the staging tool writes. Kept as a discriminated union so a second
 * field type (a listing's marketing description, an email body) adds a variant
 * rather than widening a bag of optional ids.
 */
export type FieldAskTarget = {
  kind: "contact-note";
  contactId: string;
};

export interface FieldAsk {
  /** Chip text — record identity, then the field. */
  label: string;
  /** What `stage_field_value` writes into. */
  target: FieldAskTarget;
  /**
   * A short description of the field for the model's CURRENT CONTEXT block —
   * "the Note field on Earl Pettigrew's activity composer". Without it the chip
   * is decoration: the model has no idea a field is pinned and logs a note to
   * the record instead of writing into the box the broker is looking at.
   */
  description: string;
  /** The field's value when the ask was raised; empty string when blank. */
  value: string;
  /**
   * Otto's opening line, appended straight to the transcript rather than sent
   * to the model: with an empty field it is the question about what the note
   * should cover, and with a value it is the hand-off into the chips below.
   */
  opener: string;
  /** Preset revisions. Empty when the field is blank — there is nothing to revise yet. */
  actions: FieldAskAction[];
}

/**
 * Shared open/close state for the AI Assistant panel, so the global navbar
 * launcher and the docked sidebar stay in sync without prop-drilling.
 */
interface AssistantUIState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /**
   * Full-screen chat (Figma node 193:5009): the rail stops being a rail and
   * takes the whole page container, with the transcript and composer capped at
   * a reading width down the middle. Toggled from the arrows in the rail
   * header.
   *
   * It lives here rather than inside the sidebar because the shell has to know
   * too — it's the shell that pulls the page content out of the flow.
   */
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  toggleExpanded: () => void;
  /**
   * A message queued from another surface (e.g. omni search "Ask Otto") to be
   * sent as soon as the sidebar mounts. The sidebar consumes and clears it.
   */
  pendingPrompt: string | null;
  /**
   * Open the assistant, queue a prompt to send, and request that the composer
   * input take focus — so the user is auto-answered and immediately ready to
   * type a follow-up.
   */
  ask: (prompt: string) => void;
  /** Read and clear the queued prompt (null if none). */
  consumePrompt: () => string | null;
  /**
   * An assistant line queued from another surface (e.g. the day-plan card's
   * "Call X" hand-off) to be appended to the transcript. Unlike `ask`, this is
   * the assistant *speaking*, not a prompt to answer — so it never hits the
   * model. The sidebar consumes and clears it.
   */
  pendingLine: string | null;
  /** Queue an assistant line into the transcript. */
  say: (line: string) => void;
  /** Read and clear the queued assistant line (null if none). */
  consumeLine: () => string | null;
  /** Bumped whenever a surface requests the composer input be focused. */
  focusNonce: number;
  /**
   * The pinned field context, or null for general chat. Set by a field's
   * sparkle affordance and cleared by the chip's ×, or by closing the rail —
   * a chip that outlived the trip back to the page would scope the next
   * question to a field the broker has walked away from.
   */
  fieldAsk: FieldAsk | null;
  /**
   * Bumped per request, not derived from `fieldAsk`. Clicking the same field's
   * sparkle twice has to re-announce and re-focus, and an identical object
   * wouldn't register as a change.
   */
  fieldAskNonce: number;
  /** Open the rail scoped to a field, announcing `opener` in the transcript. */
  askAtField: (ask: FieldAsk) => void;
  /**
   * Keep the pinned field's value current as the broker types in it.
   *
   * The value is what the model reads to know what it is revising, so a stale
   * copy is worse than none: "shorten it" would shorten the text as it stood
   * when the sparkle was clicked. Only the value moves — the opener and the
   * presets were decided by the state of the field at that click and shouldn't
   * change under the broker mid-sentence.
   */
  updateFieldAskValue: (value: string) => void;
  /** Drop the chip and widen back to general chat. */
  clearFieldAsk: () => void;
  /** True once Otto has greeted the broker this session (greeting fires once). */
  greetedThisSession: boolean;
  setGreeted: (greeted: boolean) => void;
}

export const useAssistant = create<AssistantUIState>((set, get) => ({
  open: false,
  // Closing always collapses. A rail reopened later should come back as a rail:
  // full screen is a thing you do *to a conversation you're in*, not a standing
  // preference, and restoring it would hide the page the broker just navigated
  // to without their asking.
  setOpen: (open) =>
    set(open ? { open } : { open, expanded: false, fieldAsk: null }),
  toggle: () =>
    set((s) =>
      s.open ? { open: false, expanded: false, fieldAsk: null } : { open: true },
    ),
  expanded: false,
  setExpanded: (expanded) => set({ expanded }),
  toggleExpanded: () => set((s) => ({ expanded: !s.expanded })),
  pendingPrompt: null,
  ask: (prompt) =>
    set((s) => ({ open: true, pendingPrompt: prompt, focusNonce: s.focusNonce + 1 })),
  consumePrompt: () => {
    const prompt = get().pendingPrompt;
    if (prompt !== null) set({ pendingPrompt: null });
    return prompt;
  },
  pendingLine: null,
  say: (pendingLine) => set({ open: true, pendingLine }),
  consumeLine: () => {
    const line = get().pendingLine;
    if (line !== null) set({ pendingLine: null });
    return line;
  },
  fieldAsk: null,
  fieldAskNonce: 0,
  askAtField: (fieldAsk) =>
    set((s) => ({
      open: true,
      fieldAsk,
      fieldAskNonce: s.fieldAskNonce + 1,
      // Focus the composer too: the broker clicked the sparkle to say
      // something about that field, so land the cursor where they'll say it.
      focusNonce: s.focusNonce + 1,
    })),
  updateFieldAskValue: (value) =>
    set((s) => (s.fieldAsk ? { fieldAsk: { ...s.fieldAsk, value } } : {})),
  clearFieldAsk: () => set({ fieldAsk: null }),
  focusNonce: 0,
  greetedThisSession: false,
  setGreeted: (greetedThisSession) => set({ greetedThisSession }),
}));
