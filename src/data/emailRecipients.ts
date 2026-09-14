import { hash, spread } from "#/components/properties/propertyDisplay";
import { visibleContacts } from "#/components/contacts/contactRights";
import type { Email, EmailPerformance } from "#/data/emails";

/**
 * The state a recipient ended up in. One terminal state per recipient — a
 * contact who clicked is counted under "Clicked", not also under "Delivered" —
 * so the filter chip counts sum to the recipient total.
 */
export const RECIPIENT_ACTIONS = [
  "Sent",
  "Delivered",
  "Opened",
  "Clicked",
  "Replied",
  "Bounced",
  "Unsubscribed",
  "Spam Reports",
  "Not Sent",
] as const;

export type RecipientAction = (typeof RECIPIENT_ACTIONS)[number];

/** Terminal-state weights out of 100, shaped so the funnel reads like a real send. */
const ACTION_WEIGHTS: [RecipientAction, number][] = [
  ["Delivered", 30],
  ["Opened", 22],
  ["Clicked", 14],
  ["Sent", 10],
  ["Replied", 6],
  ["Bounced", 6],
  ["Not Sent", 5],
  ["Unsubscribed", 4],
  ["Spam Reports", 3],
];

/**
 * Deal the actions out by quota rather than rolling one per recipient. An
 * independent roll is only weighted *on average*, and a 20-row roster is small
 * enough that it lands "Opened (10), Delivered (6)" often — a funnel that reads
 * as a bug. Quotas make the shape exact at any roster size.
 */
function dealActions(count: number, seed: string): RecipientAction[] {
  const plan: RecipientAction[] = [];
  for (const [action, weight] of ACTION_WEIGHTS) {
    for (let i = Math.round((weight / 100) * count); i > 0; i--) plan.push(action);
  }
  while (plan.length < count) plan.push("Delivered"); // rounding shortfall
  plan.length = count;

  // Scatter, so the table isn't sorted by action before anyone touches it.
  const seats = [...plan.keys()].sort(
    (a, b) => hash(`${seed}#${a}#seat`) - hash(`${seed}#${b}#seat`),
  );
  const dealt: RecipientAction[] = [];
  seats.forEach((seat, i) => {
    dealt[seat] = plan[i];
  });
  return dealt;
}

export interface EmailRecipient {
  contactId: string;
  name: string;
  action: RecipientAction;
  /** ISO "YYYY-MM-DD" — sorts lexically, formatted for display at render. */
  date: string;
}

/** "2026-02-20" → "02/20/2026" */
export function formatRecipientDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Deterministic recipient roster for a sent campaign, drawn from real CRM
 * contacts so every Name links to a record that exists. Stable across renders
 * (same `hash`-derived approach as `getEmails` / `getEmailPerformance`).
 */
export function getEmailRecipients(
  email: Email,
  performance: EmailPerformance,
): EmailRecipient[] {
  // Seeded contacts include repeated faker names; a roster listing "Dana
  // Whitfield" twice reads as a duplicate-send bug, so one name gets one seat.
  const seen = new Set<string>();
  const contacts = [...visibleContacts()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((c) => {
      const name = `${c.firstName} ${c.lastName}`;
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  if (contacts.length === 0) return [];

  const h = hash(`${email.id}-recipients`);
  const count = Math.min(contacts.length, 18 + spread(h, 23)); // 18–40
  const start = spread(h, contacts.length);
  const sent = new Date(`${performance.sentDate}T00:00:00`);
  const actions = dealActions(count, email.id);

  return Array.from({ length: count }, (_, i) => {
    const c = contacts[(start + i) % contacts.length];
    const date = new Date(sent);
    date.setDate(date.getDate() + spread(hash(`${email.id}#${c.id}#day`), 7));
    return {
      contactId: c.id,
      name: `${c.firstName} ${c.lastName}`,
      action: actions[i],
      date: isoDate(date),
    };
  });
}

/** How many recipients landed in each action, in `RECIPIENT_ACTIONS` order. */
export function countByAction(
  recipients: EmailRecipient[],
): Record<RecipientAction, number> {
  const counts = Object.fromEntries(
    RECIPIENT_ACTIONS.map((a) => [a, 0]),
  ) as Record<RecipientAction, number>;
  for (const r of recipients) counts[r.action] += 1;
  return counts;
}
