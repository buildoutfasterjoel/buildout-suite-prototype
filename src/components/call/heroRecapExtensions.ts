import type { CallTarget } from "./useCallStore";
import type { CallRecapSpecT } from "#/ai/generate/schemas";
import type { HeroKey } from "#/data/types";
import { getContact } from "#/data/store";

/** A hero call = the target owner carries an overnight signal (the arc's Rosa). */
export function isHeroCall(target: CallTarget | null): boolean {
  if (!target) return false;
  return !!getContact(target.contactId)?.signal;
}

/**
 * Hand-authored recaps for the demo personas, used when the model is
 * unavailable (no API key → `callRecapFallback`, which can't say anything
 * specific about a call it never read).
 *
 * A full `CallRecapSpecT` rather than a block of prose, because two surfaces
 * report the same call and they must not disagree: the Log Call modal drafts
 * its notes from `keyPoints` + `tasks` (see `composeCallNotes`), and the rail's
 * recap card reports the same `keyPoints` and offers the same `tasks` as
 * follow-ups. Storing the prose alone left the card with nothing to say —
 * "the call felt neutral", full stop, under a modal that had just written three
 * detailed sentences.
 */
const PERSONA_RECAPS: Partial<Record<HeroKey, CallRecapSpecT>> = {
  rosa: {
    sentiment: "positive",
    keyPoints: [
      "Returned Rosa's call about the loan documents she found in Miguel's papers — the balloon note we'd talked about.",
      "She wants to understand her options: nothing decided, no pressure applied.",
      "Warmest she's sounded — she offered to send the building's T-12 and rent roll so I can see what it actually does before we talk again.",
    ],
    tasks: [
      { title: "Review the T-12 and rent roll when they land", due: null },
      { title: "Follow up gently once I've read them — no ask", due: null },
    ],
    // No opportunity: the deal is created from her financials email's "Start a
    // Deal" action, not offered at hang-up. See heroInbound.
    opportunity: { name: "", address: "" },
  },
};

/**
 * The hand-authored recap for a persona, if there is one.
 *
 * Callers pair this with `isThinRecap` rather than the check living here: this
 * module is imported *by* `callNotes`, and reaching back for its thinness test
 * would close a cycle between the two.
 */
export function personaRecap(heroKey: HeroKey | undefined): CallRecapSpecT | undefined {
  return heroKey ? PERSONA_RECAPS[heroKey] : undefined;
}
