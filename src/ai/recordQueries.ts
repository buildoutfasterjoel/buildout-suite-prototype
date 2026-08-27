import type {
  Comp,
  Contact,
  DealFileItem,
  Listing,
  Property,
  PropertyStatus,
  PropertyType,
  TaskView,
} from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { getListing, getProperty } from "#/data/store";
import { getContactDetailClient, listAllTasks, listDealsForContact } from "#/data/selectors";
import { allVouchers, type VoucherRow, type VoucherStatus } from "#/data/vouchers";
import { getProspectProperties } from "#/data/prospects";
import { buildContactTimeline } from "#/components/contacts/timelineArcs";
import { needsAttention, type TimelineEvent } from "#/components/contacts/timeline";
import { useContactSession } from "#/components/contacts/useContactSession";
import { commissionForecast } from "#/data/commission";
import { OWNER } from "#/components/contacts/timelineKit";

/**
 * The read layer behind the assistant's record tools (`task_search`,
 * `activity_search`, `attachment_list`, `voucher_search`,
 * `research_property_search`, `deal_pipeline_totals`).
 *
 * Split out of `tools.ts` because these are the only parts of those tools worth
 * testing: the `client()` wrappers there need a router and a live browser, while
 * the filtering and totalling below are plain functions over the seeded store.
 * `recordQueries.test.ts` exercises them directly.
 *
 * Each one reads the same source the corresponding *page* reads — tasks come
 * from `listAllTasks`, vouchers from `allVouchers`, a contact's activity from
 * `buildContactTimeline` — so the assistant can never report a record the broker
 * can't then go and look at.
 */

// ── Tasks ────────────────────────────────────────────────────────────────────

export interface TaskQuery {
  /** Free text matched against the title and the source record's name. */
  query?: string;
  status?: "open" | "complete";
  /** A due window, evaluated against `today`. */
  due?: "overdue" | "today" | "week" | "unscheduled";
  contactId?: string;
  dealId?: string;
  limit?: number;
}

