import { create } from "zustand";
import type { ComposeKind } from "#/components/contacts/contactDisplay";

/**
 * A transient cross-panel signal: which compose tab the middle column should
 * switch to, and that its message field should take focus. Raised from the
 * contact hero — clicking an email address there is a request to write to that
 * person — and consumed by ContactComposeModule.
 *
 * `seq` is bumped on every request so the effect can key on the counter rather
 * than on `kind`: clicking the same address twice re-focuses the field instead
 * of doing nothing the second time.
 */
interface ComposeFocus {
  seq: number;
  kind: ComposeKind | null;
  request: (kind: ComposeKind) => void;
}

export const useComposeFocus = create<ComposeFocus>((set) => ({
  seq: 0,
  kind: null,
  request: (kind) => set((s) => ({ seq: s.seq + 1, kind })),
}));
