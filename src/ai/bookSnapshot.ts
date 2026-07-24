import { useDataStore } from "#/data/dataStore";
import { buildAssistantContext } from "#/ai/context";
import { listDealsForContact } from "#/data/selectors";
import { dealStageFromStatus } from "#/data/contactStage";
import { formatPrice } from "#/components/properties/propertyDisplay";

const OPEN_STATUSES = new Set(["proposal", "active", "under-contract"]);

/** Human "N days ago" label for a contact's last real contact, or a plain
 * fallback when they've never been contacted. */
function lastTouchLabel(iso: string | null): string {
  if (!iso) return "never contacted";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never contacted";
  const days = Math.max(0, Math.round((Date.now() - then) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/**
 * Plain-text snapshot of the broker's WHOLE book, fed to `generateStrategy`
 * (§3.9). A PIPELINE line (open deal count + total value) followed by one
 * line per contact — name (role, company) — relationship — open-deal
 * side/stage/value or "no open deal" — last-touch — open tasks — note.
 *
 * Reuses `buildAssistantContext` for the pipeline totals and the (already
 * ~30-contact-bounded) contact list, then enriches each contact with its
 * live deal/task/note data from the store. This is the SAME dump shared by
 * the `analyze_book` agent tool (`src/ai/tools.ts`) and the dashboard's "Ask
 * about my book" affordance, so both stay in lockstep on what the model sees.
 */
export function composeBookSnapshot(): string {
  const ctx = buildAssistantContext();
  const { contacts } = useDataStore.getState();

  const lines: string[] = [
    `PIPELINE: ${ctx.pipeline.openDeals} open deals, ${formatPrice(ctx.pipeline.totalValue)} total value`,
  ];

  for (const c of ctx.contacts) {
    const full = contacts.get(c.id);
    if (!full) continue;

    const openDeals = listDealsForContact(c.id).filter((l) => OPEN_STATUSES.has(l.status));
    let dealPart = "no open deal";
    if (openDeals.length > 0) {
      const top = [...openDeals].sort(
        (a, b) => (b.financials.askingPrice ?? 0) - (a.financials.askingPrice ?? 0),
      )[0];
      const side = full.side ?? "party";
      const stage = full.dealStage ?? dealStageFromStatus(top.status) ?? top.status;
      dealPart = `${side}, ${stage}, ${formatPrice(top.financials.askingPrice ?? 0)}`;
    }

    const openTasks = full.openTaskCount;
    const note = full.notes?.trim() ? full.notes.trim().slice(0, 100) : "no notes";

    lines.push(
      `${c.name} (${c.role}, ${c.company || "—"}) — ${c.relationship} — ${dealPart} — last touch ${lastTouchLabel(full.lastContactedAt)} — ${openTasks} open task${openTasks === 1 ? "" : "s"} — ${note}`,
    );
  }

  return lines.join("\n");
}
