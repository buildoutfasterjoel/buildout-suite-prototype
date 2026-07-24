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
 * Deterministic, grounded spoken greeting (voice-foundation design §6.3).
 * No LLM — composed from the live-store context so it works key-less.
 */
export function composeGreeting(
  ctx: AssistantContext,
  opts: { now?: Date; overnightSignal?: string } = {},
): string {
  const now = opts.now ?? new Date();
  const first = ctx.broker.name.split(" ")[0] || "there";
  const count = ctx.tasks.overdue + ctx.tasks.dueToday;
  const taskLine =
    count > 0
      ? `you've got ${count} task${count === 1 ? "" : "s"} on the calendar today.`
      : "your calendar's clear today — good time to prospect.";
  const signalLine = opts.overnightSignal
    ? ` A signal also came in overnight — ${opts.overnightSignal}. I pinned it to the top of your list.`
    : "";
  return `${partOfDay(now)}, ${first}. ${taskLine}${signalLine} ${OFFER}`;
}

/** The session greeting text plus the offer to arm (call the signal owner).
 * Composed from the live store so it works key-less. */
export function buildGreetingWithOffer(): { text: string; offer: HeroOffer | null } {
  const marcus = getOvernightSignalContact();
  const text = composeGreeting(buildAssistantContext(), {
    overnightSignal: marcus ? signalText(marcus) : undefined,
  });
  const offer: HeroOffer | null = marcus ? { kind: "call", contactId: marcus.id } : null;
  return { text, offer };
}
