import { getListing, getProperty } from "#/data/store";
import { listContactsForDeal } from "#/data/selectors";
import { dealActivity, loadTask, listAttachments } from "#/ai/recordQueries";

/**
 * Plain-text data dumps for the records `brief` can summarize.
 *
 * The sibling of `contactData.ts`, which does the same job for a contact. Kept
 * apart from it because a contact's dump feeds `generateContactBrief` (whose
 * prompt is written around a person) and these feed `generateRecordBrief`
 * (written around a record) — one file per prompt, so neither drifts into
 * describing the other's shape.
 *
 * Returns `null` when the id resolves to nothing, which is what tells the tool
 * to report "not found" rather than brief an empty record.
 */
export interface RecordDump {
  /** What to call the record in the brief's opening line. */
  name: string;
  kind: "deal" | "listing" | "property" | "task";
  data: string;
}

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString()}`;

export function composeDealData(dealId: string): RecordDump | null {
  const deal = getListing(dealId);
  if (!deal) return null;
  const property = getProperty(deal.propertyId);
  const parties = listContactsForDeal(dealId);
  const activity = dealActivity(dealId).slice(0, 12);
  const files = listAttachments(dealId).filter((f) => f.kind === "file");
  const openTasks = deal.tasks.filter((t) => t.status !== "complete");

  const lines: string[] = [
    `DEAL: ${deal.name}`,
    `STAGE: ${deal.status}`,
    `TYPE: ${deal.dealType}`,
    `ADDRESS: ${property ? [property.street, property.city, property.state].filter(Boolean).join(", ") : "—"}`,
    `PROPERTY TYPE: ${property?.propertyType ?? "—"}`,
    `SIZE: ${property?.buildingSqFt ? `${property.buildingSqFt.toLocaleString()} SF` : "—"}`,
    `ASKING PRICE: ${money(deal.financials.askingPrice)}`,
    `SALE PRICE: ${money(deal.transaction.salePrice)}`,
    `COMMISSION: ${money(deal.transaction.commissionAmount)} (${deal.transaction.commissionPct}%)`,
    `CLOSE PROBABILITY: ${deal.transaction.closeProbability}%`,
    `CLOSE DATE: ${deal.transaction.closeDate ?? "—"}`,
    `NEXT CRITICAL DATE: ${deal.transaction.nextCriticalDate ?? "—"}`,
    `VOUCHER STATUS: ${deal.transaction.backOffice.status}`,
  ];

  lines.push(
    parties.length
      ? `PARTIES:\n${parties.map((c) => `- ${`${c.firstName} ${c.lastName}`.trim()} | ${c.role} | ${c.company || "—"}`).join("\n")}`
      : "PARTIES: none named",
  );
  lines.push(
    openTasks.length
      ? `OPEN TASKS:\n${openTasks.map((t) => `- ${t.label}${t.date ? ` (due ${t.date})` : t.relativeDue ? ` (${t.relativeDue})` : ""}`).join("\n")}`
      : "OPEN TASKS: none",
  );
  lines.push(
    activity.length
      ? `RECENT ACTIVITY:\n${activity.map((a) => `- ${a.timestamp.slice(0, 10)} | ${a.type} | ${a.body}`).join("\n")}`
      : "RECENT ACTIVITY: none logged",
  );
  lines.push(`ATTACHMENTS: ${files.length ? files.map((f) => f.name).join(", ") : "none"}`);

  return { name: deal.name, kind: "deal", data: lines.join("\n") };
}

export function composePropertyData(propertyId: string): RecordDump | null {
  const p = getProperty(propertyId);
  if (!p) return null;
  const lines = [
    `PROPERTY: ${p.name || [p.street, p.city].filter(Boolean).join(", ")}`,
    `ADDRESS: ${[p.street, p.city, p.state, p.zip].filter(Boolean).join(", ")}`,
    `TYPE: ${p.propertyType}${p.propertySubtype ? ` / ${p.propertySubtype}` : ""}`,
    `SIZE: ${p.buildingSqFt ? `${p.buildingSqFt.toLocaleString()} SF` : "—"}`,
    `YEAR BUILT: ${p.yearBuilt ?? "—"}`,
    `ASKING PRICE: ${money(p.askingPrice)}`,
    `CAP RATE: ${p.capRate != null ? `${p.capRate}%` : "—"}`,
    `STATUS: ${p.status ?? "not on the market"}`,
  ];
  return {
    name: p.name || [p.street, p.city].filter(Boolean).join(", "),
    kind: "property",
    data: lines.join("\n"),
  };
}

export function composeTaskData(taskId: string): RecordDump | null {
  const t = loadTask(taskId);
  if (!t) return null;
  const lines = [
    `TASK: ${t.title}`,
    `STATUS: ${t.completed ? "complete" : "open"}`,
    `DUE: ${t.dueDate ?? "unscheduled"}`,
    `TYPE: ${t.type ?? "—"}`,
    `ASSIGNEE: ${t.assigneeName}`,
    `ATTACHED TO: ${t.sourceLabel || "nothing"}`,
  ];
  // A task carries almost nothing on its own, so its brief is mostly the record
  // it hangs off — which is also the honest answer to "brief me on this task".
  const parent = t.dealId ? composeDealData(t.dealId) : null;
  if (parent) lines.push("", `CONTEXT — the deal this task belongs to:`, parent.data);
  return { name: t.title, kind: "task", data: lines.join("\n") };
}
