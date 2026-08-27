import { create } from "zustand";

/**
 * A deal the assistant has just created and can underwrite, waiting on the
 * broker's yes.
 *
 * The offer is armed by the `createDeal` tool and answered in the rail's own
 * `send()`, before the turn reaches the model — the same shape the hero call
 * offer uses (see `heroOffer`). It is deliberately NOT a tool the model can
 * call: "yes" here opens a modal wizard the broker then drives, and routing
 * that through another agent turn would put a round-trip and a chance of
 * misreading between the word and the dialog.
 */
export interface UnderwritingOffer {
  dealId: string;
  /** The owner the finished BOV gets emailed to. */
  contactId: string;
  /** The deal's name, for the line Otto says and the ack after it. */
  dealName: string;
}

interface UnderwritingOfferState {
  pendingOffer: UnderwritingOffer | null;
  /** True once Otto has actually asked — the rail waits for the turn to finish. */
  asked: boolean;
  offer: (o: UnderwritingOffer) => void;
  markAsked: () => void;
  clearOffer: () => void;
}

export const useUnderwritingOffer = create<UnderwritingOfferState>((set) => ({
  pendingOffer: null,
  asked: false,
  offer: (pendingOffer) => set({ pendingOffer, asked: false }),
  markAsked: () => set({ asked: true }),
  clearOffer: () => set({ pendingOffer: null, asked: false }),
}));

const YES =
  /\b(yes|yeah|yep|yup|sure|ok(?:ay)?|please|absolutely|definitely|sounds good)\b|go ahead|do it|let'?s go|start it|build it|run it|underwrite/i;
const NEG = /\b(?:not|never|no|nope|nah|don'?t|won'?t|can'?t|cannot|later|skip)\b/i;

/**
 * Classify a broker reply to a pending underwriting offer. Negation wins over
 * an affirmative word so "no, don't underwrite it yet" isn't read as a yes on
 * the strength of "underwrite". Null → not an answer to the offer; the rail
 * clears it and hands the turn to the model.
 */
export function matchUnderwritingIntent(text: string): "yes" | null {
  const t = text.trim();
  if (!t) return null;
  if (NEG.test(t)) return null;
  return YES.test(t) ? "yes" : null;
}
