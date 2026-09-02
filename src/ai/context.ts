import { useDataStore } from "#/data/dataStore";
import { currentUser } from "#/data/currentUser";
import { visibleContacts } from "#/components/contacts/contactRights";
import { useAssistant } from "#/ai/useAssistant";

export interface AssistantContext {
  broker: { name: string; role: string };
  tasks: { overdue: number; dueToday: number };
  pipeline: { openDeals: number; totalValue: number };
  contacts: Array<{
    id: string; name: string; role: string; company: string;
    relationship: string; lastTouch: string;
  }>;
  /**
   * The field the broker handed to the assistant from the page, or null.
   *
   * This is what makes the rail's context chip mean something. Without it the
   * model can see the broker asking to "shorten this note" and has no way to
   * know there is a box on screen waiting for the result — so it does the next
   * most sensible thing and logs a note to the record, which is the one outcome
   * nobody asked for.
   */
  field: { label: string; description: string; current: string } | null;
}

const OPEN_STATUSES = new Set(["proposal", "active", "under-contract"]);

export function buildAssistantContext(): AssistantContext {
  const s = useDataStore.getState();
  const today = new Date().toISOString().slice(0, 10);

  let overdue = 0;
  let dueToday = 0;
  for (const t of s.tasks.values()) {
    if (t.status === "complete") continue;
    if (t.dueDate && t.dueDate < today) overdue += 1;
    else if (t.dueDate === today) dueToday += 1;
  }

  const openDeals = [...s.listings.values()].filter((l) => OPEN_STATUSES.has(l.status));
  const totalValue = openDeals.reduce((sum, l) => sum + (l.financials.askingPrice ?? 0), 0);

  const contacts = visibleContacts([...s.contacts.values()]).slice(0, 30).map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    role: c.role,
    company: c.company,
    relationship: c.relationship,
    lastTouch: c.lastTouch,
  }));

  // Read live rather than passed in: every surface that builds this context
  // wants the same answer, and the pinned field is global rail state.
  const ask = useAssistant.getState().fieldAsk;

  return {
    broker: { name: currentUser().name, role: currentUser().role },
    tasks: { overdue, dueToday },
    pipeline: { openDeals: openDeals.length, totalValue },
    contacts,
    field: ask
      ? { label: ask.label, description: ask.description, current: ask.value }
      : null,
  };
}

/** Compact JSON, trimmed to fit `maxBytes` by dropping trailing contacts. */
export function serializeContext(ctx: AssistantContext, maxBytes = 3072): string {
  const clone: AssistantContext = { ...ctx, contacts: [...ctx.contacts] };
  let out = JSON.stringify(clone);
  while (out.length > maxBytes && clone.contacts.length > 0) {
    clone.contacts.pop();
    out = JSON.stringify(clone);
  }
  return out;
}
