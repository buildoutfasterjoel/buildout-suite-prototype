import { useDataStore } from "#/data/dataStore";
import { currentUser } from "#/data/currentUser";
import { visibleContacts } from "#/components/contacts/contactRights";

export interface AssistantContext {
  broker: { name: string; role: string };
  tasks: { overdue: number; dueToday: number };
  pipeline: { openDeals: number; totalValue: number };
  contacts: Array<{
    id: string; name: string; role: string; company: string;
    relationship: string; lastTouch: string;
  }>;
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

  return {
    broker: { name: currentUser().name, role: currentUser().role },
    tasks: { overdue, dueToday },
    pipeline: { openDeals: openDeals.length, totalValue },
    contacts,
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
