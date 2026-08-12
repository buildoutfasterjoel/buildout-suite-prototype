import { listAllTasks, listContactsForDeal } from "#/data/selectors";
import { useDataStore } from "#/data/dataStore";
import { getOvernightSignalContact, signalText } from "#/data/signal";
import type { Contact, PropertyStatus, TaskView } from "#/data/types";

/**
 * One move in the broker's day queue. `contactId` / `dealId` decide which
 * actions the co-pilot card offers (a call needs a contact; "open record" needs
 * somewhere to land), so both stay on the item rather than being re-derived at
 * render time.
 */
export interface DayPlanItem {
  /** Task id, or `signal:<contactId>` for the pinned overnight signal. */
  taskId: string;
  /** `signal` items have no task record behind them, so nothing to complete. */
  kind: "task" | "signal";
  /**
   * The move itself, e.g. "Rosa → call on the overnight signal". Deliberately
   * *not* prefixed with "Start with" — only the top of the queue earns that, and
   * which item is on top is the card's business, not the ranker's.
   */
  headline: string;
  /** One grounded line of why this is the move (due date + what it hangs off). */
  reason: string;
  contactId: string | null;
  contactName: string | null;
  dealId: string | null;
  /** True when this is a call task AND we resolved someone to dial. */
  isCall: boolean;
  /** Days overdue (0 = due today). Drives ordering and the reason line. */
  daysOverdue: number;
}

export interface DayPlan {
  items: DayPlanItem[];
  /** Every task overdue-or-due-today, before `limit` trimmed the queue. */
  totalDue: number;
}

/** Task type keys that mean "get them on the phone". */
const CALL_TYPES = new Set(["call", "follow-up"]);

/**
 * Deal stages whose tasks count as the broker's live work. Closed and inactive
 * deals are excluded deliberately: a closed deal's checklist is back-office
 * voucher paperwork ("Review voucher", "Set up pre-split deductions") dated from
 * `stageStartedAt + 2 days`, so it sits ~45 days overdue forever and floods the
 * queue with items that are not broker moves. Live-stage tasks land in a natural
 * 0–11 day window.
 */
const LIVE_STAGES = new Set<PropertyStatus>(["proposal", "active", "under-contract"]);

/** How many moves a queue offers before it reads as a backlog instead of a day. */
const DEFAULT_LIMIT = 8;

/** Whole days between two ISO `YYYY-MM-DD` dates (b - a), calendar-safe. */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

const fullName = (c: Contact): string | null => `${c.firstName} ${c.lastName}`.trim() || null;

/**
 * The person to dial for a task: its own linked contact, else the deal's first
 * named party. Deal planner tasks ("Call owner to confirm pricing strategy")
 * carry no contactId, so without this fallback the queue could never offer the
 * call — which is the move the broker actually wants to make.
 */
function resolveContact(task: TaskView): Contact | undefined {
  const contacts = useDataStore.getState().contacts;
  if (task.contactId) {
    const own = contacts.get(task.contactId);
    if (own) return own;
  }
  if (task.dealId) return listContactsForDeal(task.dealId)[0];
  return undefined;
}

/** Sentence-case a signal headline so it can stand alone as the reason line. */
function asSentence(text: string): string {
  if (!text) return "";
  return `${text[0].toUpperCase()}${text.slice(1).replace(/\.$/, "")}.`;
}

/**
 * The overnight signal, as the queue's pinned first move. The greeting already
 * tells the broker it was pinned to the top of their list ("A signal also came
 * in overnight — …"), so the queue has to actually lead with it or the two
 * surfaces contradict each other.
 */
function signalItem(): DayPlanItem | null {
  const contact = getOvernightSignalContact();
  if (!contact) return null;
  const headline = signalText(contact);
  if (!headline) return null;
  const first = contact.firstName || fullName(contact) || "them";
  return {
    taskId: `signal:${contact.id}`,
    kind: "signal",
    headline: `${first} → call on the overnight signal`,
    reason: asSentence(headline),
    contactId: contact.id,
    contactName: fullName(contact),
    dealId: null,
    isCall: true,
    daysOverdue: 0,
  };
}