/** `YYYY-MM-DD` `days` from `today`. */
function shiftDay(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function searchTasks(
  q: TaskQuery = {},
  today = new Date().toISOString().slice(0, 10),
): { total: number; tasks: TaskView[] } {
  const text = q.query?.trim().toLowerCase();
  let rows = listAllTasks();

  if (q.status === "open") rows = rows.filter((t) => !t.completed);
  if (q.status === "complete") rows = rows.filter((t) => t.completed);
  if (q.contactId) rows = rows.filter((t) => t.contactId === q.contactId);
  if (q.dealId) rows = rows.filter((t) => t.dealId === q.dealId);
  if (text) {
    rows = rows.filter(
      (t) =>
        t.title.toLowerCase().includes(text) ||
        t.sourceLabel.toLowerCase().includes(text),
    );
  }

  if (q.due) {
    const weekEnd = shiftDay(today, 7);
    rows = rows.filter((t) => {
      if (q.due === "unscheduled") return t.dueDate === null;
      if (t.dueDate === null) return false;
      // A due window is about what still needs doing, so a completed task never
      // counts as overdue — the Tasks page draws the same line.
      if (q.due === "overdue") return !t.completed && t.dueDate < today;
      if (q.due === "today") return t.dueDate === today;
      return t.dueDate >= today && t.dueDate <= weekEnd;
    });
  }

  // Soonest first, unscheduled last — the order the broker works them in.
  rows.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  return { total: rows.length, tasks: rows.slice(0, q.limit ?? 25) };
}

export function loadTask(taskId: string): TaskView | null {
  return listAllTasks().find((t) => t.id === taskId) ?? null;
}

// ── Property ownership ───────────────────────────────────────────────────────

/**
 * Every property a contact holds — the ones stamped on `ownedPropertyIds` plus
 * the ones behind deals they are a party to.
 *
 * The union, not just the stamped list, because the contact page's Properties
 * panel is built the same way: a building they own outright and a building they
 * already have a deal on both read as "theirs" to the broker. An assistant that
 * saw neither kept asking for an address already on screen, then built a second,
 * empty copy of the building when it finally got one.
 */
export function ownedPropertiesFor(contact: Contact): Property[] {
  const ids = new Set(contact.ownedPropertyIds ?? []);
  for (const deal of listDealsForContact(contact.id)) ids.add(deal.propertyId);
  return [...ids].map((id) => getProperty(id)).filter((p): p is Property => !!p);
}

/** Stages where a deal is live work. Anything else leaves the building open. */
const LIVE_STAGES: PropertyStatus[] = ["proposal", "active", "under-contract"];

/**
 * A building the broker could be tracking and isn't.
 *
 * A deal in this product starts at Pitching precisely so there is somewhere to
 * track progress toward Active — so an owner who is *engaging* about a building
 * with no deal on it is a gap in the pipeline, not a closed door. Detected here
 * rather than left to the model's judgement: whether a building has a live deal
 * is a fact, and a suggestion that fires on a hunch is one the broker learns to
 * ignore.
 *
 * Deliberately NOT a claim that the owner has agreed to anything. The whole
 * point of offering Pitching is that it is the stage for a conversation that
 * hasn't become a commitment yet — see the prompt rule that consumes this.
 */
export interface DealOpportunity {
  propertyId: string;
  propertyName: string;
  /** What makes this look like an opening, for the model to paraphrase. */
  reason: string;
  /** Other owned buildings also without a live deal, so the model can say so. */
  alsoUntracked: number;
}

/**
 * The strongest untracked-building opening on a contact, or null.
 *
 * Requires BOTH halves: a building of theirs carrying no live deal, and a
 * reason to think now is the moment — they sent something, their asset threw a
 * signal, or the broker is already pitching them. Ownership alone is not an
 * opening; every owner in the book would qualify and the offer would become
 * noise.
 */
export function dealOpportunityFor(contactId: string): DealOpportunity | null {
  const detail = getContactDetailClient(contactId);
  if (!detail) return null;
  const { contact } = detail;

  const claimed = new Set(
    listDealsForContact(contactId)
      .filter((d) => LIVE_STAGES.includes(d.status))
      .map((d) => d.propertyId),
  );
  const untracked = ownedPropertiesFor(contact).filter((p) => !claimed.has(p.id));
  if (untracked.length === 0) return null;

  // Newest first: the row that just landed is the one the broker is reacting to.
  const rows = contactActivity(contactId);
  const withFiles = rows.find((r) => hasInbound(r) && (r.attachments?.length ?? 0) > 0);

  const reason = withFiles
    ? `they sent ${withFiles.attachments!.join(" and ")}`
    : contact.signal
      ? contact.signal.detail
      : contact.relationship === "pitching" && rows.some(hasInbound)
        ? "you're actively pitching them and they're engaging"
        : null;
  if (!reason) return null;

  const property = untracked[0];
  return {
    propertyId: property.id,
    propertyName: property.name,
    reason,
    alsoUntracked: untracked.length - 1,
  };
}

// ── Activities ───────────────────────────────────────────────────────────────

/**
 * One logged interaction, flattened from whichever feed it came from.
 *
 * A contact's activity is a synthesized `TimelineEvent` and a deal's is a
 * `DealActivity`; they share nothing but the idea. This is the shape the model
 * sees for both, so it doesn't have to know which feed answered.
 */
export interface ActivityRow {
  id: string;
  type: string;
  timestamp: string;
  actor: string;
  /** "out" = the broker reached out, "in" = it came from the contact. */
  direction?: "out" | "in";
  /** The contact or deal the activity hangs off. */
  parentKind: "contact" | "deal";
  parentId: string;
  parentName: string;
  title: string;
  body: string;
  /**
   * The contact's reply, nested under a message the broker sent.
   *
   * This one field is why the row can't be flattened to `body`: a sent email
   * that came back answered is stored as ONE outbound event carrying the
   * inbound reply inside it. Drop it and the record reads as though the contact
   * never responded — which is exactly what the assistant reported before this
   * was carried through.
   */
  reply?: {
    from: string;
    body: string;
    /** e.g. "1d after send" — the arc stores a delay, not always a timestamp. */
    delay?: string;
    sentiment?: string;
  };
  /** A folded email conversation, oldest → newest. */
  thread?: Array<{
    direction: "out" | "in";
    sender: string;
    timestamp: string;
    body: string;
  }>;
  /** File names carried by the message (or its thread). */
  attachments?: string[];
  durationMinutes?: number;
  /** True when the timeline counts this row under "Needs Reply". */
  needsReply?: boolean;
}

const timelineTitle = (e: TimelineEvent): string =>
  e.title ?? e.subject ?? e.type.replace(/-/g, " ");

const timelineBody = (e: TimelineEvent): string =>
  e.body ??
  e.thread?.latestBody ??
  e.blocks?.flatMap((b) => b.items).join(" ") ??
  "";

/**
 * Every activity on a contact, newest first.
 *
 * Built from `getContactDetailClient` rather than by re-deriving the contact's
 * deals, so the feed the assistant reads is the same object the contact page
 * renders — including which deals count as theirs.
 *
 * The three sources have to match the page's feed exactly (see the `events`
 * memo in `ContactEngagementPanel`): session sim events, the synthesized arc,
 * and anything logged this session. Sim events were the one that was missing,
 * and they are the newest rows on the page — an email that self-arrives mid-demo
 * (Rosa sending Miguel's T-12 and rent roll, `heroInbound`) sat at the top of
 * the broker's timeline while the assistant, reading a feed without it, answered
 * off the newest row it COULD see and reported an older exchange as her latest
 * word. A feed that silently ends one row short of the page is worse than an
 * empty one: it is confidently wrong about the thing the broker is looking at.
 */
export function contactActivity(contactId: string): ActivityRow[] {
  const detail = getContactDetailClient(contactId);
  if (!detail) return [];
  const { contact, deals } = detail;
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  const simEvents = useContactSession.getState().simEvents[contactId] ?? [];
  // Sim events first so they win a same-timestamp tie against the arc, which is
  // the page's order too — they are the rows that just arrived.
  const synthesized = [...simEvents, ...buildContactTimeline(contact, deals)].map((e) => {
    const attachments = [
      ...(e.attachments ?? []),
      ...(e.thread?.messages.flatMap((m) => m.attachments ?? []) ?? []),
    ].map((a) => a.name);
    return {
      id: e.id,
      type: e.type,
      timestamp: e.timestamp,
      actor: e.actor.name,
      direction: e.direction,
      parentKind: "contact" as const,
      parentId: contactId,
      parentName: name,
      title: timelineTitle(e),
      body: timelineBody(e),
      // Everything below is conditional on the row. Carried rather than
      // flattened because each answers a question the body alone can't: did she
      // reply, what did the rest of the thread say, what came attached, how long
      // was the call, and is this row still waiting on us.
      ...(e.reply && {
        reply: {
          from: e.reply.replier,
          body: e.reply.body,
          delay: e.reply.delay,
          sentiment: e.reply.sentiment,
        },
      }),
      ...(e.thread && {
        thread: e.thread.messages.map((m) => ({
          direction: m.direction,
          sender: m.sender,
          timestamp: m.timestamp,
          body: m.body,
        })),
      }),
      ...(attachments.length && { attachments }),
      ...(e.durationSecs && { durationMinutes: Math.round(e.durationSecs / 60) }),
      ...(needsAttention(e) && { needsReply: true }),
    };
  });
  // Anything logged this session — including what the assistant itself just
  // wrote via add_activity / log_call — lives in the session store rather than
  // the arc. Merging it here is what lets "when did I last talk to her" see the
  // call the broker logged two minutes ago.
  const logged = (useContactSession.getState().logged[contactId] ?? []).map((a) => ({
    id: a.id,
    type: a.kind,
    timestamp: a.createdAt,
    actor: OWNER.name,
    parentKind: "contact" as const,
    parentId: contactId,
    parentName: name,
    title: a.subject ?? a.kind,
    body: a.body,
  }));
  return [...logged, ...synthesized].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
}

/**
 * Every activity on a deal, newest first.
 *
 * Reversed *before* sorting because `DealActivity` carries no sequence number:
 * two activities logged in the same millisecond tie on `timestamp`, and a stable
 * sort would then keep them in store order — which is oldest-first. Reversing
 * first makes the tiebreak fall the way the row was actually written.
 */
export function dealActivity(dealId: string): ActivityRow[] {
  const deal = getListing(dealId);
  if (!deal) return [];
  return [...deal.activities]
    .reverse()
    .map((a) => ({
      id: a.id,
      type: a.type,
      timestamp: a.timestamp,
      actor: a.actor,
      parentKind: "deal" as const,
      parentId: dealId,
      parentName: deal.name,
      title: a.type,
      body: a.note,
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export interface ActivityQuery {
  contactId?: string;
  dealId?: string;
  /** Activity type, matched loosely ("call" also matches "inbound-call"). */
  type?: string;
  /**
   * Which way the exchange ran. `"in"` deliberately keeps an OUTBOUND row that
   * carries an inbound reply or an inbound thread message: on this timeline the
   * contact's answer is stored inside the message it answers, so a strict
   * `direction === "in"` test would hide every reply she ever sent.
   */
  direction?: "in" | "out";
  /** ISO `YYYY-MM-DD` — only activities on or after this day. */
  since?: string;
  limit?: number;
}

/** Did anything in this row come FROM the other party? */
export function hasInbound(r: ActivityRow): boolean {
  return (
    r.direction === "in" ||
    r.reply !== undefined ||
    (r.thread?.some((m) => m.direction === "in") ?? false)
  );
}

export function searchActivities(q: ActivityQuery): {
  total: number;
  activities: ActivityRow[];
} {
  let rows: ActivityRow[] = q.contactId
    ? contactActivity(q.contactId)
    : q.dealId
      ? dealActivity(q.dealId)
      : [];
  if (q.type) {
    const t = q.type.toLowerCase();
    rows = rows.filter((r) => r.type.toLowerCase().includes(t));
  }
  if (q.direction === "in") rows = rows.filter(hasInbound);
  if (q.direction === "out") rows = rows.filter((r) => r.direction === "out");
  if (q.since) rows = rows.filter((r) => r.timestamp.slice(0, 10) >= q.since!);
  return { total: rows.length, activities: rows.slice(0, q.limit ?? 20) };
}

export function loadActivity(
  activityId: string,
  scope: { contactId?: string; dealId?: string },
): ActivityRow | null {
  const rows = scope.contactId
    ? contactActivity(scope.contactId)
    : scope.dealId
      ? dealActivity(scope.dealId)
      : [];
  return rows.find((r) => r.id === activityId) ?? null;
}

// ── Attachments ──────────────────────────────────────────────────────────────

export interface AttachmentRow {
  id: string;
  name: string;
  kind: "folder" | "file";
  /** Slash-joined folder path, "" for items at the root. */
  folder: string;
  sizeBytes: number | null;
  createdAt: string;
}

/**
 * A deal's document vault, flattened.
 *
 * The store holds files as a parent-pointer tree and soft-deletes into a recycle
 * bin; neither survives the trip to the model, so folders resolve to a path
 * string and deleted items are dropped — the assistant should never offer the
 * broker a file that reads as deleted on the page.
 */
export function listAttachments(dealId: string): AttachmentRow[] {
  const items: DealFileItem[] | undefined = useDataStore.getState().dealFiles.get(dealId);
  if (!items) return [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const pathOf = (item: DealFileItem): string => {
    const parts: string[] = [];
    let cursor = item.parentId ? byId.get(item.parentId) : undefined;
    // Depth-guarded rather than trusting the tree: a cycle here would hang the
    // tool rather than return a wrong answer, which is the worse failure.
    for (let hops = 0; cursor && hops < 16; hops += 1) {
      parts.unshift(cursor.name);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return parts.join("/");
  };
  return items
    .filter((i) => !i.deletedAt)
    .map((i) => ({
      id: i.id,
      name: i.name,
      kind: i.kind,
      folder: pathOf(i),
      sizeBytes: i.sizeBytes ?? null,
      createdAt: i.createdAt,
    }));
}

// ── Vouchers ─────────────────────────────────────────────────────────────────

export interface VoucherQuery {
  query?: string;
  status?: VoucherStatus;
  dealStage?: PropertyStatus;
  brokerName?: string;
  limit?: number;
}

export function searchVouchers(q: VoucherQuery = {}): {
  total: number;
  vouchers: VoucherRow[];
} {
  const text = q.query?.trim().toLowerCase();
  let rows = allVouchers();
  if (q.status) rows = rows.filter((v) => v.status === q.status);
  if (q.dealStage) rows = rows.filter((v) => v.dealStage === q.dealStage);
  if (q.brokerName) {
    const b = q.brokerName.toLowerCase();
    rows = rows.filter((v) => v.brokerName?.toLowerCase().includes(b));
  }
  if (text) {
    rows = rows.filter(
      (v) =>
        v.name.toLowerCase().includes(text) ||
        v.dealName.toLowerCase().includes(text) ||
        v.identifier.toLowerCase().includes(text) ||
        v.propertyAddress.toLowerCase().includes(text),
    );
  }
  return { total: rows.length, vouchers: rows.slice(0, q.limit ?? 25) };
}

export function loadVoucher(dealId: string): {
  voucher: VoucherRow;
  deal: Listing;
} | null {
  const voucher = allVouchers().find((v) => v.dealId === dealId);
  const deal = getListing(dealId);
  return voucher && deal ? { voucher, deal } : null;
}

// ── Research properties (Buildout Insights prospects) ────────────────────────

export interface ResearchQuery {
  query?: string;
  propertyType?: PropertyType;
  city?: string;
  state?: string;
  minSqFt?: number;
  maxSqFt?: number;
  limit?: number;
}

export function searchResearchProperties(q: ResearchQuery = {}): {
  total: number;
  properties: Property[];
} {
  const text = q.query?.trim().toLowerCase();
  let rows = getProspectProperties();
  if (q.propertyType) rows = rows.filter((p) => p.propertyType === q.propertyType);
  if (q.city) {
    const c = q.city.toLowerCase();
    rows = rows.filter((p) => p.city.toLowerCase().includes(c));
  }
  if (q.state) {
    const s = q.state.toLowerCase();
    rows = rows.filter((p) => p.state.toLowerCase() === s);
  }
  if (q.minSqFt != null) rows = rows.filter((p) => (p.buildingSqFt ?? 0) >= q.minSqFt!);
  if (q.maxSqFt != null) rows = rows.filter((p) => (p.buildingSqFt ?? 0) <= q.maxSqFt!);
  if (text) {
    rows = rows.filter((p) =>
      [p.name, p.street, p.city, p.state, p.propertyType, p.propertySubtype]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text),
    );
  }
  return { total: rows.length, properties: rows.slice(0, q.limit ?? 12) };
}

export function loadResearchProperty(propertyId: string): Property | null {
  return getProspectProperties().find((p) => p.id === propertyId) ?? null;
}

// ── Pipeline totals ──────────────────────────────────────────────────────────

const OPEN_STAGES: PropertyStatus[] = ["proposal", "active", "under-contract"];

export interface PipelineTotals {
  stages: Array<{ stage: PropertyStatus; count: number; value: number }>;
  openDeals: number;
  openValue: number;
  closedDeals: number;
  closedValue: number;
  /** Probability-weighted commission, split into brokerage and the broker's own. */
  forecast: { you: number; brokerage: number };
}

/**
 * Pipeline by stage plus the weighted commission forecast.
 *
 * Open value uses the *asking* price and closed value the *transacted* sale
 * price, which is the same split the Deals pipeline header makes: before close
 * the asking price is the only number on the record, and after it the asking
 * price is history.
 */
export function pipelineTotals(dealType?: "Sale" | "Lease"): PipelineTotals {
  let deals = [...useDataStore.getState().listings.values()];
  if (dealType) deals = deals.filter((l) => l.dealType === dealType);

  const stages = ([
    "proposal",
    "active",
    "under-contract",
    "closed",
    "inactive",
  ] as PropertyStatus[]).map((stage) => {
    const rows = deals.filter((l) => l.status === stage);
    const value = rows.reduce(
      (sum, l) =>
        sum + (stage === "closed" ? l.transaction.salePrice : (l.financials.askingPrice ?? 0)),
      0,
    );
    return { stage, count: rows.length, value };
  });

  const open = stages.filter((s) => OPEN_STAGES.includes(s.stage));
  const closed = stages.find((s) => s.stage === "closed");
  return {
    stages,
    openDeals: open.reduce((n, s) => n + s.count, 0),
    openValue: open.reduce((n, s) => n + s.value, 0),
    closedDeals: closed?.count ?? 0,
    closedValue: closed?.value ?? 0,
    forecast: commissionForecast(deals.filter((l) => OPEN_STAGES.includes(l.status))),
  };
}

// ── Compact summaries for the model ──────────────────────────────────────────

export const taskSummary = (t: TaskView) => ({
  id: t.id,
  title: t.title,
  due: t.dueDate,
  type: t.type,
  status: t.completed ? "complete" : "open",
  assignee: t.assigneeName,
  attachedTo: t.sourceLabel || null,
  dealId: t.dealId ?? null,
  contactId: t.contactId ?? null,
});

export const voucherSummary = (v: VoucherRow) => ({
  dealId: v.dealId,
  name: v.name,
  identifier: v.identifier,
  status: v.status,
  dealName: v.dealName,
  dealStage: v.dealStage,
  closeDate: v.closeDate,
  broker: v.brokerName,
  transactionValue: v.transactionValue,
  grossCommission: v.grossCommission,
  receivablesOutstanding: v.receivablesOutstanding,
});

export const researchSummary = (p: Property) => ({
  id: p.id,
  name: p.name,
  address: [p.street, p.city, p.state].filter(Boolean).join(", "),
  propertyType: p.propertyType,
  subtype: p.propertySubtype,
  buildingSqFt: p.buildingSqFt,
  yearBuilt: p.yearBuilt,
  // Prospects are public-records aggregates, not deals — say so in the payload
  // so the model can't describe one as something the broker already owns.
  inYourDatabase: false,
});

export const compSummary = (c: Comp) => ({
  id: c.id,
  compType: c.compType,
  date: c.closingDate || c.date,
  salePrice: c.salePrice,
  pricePerSqFt: c.pricePerSqFt,
  capRate: c.capRateAtSale,
  sqFt: c.sqFt,
  source: c.source,
});

/** A property's key facts, for `brief` on a property the broker owns. */
export const ownedPropertySummary = (id: string) => {
  const p = getProperty(id);
  return p ? researchSummary(p) : null;
};
