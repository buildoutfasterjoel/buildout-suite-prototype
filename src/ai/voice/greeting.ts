import type { AssistantContext } from "#/ai/context";
import { buildAssistantContext } from "#/ai/context";
import { getOvernightSignalContact, signalText } from "#/data/signal";
import type { HeroOffer } from "#/ai/heroOffer";

const OFFER = "Want me to call your most important move first?";

function partOfDay(now: Date): "Morning" | "Afternoon" | "Evening" {
  const h = now.getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

/**
 * The greeting, in the three pieces the rail's home screen sets separately
 * (Figma node 193:4380): a gradient headline, the grounded lead-in beneath it,
 * and the offer — which is bold, because it's the one sentence that expects an
 * answer and has two buttons under it.
 *
 * Spoken aloud they're just one sentence after another, which is what
 * {@link composeGreeting} joins them back into.
 */
export interface GreetingParts {
  /** "Morning, Ethan. How can I help?" */
  headline: string;
  /** What's actually on the broker's plate — tasks, and any overnight signal. */
  lead: string;
  /** The call-to-action, always the last thing said. */
  offer: string;
}

/**
 * Deterministic, grounded greeting (voice-foundation design §6.3).
 * No LLM — composed from the live-store context so it works key-less.
 */
export function composeGreetingParts(
  ctx: AssistantContext,
  opts: { now?: Date; overnightSignal?: string } = {},
): GreetingParts {
  const now = opts.now ?? new Date();
  const first = ctx.broker.name.split(" ")[0] || "there";
  const count = ctx.tasks.overdue + ctx.tasks.dueToday;
  const taskLine =
    count > 0
      ? `You've got ${count} task${count === 1 ? "" : "s"} on the calendar today.`
      : "Your calendar's clear today — good time to prospect.";
  const signalLine = opts.overnightSignal
    ? ` A signal also came in overnight — ${opts.overnightSignal}. I pinned it to the top of your list.`
    : "";
  return {
    headline: `${partOfDay(now)}, ${first}. How can I help?`,
    lead: `${taskLine}${signalLine}`,
    offer: OFFER,
  };
}

/** The greeting as one run of prose — what the voice engine speaks. */
export function composeGreeting(
  ctx: AssistantContext,
  opts: { now?: Date; overnightSignal?: string } = {},
): string {
  const { headline, lead, offer } = composeGreetingParts(ctx, opts);
  return `${headline} ${lead} ${offer}`;
}

/** The session greeting plus the offer to arm (call the signal owner). Composed
 * from the live store so it works key-less. */
export function buildGreetingWithOffer(): {
  text: string;
  parts: GreetingParts;
  offer: HeroOffer | null;
} {
  const signalOwner = getOvernightSignalContact();
  const opts = {
    overnightSignal: signalOwner ? signalText(signalOwner) : undefined,
  };
  const ctx = buildAssistantContext();
  const parts = composeGreetingParts(ctx, opts);
  const offer: HeroOffer | null = signalOwner ? { kind: "call", contactId: signalOwner.id } : null;
  return { text: composeGreeting(ctx, opts), parts, offer };
}
