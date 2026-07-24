import { create } from "zustand";

export type HeroOffer = { kind: "call" | "brief"; contactId: string };

interface HeroOfferState {
  pendingOffer: HeroOffer | null;
  setOffer: (o: HeroOffer) => void;
  clearOffer: () => void;
}

export const useHeroOffer = create<HeroOfferState>((set) => ({
  pendingOffer: null,
  setOffer: (pendingOffer) => set({ pendingOffer }),
  clearOffer: () => set({ pendingOffer: null }),
}));

const BRIEF = /\bbrief\b|what'?s the signal|more (?:first|before)|tell me (?:more|about the signal)/i;
const YES = /\b(yes|yeah|yep|yup|sure|ok(?:ay)?|please|absolutely|definitely)\b|go ahead|do it|let'?s go|call (?:him|her|them|marcus)|make the call/i;

/** Classify a broker reply to a pending hero offer. Brief takes precedence over
 * yes (a "yes, but brief me" should brief). Null → not a clear offer response. */
export function matchOfferIntent(text: string): "call" | "brief" | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (BRIEF.test(t)) return "brief";
  if (YES.test(t)) return "call";
  return null;
}