/**
 * Rank the moves worth working right now: the pinned overnight signal, then
 * overdue tasks (most overdue leads), then today's. Unscheduled and completed tasks never enter the queue — a queue
 * the broker can't finish isn't a plan.
 *
 * Reads {@link listAllTasks} rather than the store's `tasks` map: standalone
 * tasks seed empty, so the real inventory is the deals' embedded planner tasks.
 * Counting only standalone ones is what made the old stub always answer
 * "nothing overdue."
 *
 * Deliberately NOT filtered by assignee. Deal-task assignees are synthetic —
 * `listAllTasks` spreads them across the roster by hashing the task id — so
 * filtering to the current user would drop most of the book on an arbitrary
 * basis. Every deal in the seed is the broker's own.
 */
export function buildDayPlan(
  today: string = new Date().toISOString().slice(0, 10),
  limit: number = DEFAULT_LIMIT,
): DayPlan {
  const listings = useDataStore.getState().listings;
  const due: Array<{ task: TaskView; daysOverdue: number }> = [];
  for (const task of listAllTasks()) {
    if (task.completed) continue;
    if (!task.dueDate) continue;
    // Deal tasks only count while the deal is live (see LIVE_STAGES).
    if (task.dealId) {
      const status = listings.get(task.dealId)?.status;
      if (!status || !LIVE_STAGES.has(status)) continue;
    }
    const daysOverdue = daysBetween(task.dueDate, today);
    // Negative → due in the future; not today's problem.
    if (daysOverdue < 0) continue;
    due.push({ task, daysOverdue });
  }

  // Most overdue first; ties broken by title so the order is stable across
  // renders (task iteration order isn't meaningful here).
  due.sort((a, b) => b.daysOverdue - a.daysOverdue || a.task.title.localeCompare(b.task.title));

  // The signal is pinned, so it takes a slot off the top rather than competing
  // with the overdue sort.
  const pinned = signalItem();
  const taskSlots = pinned ? Math.max(0, limit - 1) : limit;

  const taskItems: DayPlanItem[] = due.slice(0, taskSlots).map(({ task, daysOverdue }) => {
    const contact = resolveContact(task);
    const contactName = contact ? fullName(contact) : null;
    const lead =
      contactName?.split(" ")[0] ?? (task.sourceKind === "deal" ? task.sourceLabel : null);

    const when =
      daysOverdue === 0 ? "Due today." : `Due ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} ago.`;

    return {
      taskId: task.id,
      kind: "task" as const,
      headline: lead ? `${lead} → ${task.title}` : task.title,
      // The lead name is already in the headline, so the reason carries the
      // other half of the context — which deal it hangs off.
      reason: task.sourceLabel && contactName ? `${when} ${task.sourceLabel}.` : when,
      contactId: contact?.id ?? null,
      contactName,
      dealId: task.dealId ?? null,
      isCall: CALL_TYPES.has(task.type ?? "") && !!contact,
      daysOverdue,
    };
  });

  return {
    items: pinned ? [pinned, ...taskItems] : taskItems,
    totalDue: due.length + (pinned ? 1 : 0),
  };
}

/**
 * Whether a prompt is asking for the day's plan. Used to show the progress
 * checklist the moment the broker asks, before the model has picked a tool —
 * the alternative is a bare "Working…" for the first few seconds of the one
 * interaction that most needs to feel deliberate.
 */
const PLAN_INTENT =
  /what should i do|plan my day|what'?s next|next actions|recommend my next|walk me through my day/i;

export function matchesPlanIntent(text: string): boolean {
  return PLAN_INTENT.test(text.trim());
}

/** One-line framing for the queue, used when there's nothing to work. */
export function emptyDayPlanHeadline(): string {
  return "Nothing overdue or due today — good time to prospect. Want me to build a call list?";
}
